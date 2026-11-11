// Reads orders together with their items. Used by the customer routes and the admin routes.
const { pool } = require('./db');

// "where" is a fixed piece of SQL written by us (never user input); the values go in "params".
async function loadOrders(where, params) {
  const orders = await pool.query(
    `SELECT o.id, o.total_amount, o.status, o.created_at, u.name AS customer_name, u.email AS customer_email
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ${where}
      ORDER BY o.id DESC`,
    params
  );
  if (orders.rows.length === 0) {
    return [];
  }

  const ids = orders.rows.map(function (row) { return row.id; });
  const items = await pool.query(
    'SELECT order_id, product_id, product_name, quantity, price FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id',
    [ids]
  );

  return orders.rows.map(function (row) {
    return {
      id: row.id,
      total: Number(row.total_amount),
      status: row.status,
      createdAt: row.created_at,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      items: items.rows
        .filter(function (item) { return item.order_id === row.id; })
        .map(function (item) {
          return { productId: item.product_id, name: item.product_name, quantity: item.quantity, price: Number(item.price) };
        })
    };
  });
}

module.exports = { loadOrders };
