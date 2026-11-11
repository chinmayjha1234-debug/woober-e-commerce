// Dashboard page: profile (view and update), a few numbers and quick links.
// Customers see their orders and cart. Admins see shop numbers and links to the admin pages.

const profileForm = document.getElementById('profileForm');
const profileMessage = document.getElementById('profileMessage');

// Writes the user's details into the profile box and the edit form.
function showProfile(user) {
  document.getElementById('welcomeName').textContent = user.name;
  document.getElementById('pName').textContent = user.name;
  document.getElementById('pEmail').textContent = user.email;
  document.getElementById('pRole').textContent = user.role === 'admin' ? 'Administrator' : 'Customer';
  document.getElementById('pSince').textContent = Woober.formatDate(user.createdAt);
  document.getElementById('editName').value = user.name;
  document.getElementById('editEmail').value = user.email;
}

// Small number box: <div class="stat"><b>5</b><span>Orders</span></div>
function statHtml(value, label) {
  return '<div class="stat"><b>' + Woober.escapeHtml(value) + '</b><span>' + label + '</span></div>';
}

// Quick link card
function linkHtml(href, icon, title, text) {
  return '<a class="info-card" href="' + href + '"><span class="info-icon">' + icon + '</span><h3>' + title + '</h3><p>' + text + '</p></a>';
}

async function showCustomerOverview() {
  const results = await Promise.all([Woober.listOrders(), Woober.getCart()]);
  const orders = results[0];
  const cart = results[1];

  let spentCents = 0;
  orders.forEach(function (order) { spentCents += Math.round(order.total * 100); });

  document.getElementById('stats').innerHTML =
    statHtml(orders.length, 'Orders placed') +
    statHtml(Woober.formatPrice(spentCents / 100), 'Total spent') +
    statHtml(cart.count, 'Items in cart') +
    statHtml(orders.length > 0 ? Woober.formatDate(orders[0].createdAt) : '—', 'Latest order');

  document.getElementById('links').innerHTML =
    linkHtml('cart.html', '🛒', 'My cart', 'Review the items you want to buy.') +
    linkHtml('orders.html', '▦', 'My orders', 'See everything you have ordered before.');
}

async function showAdminOverview() {
  const results = await Promise.all([Woober.listProducts(), Woober.listAllOrders()]);
  const products = results[0];
  const orders = results[1];
  const pending = orders.filter(function (order) { return order.status === 'pending'; }).length;

  document.getElementById('stats').innerHTML =
    statHtml(products.length, 'Products') +
    statHtml(orders.length, 'Orders') +
    statHtml(pending, 'Pending orders') +
    statHtml(products.filter(function (p) { return p.stock === 0; }).length, 'Out of stock');

  document.getElementById('links').innerHTML =
    linkHtml('admin-products.html', '＋', 'Manage products', 'Add, edit or delete products.') +
    linkHtml('admin-orders.html', '▦', 'All orders', 'See the orders placed by customers.');
}

// UPDATE the profile
profileForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  try {
    const user = await Woober.updateProfile({
      name: document.getElementById('editName').value,
      email: document.getElementById('editEmail').value,
      currentPassword: document.getElementById('currentPassword').value,
      newPassword: document.getElementById('newPassword').value
    });
    showProfile(user);
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    Woober.showMessage(profileMessage, 'Profile updated.', false);
  } catch (err) {
    Woober.showMessage(profileMessage, err.message, true);
  }
});

async function start() {
  try {
    const user = await Woober.start({ login: true });
    if (!user) {
      return;
    }
    showProfile(user);
    if (user.role === 'admin') {
      document.getElementById('subtitle').textContent = 'Here is a quick look at your shop.';
      await showAdminOverview();
    } else {
      await showCustomerOverview();
    }
  } catch (err) {
    document.getElementById('stats').textContent = err.message;
  }
}
start();
