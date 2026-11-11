WOOBER - E-COMMERCE WEBSITE
Built with HTML, CSS, vanilla JavaScript (frontend) and Node.js + Express + PostgreSQL (backend).

WHAT IT DOES
Customers:  register, log in, browse products, open product details, use a shopping cart
            (add / remove / change quantity / total), place orders, see their order history,
            and update their profile.
Admin:      add, edit and delete products (with image upload), and view all customer orders.

FOLDER STRUCTURE
Frontend/               The website (everything the browser can see)
  index.html, about.html, contact.html      Public pages
  login.html, register.html                 Log in / create an account
  products.html, product.html               Product list (with search) and product details
  cart.html, orders.html                    Shopping cart and order history
  dashboard.html                            Profile (view + edit) and overview. Admins see shop numbers.
  admin-products.html, admin-orders.html    Admin only: manage products, see all orders
  common.css, user.css, ...                 Styles (user.css is shared by the shop pages)
  JS/api.js               All calls to the server (fetch) + header/login helpers
  JS/script.js            Mobile menu, login form, register form
  JS/<page>.js            One script per page
Backend/                The backend (never sent to the browser)
  index.js                Starts the server, sessions, connects the routes
  db.js                   PostgreSQL connection, creates tables, creates the admin account
  middleware.js           requireLogin and requireAdmin (protect routes)
  upload.js               Image upload rules (multer): allowed types, size, saving
  helpers.js              Small shared functions
  orderData.js            Reads orders with their items
  routes/auth.js          Register, login, logout, me, update profile
  routes/products.js      List / view (everyone), add / edit / delete (admin only)
  routes/cart.js          Cart (logged-in users, own cart only)
  routes/orders.js        Place an order, own order history
  routes/admin.js         All orders + change order status (admin only)
  test.js                 Automatic tests (optional)
Database/schema.sql     The 5 tables (users, products, cart_items, orders, order_items)
Backend/uploads/        Product images are saved here (created automatically)

HOW TO RUN
1. Install Node.js (version 20.12 or newer is best) and PostgreSQL.
2. Create an empty database:       createdb woober
3. In the project folder, run:     npm install
4. Copy ".env.example" to ".env" and fill in your PostgreSQL password, a secret,
   and the admin email + password.
   (On Node versions older than 20.12 the .env file is not read automatically;
    set the same names as environment variables in the terminal instead.)
5. Start the server:               npm start
6. Open http://localhost:3000 in the browser.
   Do not use Live Server: the Node server also serves the website.
The tables are created automatically the first time the server starts.

If you ran the FIRST version of this project on the same database, run this in psql once,
then start the server again (the old tables have a different structure):
   DROP TABLE IF EXISTS items, users CASCADE;

ADMIN ACCOUNT
The admin is created from ADMIN_EMAIL and ADMIN_PASSWORD in your .env file when the server starts.
Log in with those details; you are taken to "Manage products". Nobody can become admin by
registering: the register form always creates a customer.
(If that email is already registered as a customer, it is promoted to admin.)

THE 5 TABLES
users        id, name, email, password (bcrypt hash), role ('customer' or 'admin'), created_at
products     id, name, description, price, image, stock, created_at
cart_items   id, user_id -> users, product_id -> products, quantity   (one row per user + product)
orders       id, user_id -> users, total_amount, status ('pending' or 'completed'), created_at
order_items  id, order_id -> orders, product_id -> products, quantity, price, product_name
Note: order_items also stores product_name, and the price at the time of ordering. That way an
old order still shows correctly if the product is renamed, repriced or deleted later.

MAIN API ROUTES (JSON)
POST /api/register  /api/login  /api/logout     GET /api/me     PUT /api/me
GET  /api/products  /api/products/:id           (everyone)
POST /api/products   PUT/DELETE /api/products/:id    (admin only, image sent as form field "image")
GET  /api/cart      POST /api/cart              PUT/DELETE /api/cart/:id     (own cart)
POST /api/orders    GET /api/orders  /api/orders/:id                         (own orders)
GET  /api/admin/orders    PUT /api/admin/orders/:id                          (admin only)

SECURITY NOTES
- Passwords are hashed with bcrypt. All SQL uses parameters ($1, $2, ...), never string joining.
- Admin routes check the role in the database on every request (the browser cannot fake it).
- Cart and orders always filter by the logged-in user, so users cannot see each other's data.
- Prices and totals are calculated on the server from the database, never trusted from the browser.
- Placing an order is one database transaction: stock is checked, the order is saved, stock is
  reduced and the cart is emptied together, or nothing happens.
- Input is validated on the server. Uploads: images only (JPG, PNG, GIF, WebP), max 5 MB.

TESTS (optional)
TEST_DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/woober_test npm test
(uses a separate test database, which is emptied on every run - never use your real one)

KNOWN LIMITS (kept simple on purpose)
No online payment, no delivery address, no password reset, and no login rate limiting.
Use HTTPS when putting the site online. Images are stored on the server's disk.
