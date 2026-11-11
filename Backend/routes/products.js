// Product routes. All start with /api/products (see index.js).
// Anyone can look at products. Only admins can add, edit and delete them.
const express = require('express');
const { pool } = require('../db');
const { requireAdmin } = require('../middleware');
const { uploadImage, deleteFile } = require('../upload');
const { parseId, sendError } = require('../helpers');

const router = express.Router();

// Converts a database row into the object we send to the browser.
function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),           // NUMERIC comes from PostgreSQL as text
    stock: row.stock,
    imageUrl: row.image ? '/uploads/' + row.image : null,
    createdAt: row.created_at
  };
}

// Reads and checks name, description, price and stock from the form.
// Returns { error: '...' } if something is wrong, otherwise the clean values.
function readFields(body) {
  body = body || {};
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  const price = Number(body.price === undefined || body.price === '' ? NaN : body.price);
  const stock = Number(body.stock === undefined || body.stock === '' ? NaN : body.stock);

  if (name === '') {
    return { error: 'Product name is required.' };
  }
  if (name.length > 100) {
    return { error: 'Product name can have at most 100 characters.' };
  }
  if (description.length > 1000) {
    return { error: 'Description can have at most 1000 characters.' };
  }
  if (!isFinite(price) || price < 0 || price > 10000000) {
    return { error: 'Price must be a number from 0 to 10,000,000.' };
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
    return { error: 'Stock must be a whole number, zero or more.' };
  }
  return { name: name, description: description, price: Math.round(price * 100) / 100, stock: stock };
}

// GET /api/products  -> all products, newest first (public)
router.get('/', async function (req, res) {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    res.json({ products: result.rows.map(formatProduct) });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/products/:id  -> one product (public)
router.get('/:id', async function (req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ product: formatProduct(result.rows[0]) });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/products  -> add a product (admin only; the form is sent with an optional image)
// requireAdmin runs BEFORE uploadImage, so strangers cannot even upload files.
router.post('/', requireAdmin, uploadImage, async function (req, res) {
  const fields = readFields(req.body);
  if (fields.error) {
    deleteFile(req.file && req.file.filename); // remove the image we just saved
    return res.status(400).json({ error: fields.error });
  }

  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, price, stock, image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [fields.name, fields.description, fields.price, fields.stock, req.file ? req.file.filename : null]
    );
    res.status(201).json({ product: formatProduct(result.rows[0]) });
  } catch (err) {
    deleteFile(req.file && req.file.filename);
    sendError(res, err);
  }
});

// PUT /api/products/:id  -> edit a product (admin only). A new image is optional; without one the old image is kept.
router.put('/:id', requireAdmin, uploadImage, async function (req, res) {
  const newImage = req.file; // undefined if no new image was chosen

  try {
    const id = parseId(req.params.id);
    const old = id ? (await pool.query('SELECT * FROM products WHERE id = $1', [id])).rows[0] : undefined;
    if (!old) {
      deleteFile(newImage && newImage.filename);
      return res.status(404).json({ error: 'Product not found.' });
    }

    const fields = readFields(req.body);
    if (fields.error) {
      deleteFile(newImage && newImage.filename);
      return res.status(400).json({ error: fields.error });
    }

    const result = await pool.query(
      'UPDATE products SET name = $1, description = $2, price = $3, stock = $4, image = $5 WHERE id = $6 RETURNING *',
      [fields.name, fields.description, fields.price, fields.stock, newImage ? newImage.filename : old.image, old.id]
    );
    if (newImage) {
      deleteFile(old.image); // the old image is no longer needed
    }
    res.json({ product: formatProduct(result.rows[0]) });
  } catch (err) {
    deleteFile(newImage && newImage.filename);
    sendError(res, err);
  }
});

// DELETE /api/products/:id  -> remove a product and its image (admin only).
// Old orders keep working: they store their own copy of the product name and price.
router.delete('/:id', requireAdmin, async function (req, res) {
  try {
    const id = parseId(req.params.id);
    const result = id ? await pool.query('DELETE FROM products WHERE id = $1 RETURNING image', [id]) : { rows: [] };
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    deleteFile(result.rows[0].image);
    res.json({});
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
