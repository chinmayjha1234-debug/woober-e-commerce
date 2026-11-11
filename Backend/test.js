// Run with: TEST_DATABASE_URL=postgres://user:pass@localhost:5432/woober_test npm test
// The test database is emptied on every run, so it must never be your real one.
if (!process.env.TEST_DATABASE_URL) { console.log('Skipped: set TEST_DATABASE_URL to a throwaway PostgreSQL database.'); process.exit(0); }
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.UPLOADS_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'woober-'));
const test = require('node:test');
const assert = require('node:assert');
const app = require('./index');
const { pool, createTables } = require('./db');

let base, srv;
test.before(async () => {
  await createTables();
  await pool.query('TRUNCATE order_items, orders, cart_items, products, users RESTART IDENTITY CASCADE');
  await new Promise(r => { srv = app.listen(0, () => { base = 'http://localhost:' + srv.address().port; r(); }); });
});
test.after(async () => { srv.close(); await pool.end(); });

// ---------- helpers ----------
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const pic = (name = 'a.png', type = 'image/png') => new File([PNG], name, { type });
const form = (fields, file) => {
  const f = new FormData();
  Object.entries(fields).forEach(([k, v]) => f.append(k, v));
  if (file) f.append('image', file, file.name);
  return f;
};
// minimal client with its own cookie jar
const client = () => {
  let cookie = '';
  return async (path, opts = {}) => {
    const res = await fetch(base + path, { ...opts, headers: { ...opts.headers, cookie } });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return res;
  };
};
const send = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const post = (body) => send('POST', body);
const put = (body) => send('PUT', body);

const signup = (c, email, name = 'Test User') => c('/api/register', post({ name, email, password: 'secret1' }));
const customer = async (email) => { const c = client(); await signup(c, email); return c; };
const admin = async (email) => {
  const c = client(); await signup(c, email, 'Boss');
  await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
  return c;
};
const addProduct = async (adminClient, fields = {}, file) => {
  const res = await adminClient('/api/products', { method: 'POST', body: form({ name: 'Mug', price: '100', stock: '5', description: 'A mug', ...fields }, file) });
  assert.equal(res.status, 201);
  return (await res.json()).product;
};

// ---------- tests ----------
test('auth: register, me, logout, login, bad password, duplicate, role cannot be chosen', async () => {
  const c = client();
  assert.equal((await c('/api/me')).status, 401);
  assert.equal((await signup(c, 'A@x.com')).status, 201);
  const me = (await (await c('/api/me')).json()).user;
  assert.deepEqual([me.email, me.role], ['a@x.com', 'customer']);
  assert.equal((await signup(client(), 'a@x.com')).status, 409);
  await c('/api/logout', { method: 'POST' });
  assert.equal((await c('/api/me')).status, 401);
  assert.equal((await c('/api/login', post({ email: 'a@x.com', password: 'nope123' }))).status, 401);
  assert.equal((await c('/api/login', post({ email: 'a@x.com', password: 'secret1' }))).status, 200);

  // validation, and a "role" in the request must be ignored
  assert.equal((await client()('/api/register', post({ name: '', email: 'b@x.com', password: 'secret1' }))).status, 400);
  assert.equal((await client()('/api/register', post({ name: 'B', email: 'not-an-email', password: 'secret1' }))).status, 400);
  assert.equal((await client()('/api/register', post({ name: 'B', email: 'b@x.com', password: '123' }))).status, 400);
  const sneaky = client();
  await sneaky('/api/register', post({ name: 'S', email: 'sneaky@x.com', password: 'secret1', role: 'admin' }));
  assert.equal((await (await sneaky('/api/me')).json()).user.role, 'customer');

  // passwords are stored hashed
  const row = (await pool.query("SELECT password FROM users WHERE email = 'a@x.com'")).rows[0];
  assert.notEqual(row.password, 'secret1');
  assert.match(row.password, /^\$2[aby]\$/);
});

test('profile: update name/email, change password, duplicate email, wrong current password', async () => {
  const c = await customer('prof@x.com');
  await customer('taken@x.com');
  assert.equal((await client()('/api/me', put({ name: 'X', email: 'x@x.com' }))).status, 401);
  const ok = await c('/api/me', put({ name: 'New Name', email: 'prof2@x.com' }));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).user.name, 'New Name');
  assert.equal((await c('/api/me', put({ name: 'N', email: 'taken@x.com' }))).status, 409);
  assert.equal((await c('/api/me', put({ name: 'N', email: 'prof2@x.com', newPassword: 'newpass1', currentPassword: 'wrong' }))).status, 400);
  assert.equal((await c('/api/me', put({ name: 'N', email: 'prof2@x.com', newPassword: 'newpass1', currentPassword: 'secret1' }))).status, 200);
  assert.equal((await client()('/api/login', post({ email: 'prof2@x.com', password: 'newpass1' }))).status, 200);
});

test('admin protection: only admins can manage products and see all orders', async () => {
  const boss = await admin('boss1@x.com');
  const product = await addProduct(boss);
  const anon = client();
  const user = await customer('shopper1@x.com');

  // anyone can look at products
  assert.equal((await anon('/api/products')).status, 200);
  assert.equal((await anon('/api/products/' + product.id)).status, 200);

  for (const [who, expected] of [[anon, 401], [user, 403]]) {
    assert.equal((await who('/api/products', { method: 'POST', body: form({ name: 'Hack', price: '1', stock: '1' }) })).status, expected);
    assert.equal((await who('/api/products/' + product.id, { method: 'PUT', body: form({ name: 'Hack', price: '1', stock: '1' }) })).status, expected);
    assert.equal((await who('/api/products/' + product.id, { method: 'DELETE' })).status, expected);
    assert.equal((await who('/api/admin/orders')).status, expected);
    assert.equal((await who('/api/admin/orders/1', put({ status: 'completed' }))).status, expected);
  }
  // the product was not changed or deleted
  assert.equal((await (await anon('/api/products/' + product.id)).json()).product.name, 'Mug');
});

test('products: admin CRUD with image upload and validation', async () => {
  const boss = await admin('boss2@x.com');
  const bad = (fields) => boss('/api/products', { method: 'POST', body: form(fields) });
  assert.equal((await bad({ name: '', price: '5', stock: '1' })).status, 400);
  assert.equal((await bad({ name: 'X', price: '-5', stock: '1' })).status, 400);
  assert.equal((await bad({ name: 'X', price: 'abc', stock: '1' })).status, 400);
  assert.equal((await bad({ name: 'X', price: '5', stock: '1.5' })).status, 400);
  assert.equal((await bad({ name: 'X', price: '5', stock: '-1' })).status, 400);
  const notImage = new File(['x'], 'a.txt', { type: 'text/plain' });
  assert.equal((await boss('/api/products', { method: 'POST', body: form({ name: 'X', price: '5', stock: '1' }, notImage) })).status, 400);

  const p = await addProduct(boss, { name: 'Lamp', price: '499.5', stock: '3' }, pic());
  assert.deepEqual([p.name, p.price, p.stock], ['Lamp', 499.5, 3]);
  assert.ok(p.imageUrl.startsWith('/uploads/'));
  assert.equal((await client()(p.imageUrl)).status, 200); // images are public

  // edit without a new image keeps the old image
  const up = await boss('/api/products/' + p.id, { method: 'PUT', body: form({ name: 'Lamp 2', price: '450', stock: '10' }) });
  const edited = (await up.json()).product;
  assert.deepEqual([edited.name, edited.price, edited.stock, edited.imageUrl], ['Lamp 2', 450, 10, p.imageUrl]);
  // edit with a new image replaces it
  const up2 = await boss('/api/products/' + p.id, { method: 'PUT', body: form({ name: 'Lamp 2', price: '450', stock: '10' }, pic('b.png')) });
  const replaced = (await up2.json()).product;
  assert.notEqual(replaced.imageUrl, p.imageUrl);
  assert.equal((await client()(p.imageUrl)).status, 404);

  assert.equal((await boss('/api/products/99999', { method: 'PUT', body: form({ name: 'N', price: '1', stock: '1' }) })).status, 404);
  assert.equal((await client()('/api/products/abc')).status, 404);
  assert.equal((await boss('/api/products/' + p.id, { method: 'DELETE' })).status, 200);
  assert.equal((await client()('/api/products/' + p.id)).status, 404);
  assert.equal((await client()(replaced.imageUrl)).status, 404);
});

test('cart: add, increase, stock limit, update, remove, privacy', async () => {
  const boss = await admin('boss3@x.com');
  const p = await addProduct(boss, { name: 'Pen', price: '20', stock: '3' });
  const soldOut = await addProduct(boss, { name: 'Gone', price: '5', stock: '0' });
  const a = await customer('cart-a@x.com');
  const b = await customer('cart-b@x.com');

  assert.equal((await client()('/api/cart')).status, 401);
  assert.equal((await a('/api/cart', post({ productId: p.id, quantity: 1 }))).status, 201);
  let cart = await (await a('/api/cart', post({ productId: p.id, quantity: 1 }))).json();
  assert.deepEqual([cart.items.length, cart.items[0].quantity, cart.total, cart.count], [1, 2, 40, 2]);
  cart = await (await a('/api/cart', post({ productId: p.id, quantity: 50 }))).json();
  assert.equal(cart.items[0].quantity, 3); // never more than the stock

  assert.equal((await a('/api/cart', post({ productId: soldOut.id, quantity: 1 }))).status, 409);
  assert.equal((await a('/api/cart', post({ productId: 99999, quantity: 1 }))).status, 404);
  assert.equal((await a('/api/cart', post({ productId: p.id, quantity: 0 }))).status, 400);
  assert.equal((await a('/api/cart', post({ productId: p.id, quantity: 'x' }))).status, 400);

  const itemId = cart.items[0].id;
  assert.equal((await a('/api/cart/' + itemId, put({ quantity: 4 }))).status, 409); // above stock
  assert.equal((await a('/api/cart/' + itemId, put({ quantity: 0 }))).status, 400);
  cart = await (await a('/api/cart/' + itemId, put({ quantity: 1 }))).json();
  assert.deepEqual([cart.items[0].quantity, cart.total], [1, 20]);

  // user B cannot see or touch user A's cart
  assert.equal((await (await b('/api/cart')).json()).items.length, 0);
  assert.equal((await b('/api/cart/' + itemId, put({ quantity: 2 }))).status, 404);
  assert.equal((await b('/api/cart/' + itemId, { method: 'DELETE' })).status, 404);

  cart = await (await a('/api/cart/' + itemId, { method: 'DELETE' })).json();
  assert.equal(cart.items.length, 0);
});

test('orders: place order (totals, stock, cart emptied), history, privacy, admin view', async () => {
  const boss = await admin('boss4@x.com');
  const p1 = await addProduct(boss, { name: 'Book', price: '150.50', stock: '5' });
  const p2 = await addProduct(boss, { name: 'Bag', price: '300', stock: '2' });
  const a = await customer('order-a@x.com');
  const b = await customer('order-b@x.com');

  assert.equal((await client()('/api/orders', { method: 'POST' })).status, 401);
  assert.equal((await a('/api/orders', { method: 'POST' })).status, 400); // empty cart

  await a('/api/cart', post({ productId: p1.id, quantity: 2 }));
  await a('/api/cart', post({ productId: p2.id, quantity: 1 }));
  const res = await a('/api/orders', { method: 'POST' });
  assert.equal(res.status, 201);
  const { order } = await res.json();
  assert.deepEqual([order.total, order.status, order.items.length], [601, 'pending', 2]);

  // stock reduced, cart emptied
  assert.equal((await (await client()('/api/products/' + p1.id)).json()).product.stock, 3);
  assert.equal((await (await client()('/api/products/' + p2.id)).json()).product.stock, 1);
  assert.equal((await (await a('/api/cart')).json()).items.length, 0);

  // history: owner sees it, other user does not
  assert.equal((await (await a('/api/orders')).json()).orders.length, 1);
  assert.equal((await a('/api/orders/' + order.id)).status, 200);
  assert.equal((await (await b('/api/orders')).json()).orders.length, 0);
  assert.equal((await b('/api/orders/' + order.id)).status, 404);

  // not enough stock: whole order is refused and nothing changes
  await b('/api/cart', post({ productId: p2.id, quantity: 1 }));
  await pool.query('UPDATE products SET stock = 0 WHERE id = $1', [p2.id]); // somebody else bought it meanwhile
  const refused = await b('/api/orders', { method: 'POST' });
  assert.equal(refused.status, 409);
  assert.equal((await (await b('/api/orders')).json()).orders.length, 0);
  assert.equal((await (await b('/api/cart')).json()).items.length, 1);

  // admin sees all orders (with customer) and can change the status
  const all = (await (await boss('/api/admin/orders')).json()).orders;
  const found = all.find(o => o.id === order.id);
  assert.equal(found.customerEmail, 'order-a@x.com');
  assert.equal((await boss('/api/admin/orders/' + order.id, put({ status: 'shipped!' }))).status, 400);
  assert.equal((await boss('/api/admin/orders/99999', put({ status: 'completed' }))).status, 404);
  const done = await (await boss('/api/admin/orders/' + order.id, put({ status: 'completed' }))).json();
  assert.equal(done.order.status, 'completed');

  // deleting a product does not break old orders
  assert.equal((await boss('/api/products/' + p1.id, { method: 'DELETE' })).status, 200);
  const history = (await (await a('/api/orders')).json()).orders[0];
  assert.deepEqual(history.items.map(i => i.name).sort(), ['Bag', 'Book']);
});

test('static: pages served, Backend code and package files blocked (also when URL-encoded)', async () => {
  for (const page of ['/index.html', '/products.html', '/cart.html', '/dashboard.html', '/admin-products.html'])
    assert.equal((await fetch(base + page)).status, 200, page);
  for (const p of ['/Backend/index.js', '/%42ackend/index.js', '/package.json', '/node_modules/express/package.json', '/%70ackage.json', '/Database/schema.sql', '/.env'])
    assert.equal((await fetch(base + p)).status, 404, p);
  assert.equal((await fetch(base + '/api/nothing')).status, 404);
  const bad = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
  assert.equal(bad.status, 400);
});
