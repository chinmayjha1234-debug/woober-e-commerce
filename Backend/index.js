// Starts the Woober web server: serves the website (Frontend folder) and the API.

// Load settings (database password, secrets) from the .env file, if there is one.
// Needs Node 20.12 or newer; on older versions set the variables in the terminal instead.
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(); } catch (err) { /* no .env file, that is fine */ }
}

const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');
const { pool, createTables } = require('./db');
const { UPLOADS } = require('./upload');

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('Set SESSION_SECRET before running in production.');
  process.exit(1);
}

const app = express();

// Read JSON sent by the browser (login, register, cart and order requests).
app.use(express.json());

// Sessions: after login the server remembers the user with a cookie. Session data is stored in PostgreSQL.
app.use(session({
  store: new PgSession({ pool: pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'change-this-secret-before-going-live',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,                  // JavaScript in the page cannot read the cookie
    sameSite: 'strict'               // the cookie is only sent from our own website
  }
}));

// API routes
app.use('/api', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

// Unknown API address -> JSON error (instead of an HTML page)
app.use('/api', function (req, res) {
  res.status(404).json({ error: 'Not found.' });
});

// Product images are public, so everybody can see the shop. Only image files are ever saved there.
app.use('/uploads', express.static(UPLOADS, {
  index: false,
  setHeaders: function (res) {
    res.set('X-Content-Type-Options', 'nosniff');
  }
}));

// The website itself (HTML, CSS, JS). Only the Frontend folder is shared with the world.
app.use(express.static(path.join(__dirname, '..', 'Frontend')));

// Last safety net for errors that were not handled in a route.
app.use(function (err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request data.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

module.exports = app;

// Only start listening when this file is run directly (npm start), not when the tests import it.
if (require.main === module) {
  const port = process.env.PORT || 3000;
  createTables()
    .then(function () {
      app.listen(port, function () {
        console.log('Woober running at http://localhost:' + port);
      });
    })
    .catch(function (err) {
      console.error('Could not start Woober. Check that PostgreSQL is running and DATABASE_URL in your .env file is correct.');
      console.error(err.message);
      process.exit(1);
    });
}
