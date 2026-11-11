// Shopping cart routes. All start with /api/cart (see index.js).
// IMPORTANT: every query has "user_id = logged-in user", so a user can only touch their own cart.
const express = require('express');
const { pool } = require('../db');
const { requireLogin } = require('../middleware');
const { parseId, sendError, toCents } = require('../helpers');

const router = express.Router();

// Every route in this file needs a logged-in user.
router.use(requireLogin);

const MAX_PER_PRODUCT = 99;

// Reads the whole cart of one user and adds up the total.
async function loadCart(userId) {
  const result = await pool.query(
    `SELECT c.id, c.quantity, p.id AS product_id, p.name, p.price, p.image, p.stock
       FROM cart_items c
       JOIN products p ON p.id = c.product_id
      WHERE c.user_id = $1
      ORDER BY c.id`,
    [userId]
  );

  let totalCents = 0;
  let count = 0;
  const items = result.rows.map(function (row) {
    const subtotalCents = toCents(row.price) * row.quantity;
    totalCents += subtotalCents;
    count += row.quantity;
    return {
      id: row.id,
      productId: row.product_id,
      name: row.name,
      price: Number(row.price),
      imageUrl: row.image ? '/uploads/' + row.image : null,
      stock: row.stock,
      quantity: row.quantity,
      subtotal: subtotalCents / 100
    };
  });
  return { items: items, total: totalCents / 100, count: count };
}

// Reads a quantity from the request. Returns null if it is not a whole number from 1 to 99.
function readQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PER_PRODUCT) {
    return null;
  }
  return quantity;
}

// GET /api/cart  -> the logged-in user's cart
router.get('/', async function (req, res) {
  try {
    res.json(await loadCart(req.session.userId));
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/cart  { productId, quantity }  -> add a product (adds to the amount if it is already in the cart)
router.post('/', async function (req, res) {
  const body = req.body || {};
  const productId = parseId(body.productId);
  const quantity = readQuantity(body.quantity === undefined ? 1 : body.quantity);
  if (!productId) {
    return res.status(400).json({ error: 'Choose a product.' });
  }
  if (!quantity) {
    return res.status(400).json({ error: 'Quantity must be a whole number from 1 to ' + MAX_PER_PRODUCT + '.' });
  }

  try {
    const found = await pool.query('SELECT id, stock FROM products WHERE id = $1', [productId]);
    const product = found.rows[0];
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    if (product.stock < 1) {
      return res.status(409).json({ error: 'This product is out of stock.' });
    }

    // Insert, or add to the existing amount. LEAST() keeps the amount from going above the stock.
    await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES ($1, $2, LEAST($3::int, $4::int))
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET quantity = LEAST(cart_items.quantity + $3::int, $4::int)`,
      [req.session.userId, product.id, quantity, product.stock]
    );
    res.status(201).json(await loadCart(req.session.userId));
  } catch (err) {
    sendError(res, err);
  }
});

// PUT /api/cart/:id  { quantity }  -> change the amount of one cart item
router.put('/:id', async function (req, res) {
  const id = parseId(req.params.id);
  const quantity = readQuantity((req.body || {}).quantity);
  if (!quantity) {
    return res.status(400).json({ error: 'Quantity must be a whole number from 1 to ' + MAX_PER_PRODUCT + '.' });
  }

  try {
    const found = id ? await pool.query(
      `SELECT c.id, p.stock FROM cart_items c JOIN products p ON p.id = c.product_id
        WHERE c.id = $1 AND c.user_id = $2`,
      [id, req.session.userId]
    ) : { rows: [] };
    const item = found.rows[0];
    if (!item) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }
    if (quantity > item.stock) {
      return res.status(409).json({ error: 'Only ' + item.stock + ' in stock.' });
    }

    await pool.query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [quantity, item.id]);
    res.json(await loadCart(req.session.userId));
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/cart/:id  -> remove one item from the cart
router.delete('/:id', async function (req, res) {
  const id = parseId(req.params.id);
  try {
    const result = id ? await pool.query(
      'DELETE FROM cart_items WHERE id = $1 AND user_id = $2',
      [id, req.session.userId]
    ) : { rowCount: 0 };
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }
    res.json(await loadCart(req.session.userId));
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
