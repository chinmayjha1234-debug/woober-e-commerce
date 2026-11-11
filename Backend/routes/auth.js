// Register, login, logout and "who am I" routes. All start with /api (see index.js).
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireLogin } = require('../middleware');
const { sendError } = require('../helpers');

const router = express.Router();

// Converts a database row into the object we send to the browser (never includes the password).
function formatUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at
  };
}

function isValidEmail(email) {
  return email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Logs the user in by remembering their id in a NEW session
// (a fresh session id on every login protects against session fixation).
function startSession(req, userId) {
  return new Promise(function (resolve, reject) {
    req.session.regenerate(function (err) {
      if (err) {
        return reject(err);
      }
      req.session.userId = userId;
      req.session.save(function (saveErr) {
        if (saveErr) {
          return reject(saveErr);
        }
        resolve();
      });
    });
  });
}

// POST /api/register   (everyone who registers here is a customer; admins are made in the database/.env)
router.post('/register', async function (req, res) {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  // 1. Validate the input.
  if (name === '' || name.length > 100) {
    return res.status(400).json({ error: 'Name is required (maximum 100 characters).' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 6 || password.length > 72) {
    return res.status(400).json({ error: 'Password must be 6 to 72 characters.' });
  }

  try {
    // 2. Make sure the email is not already used.
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // 3. Hash the password (we never store the real password) and save the user.
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'customer') RETURNING *",
      [name, email, passwordHash]
    );
    const user = result.rows[0];

    // 4. Log the user in.
    await startSession(req, user.id);
    res.status(201).json({ user: formatUser(user) });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/login
router.post('/login', async function (req, res) {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Same message for "no such email" and "wrong password", so nobody can guess which emails exist.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    await startSession(req, user.id);
    res.json({ user: formatUser(user) });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/logout
router.post('/logout', function (req, res) {
  req.session.destroy(function () {
    res.clearCookie('connect.sid');
    res.json({});
  });
});

// GET /api/me  (returns the logged-in user, or 401 if nobody is logged in)
router.get('/me', async function (req, res) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in.' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Please log in.' });
    }
    res.json({ user: formatUser(result.rows[0]) });
  } catch (err) {
    sendError(res, err);
  }
});

// PUT /api/me  (update the profile: name, email and, optionally, a new password)
router.put('/me', requireLogin, async function (req, res) {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');

  if (name === '' || name.length > 100) {
    return res.status(400).json({ error: 'Name is required (maximum 100 characters).' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (newPassword !== '' && (newPassword.length < 6 || newPassword.length > 72)) {
    return res.status(400).json({ error: 'New password must be 6 to 72 characters.' });
  }

  try {
    const found = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    const user = found.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Please log in.' });
    }

    // Changing the password needs the current password.
    let passwordHash = user.password;
    if (newPassword !== '') {
      if (!(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
      passwordHash = await bcrypt.hash(newPassword, 10);
    }

    // The email must not belong to somebody else.
    const taken = await pool.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, user.id]);
    if (taken.rows.length > 0) {
      return res.status(409).json({ error: 'Another account already uses this email.' });
    }

    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, password = $3 WHERE id = $4 RETURNING *',
      [name, email, passwordHash, user.id]
    );
    res.json({ user: formatUser(result.rows[0]) });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
