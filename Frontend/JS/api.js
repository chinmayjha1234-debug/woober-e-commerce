// This file is the only place where the website talks to the server (backend).
// The other scripts call these functions, for example: Woober.listProducts()

const Woober = {};

// ---------- talking to the server ----------

// Sends a request and returns the answer as an object.
// If the server answers with an error, we throw an Error that contains the server's message.
async function sendRequest(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw new Error('Cannot reach the server. Start it with "npm start" and open http://localhost:3000');
  }

  let data = {};
  try {
    data = await response.json();
  } catch (err) {
    // the answer had no JSON body, that is fine
  }

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.status = response.status; // for example 401 = not logged in
    throw error;
  }
  return data;
}

// Options for sending plain data (login, register, cart, order).
function jsonOptions(method, body) {
  return {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

// Options for sending a form that can contain an image (add and edit product).
function formOptions(method, fields, file) {
  const formData = new FormData();
  for (const key in fields) {
    formData.append(key, fields[key]);
  }
  if (file) {
    formData.append('image', file);
  }
  return { method: method, body: formData };
}

// ---------- account ----------

Woober.register = async function (fields) {
  const data = await sendRequest('/api/register', jsonOptions('POST', fields));
  return data.user;
};

Woober.login = async function (fields) {
  const data = await sendRequest('/api/login', jsonOptions('POST', fields));
  return data.user;
};

Woober.logout = function () {
  return sendRequest('/api/logout', { method: 'POST' });
};

Woober.updateProfile = async function (fields) {
  const data = await sendRequest('/api/me', jsonOptions('PUT', fields));
  return data.user;
};

// Returns the logged-in user, or null if nobody is logged in.
Woober.me = async function () {
  try {
    const data = await sendRequest('/api/me');
    return data.user;
  } catch (err) {
    if (err.status === 401) {
      return null;
    }
    throw err;
  }
};

// Where each kind of user goes after logging in.
Woober.homePageFor = function (user) {
  return user.role === 'admin' ? 'admin-products.html' : 'dashboard.html';
};

// ---------- products ----------

Woober.listProducts = async function () {
  const data = await sendRequest('/api/products');
  return data.products;
};

Woober.getProduct = async function (id) {
  const data = await sendRequest('/api/products/' + encodeURIComponent(id));
  return data.product;
};

// Admin only (the server checks this again).
Woober.addProduct = async function (fields, file) {
  const data = await sendRequest('/api/products', formOptions('POST', fields, file));
  return data.product;
};

Woober.updateProduct = async function (id, fields, file) {
  const data = await sendRequest('/api/products/' + id, formOptions('PUT', fields, file));
  return data.product;
};

Woober.deleteProduct = function (id) {
  return sendRequest('/api/products/' + id, { method: 'DELETE' });
};

// ---------- cart ----------

Woober.getCart = function () {
  return sendRequest('/api/cart');
};

// Adds a product. If the visitor is not logged in, we send them to the login page.
Woober.addToCart = async function (productId, quantity) {
  try {
    const cart = await sendRequest('/api/cart', jsonOptions('POST', { productId: productId, quantity: quantity || 1 }));
    Woober.showCartCount(cart.count);
    return cart;
  } catch (err) {
    if (err.status === 401) {
      location.href = 'login.html';
    }
    throw err;
  }
};

Woober.setCartQuantity = async function (cartItemId, quantity) {
  const cart = await sendRequest('/api/cart/' + cartItemId, jsonOptions('PUT', { quantity: quantity }));
  Woober.showCartCount(cart.count);
  return cart;
};

Woober.removeCartItem = async function (cartItemId) {
  const cart = await sendRequest('/api/cart/' + cartItemId, { method: 'DELETE' });
  Woober.showCartCount(cart.count);
  return cart;
};

// ---------- orders ----------

Woober.placeOrder = async function () {
  const data = await sendRequest('/api/orders', { method: 'POST' });
  Woober.showCartCount(0);
  return data.order;
};

Woober.listOrders = async function () {
  const data = await sendRequest('/api/orders');
  return data.orders;
};

// Admin only
Woober.listAllOrders = async function () {
  const data = await sendRequest('/api/admin/orders');
  return data.orders;
};

Woober.setOrderStatus = async function (id, status) {
  const data = await sendRequest('/api/admin/orders/' + id, jsonOptions('PUT', { status: status }));
  return data.order;
};

// ---------- page setup (header, login checks) ----------

// Shows the number of items in the "Cart" link of the header.
Woober.showCartCount = function (count) {
  const link = document.getElementById('cartLink');
  if (link) {
    link.textContent = count > 0 ? 'Cart (' + count + ')' : 'Cart';
  }
};

// Adds the links that depend on who is logged in, and the Log in / Log out buttons.
function buildHeader(user) {
  const nav = document.querySelector('.main-nav');
  const actions = document.querySelector('.header-actions');
  if (!nav || !actions) {
    return;
  }

  let links = [];
  if (user && user.role === 'admin') {
    links = [['admin-products.html', 'Manage products'], ['admin-orders.html', 'All orders'], ['dashboard.html', 'Account']];
  } else if (user) {
    links = [['cart.html', 'Cart', 'cartLink'], ['orders.html', 'My orders'], ['dashboard.html', 'Account']];
  }

  const page = location.pathname.split('/').pop() || 'index.html';
  links.forEach(function (link) {
    const a = document.createElement('a');
    a.href = link[0];
    a.textContent = link[1];
    if (link[2]) {
      a.id = link[2];
    }
    if (link[0] === page) {
      a.className = 'active';
    }
    nav.appendChild(a);
  });

  if (user) {
    actions.innerHTML = '<button class="button button-dark button-small" id="logoutBtn" type="button">Log out</button>';
    document.getElementById('logoutBtn').addEventListener('click', async function () {
      await Woober.logout();
      location.href = 'login.html';
    });
  } else {
    // On phones the header link is hidden (see common.css), so the menu gets its own "Log in" link.
    const menuLogin = document.createElement('a');
    menuLogin.href = 'login.html';
    menuLogin.className = 'nav-login';
    menuLogin.textContent = 'Log in';
    nav.appendChild(menuLogin);

    actions.innerHTML = '<a class="login-link" href="login.html">Log in</a>' +
      '<a class="button button-dark button-small" href="register.html">Sign up</a>';
  }
}

// Call this at the top of every page. Options:
//   { login: true }  -> only logged-in users may see the page (others go to the login page)
//   { admin: true }  -> only admins may see the page (others go to the home page)
// Returns the logged-in user (or null on public pages when nobody is logged in).
Woober.start = async function (options) {
  options = options || {};
  const user = await Woober.me();

  if ((options.login || options.admin) && !user) {
    location.replace('login.html');
    return null;
  }
  if (options.admin && user.role !== 'admin') {
    location.replace('index.html');
    return null;
  }

  buildHeader(user);
  if (user && user.role === 'customer') {
    Woober.getCart().then(function (cart) { Woober.showCartCount(cart.count); }).catch(function () {});
  }
  return user;
};

// ---------- small helpers used by several pages ----------

// Makes text safe to put inside HTML, so a name like <script> is shown as text and never runs.
Woober.escapeHtml = function (text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// HTML for the picture of a product (a grey box if it has no image).
Woober.imageHtml = function (imageUrl, name) {
  if (!imageUrl) {
    return '<div class="no-image">No image</div>';
  }
  return '<img src="' + Woober.escapeHtml(imageUrl) + '" alt="' + Woober.escapeHtml(name) + '">';
};

Woober.formatPrice = function (price) {
  return '₹' + Number(price).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

Woober.formatDate = function (dateText) {
  return new Date(dateText).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// HTML for one product card (used on the home page and the products page).
Woober.productCardHtml = function (product, isAdmin) {
  const inStock = product.stock > 0;
  let html = '<article class="item-card">' +
    '<a class="media" href="product.html?id=' + product.id + '">' + Woober.imageHtml(product.imageUrl, product.name) + '</a>' +
    '<div class="item-body">' +
      '<h3><a href="product.html?id=' + product.id + '">' + Woober.escapeHtml(product.name) + '</a></h3>' +
      '<div class="item-meta"><span class="price">' + Woober.formatPrice(product.price) + '</span>' +
      (inStock ? '<span class="chip">In stock</span>' : '<span class="chip chip-out">Out of stock</span>') + '</div>' +
      '<p class="short-desc">' + Woober.escapeHtml(product.description) + '</p>' +
      '<div class="card-actions">' +
        '<a class="button button-small button-outline" href="product.html?id=' + product.id + '">Details</a>';
  if (!isAdmin) {
    html += '<button class="button button-small" type="button" data-add="' + product.id + '"' + (inStock ? '' : ' disabled') + '>Add to cart</button>';
  }
  html += '</div></div></article>';
  return html;
};

// Shows a message in a page element. isError = true makes it red.
Woober.showMessage = function (element, text, isError) {
  element.textContent = text;
  element.className = isError ? 'form-message error' : 'form-message';
};

// Makes every "Add to cart" button inside a container work (one listener for all buttons).
Woober.watchAddButtons = function (container, messageElement) {
  container.addEventListener('click', async function (event) {
    const button = event.target.closest('[data-add]');
    if (!button) {
      return;
    }
    button.disabled = true;
    try {
      await Woober.addToCart(Number(button.dataset.add), 1);
      Woober.showMessage(messageElement, 'Added to your cart.', false);
    } catch (err) {
      Woober.showMessage(messageElement, err.message, true);
    }
    button.disabled = false;
  });
};
