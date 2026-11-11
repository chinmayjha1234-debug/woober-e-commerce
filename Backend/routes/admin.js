// Admin-only routes for customer orders. All start with /api/admin (see index.js).
// (Product management is in products.js; it uses the same requireAdmin check.)
const express = require('express');
const { pool } = require('../db');
const { requireAdmin } = require('../middleware');
const { loadOrders } = require('../orderData');
const { parseId, sendError } = require('../helpers');

const router = express.Router();

// Every route in this file is for admins only.
router.use(requireAdmin);

// GET /api/admin/orders  -> all orders of all customers, newest first
router.get('/orders', async function (req, res) {
  try {
    res.json({ orders: await loadOrders('', []) });
  } catch (err) {
    sendError(res, err);
  }
});

// PUT /api/admin/orders/:id  { status }  -> mark an order "pending" or "completed"
router.put('/orders/:id', async function (req, res) {
  const id = parseId(req.params.id);
  const status = String((req.body || {}).status || '');
  if (status !== 'pending' && status !== 'completed') {
    return res.status(400).json({ error: 'Status must be "pending" or "completed".' });
  }

  try {
    const result = id ? await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]) : { rowCount: 0 };
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const orders = await loadOrders('WHERE o.id = $1', [id]);
    res.json({ order: orders[0] });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
