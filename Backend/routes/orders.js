// Order routes for customers. All start with /api/orders (see index.js).
const express = require('express');
const { pool } = require('../db');
const { requireLogin } = require('../middleware');
const { loadOrders } = require('../orderData');
const { HttpError, parseId, sendError, toCents } = require('../helpers');

const router = express.Router();

// Every route in this file needs a logged-in user.
router.use(requireLogin);

// GET /api/orders  -> the logged-in user's orders, newest first
router.get('/', async function (req, res) {
  try {
    res.json({ orders: await loadOrders('WHERE o.user_id = $1', [req.session.userId]) });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/orders/:id  -> one order, but only if it belongs to the logged-in user
router.get('/:id', async function (req, res) {
  const id = parseId(req.params.id);
  try {
    const orders = id ? await loadOrders('WHERE o.id = $1 AND o.user_id = $2', [id, req.session.userId]) : [];
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json({ order: orders[0] });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/orders  -> place an order from the cart
// Everything happens in ONE database transaction: either the whole order is saved
// (order, order items, stock reduced, cart emptied) or nothing is.
router.post('/', async function (req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read the cart and lock the product rows, so two customers cannot buy the last item at the same time.
    const cart = await client.query(
      `SELECT c.quantity, p.id AS product_id, p.name, p.price, p.stock
         FROM cart_items c
         JOIN products p ON p.id = c.product_id
        WHERE c.user_id = $1
        ORDER BY p.id
          FOR UPDATE OF p`,
      [req.session.userId]
    );
    if (cart.rows.length === 0) {
      throw new HttpError(400, 'Your cart is empty.');
    }

    // Check the stock and add up the total (the price comes from the database, not from the browser).
    let totalCents = 0;
    cart.rows.forEach(function (row) {
      if (row.quantity > row.stock) {
        const left = row.stock === 0 ? 'is out of stock' : 'has only ' + row.stock + ' left';
        throw new HttpError(409, '"' + row.name + '" ' + left + '. Please update your cart.');
      }
      totalCents += toCents(row.price) * row.quantity;
    });

    const order = await client.query(
      "INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, 'pending') RETURNING id",
      [req.session.userId, totalCents / 100]
    );
    const orderId = order.rows[0].id;

    for (const row of cart.rows) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES ($1, $2, $3, $4, $5)',
        [orderId, row.product_id, row.name, row.quantity, row.price]
      );
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [row.quantity, row.product_id]);
    }
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.session.userId]);

    await client.query('COMMIT');

    const placed = await loadOrders('WHERE o.id = $1', [orderId]);
    res.status(201).json({ order: placed[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(function () {});
    sendError(res, err);
  } finally {
    client.release();
  }
});

module.exports = router;
