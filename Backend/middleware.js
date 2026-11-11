// Run before protected routes. If the check fails, we stop here and send an error.
const { pool } = require('./db');
const { sendError } = require('./helpers');

// Any logged-in user.
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in.' });
  }
  next(); // logged in, continue to the real route
}

// Admins only. The role is read from the database on every request,
// so it can never be faked from the browser.
async function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in.' });
  }
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Please log in.' });
    }
    if (result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access only.' });
    }
    next();
  } catch (err) {
    sendError(res, err);
  }
}

module.exports = { requireLogin, requireAdmin };
