// Database connection (PostgreSQL), table creation and the first admin account.
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// DATABASE_URL looks like: postgres://username:password@localhost:5432/woober
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/woober'
});

// Creates the tables if they do not exist yet. The SQL lives in Database/schema.sql.
async function createTables() {
  // The first version of this project had a different "users" table. Tell the student what to do.
  const old = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'store_name'"
  );
  if (old.rows.length > 0) {
    throw new Error('Your database still has the tables of the old Woober version. ' +
      'Run this in psql, then start the server again:  DROP TABLE IF EXISTS items, users CASCADE;');
  }

  const sql = fs.readFileSync(path.join(__dirname, '..', 'Database', 'schema.sql'), 'utf8');
  await pool.query(sql);
  await createAdmin();
}

// Creates the admin account from ADMIN_EMAIL and ADMIN_PASSWORD (set in .env).
// If that email already has an account, it is made an admin (its password is not changed).
async function createAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (email === '' || password === '') {
    return;
  }
  if (password.length < 6) {
    console.warn('ADMIN_PASSWORD must be at least 6 characters. Admin account not created.');
    return;
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [existing.rows[0].id]);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO users (name, email, password, role) VALUES ('Admin', $1, $2, 'admin')",
    [email, passwordHash]
  );
  console.log('Admin account created for ' + email);
}

module.exports = { pool, createTables };
