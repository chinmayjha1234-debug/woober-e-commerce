// Products page: all products with a search box.
const grid = document.getElementById('grid');
const search = document.getElementById('search');
const message = document.getElementById('pageMessage');
let products = [];
let isAdmin = false;

// Shows the products whose name or description contains the search text.
function showProducts() {
  const text = search.value.trim().toLowerCase();
  const shown = products.filter(function (product) {
    return text === '' || (product.name + ' ' + product.description).toLowerCase().includes(text);
  });

  document.getElementById('count').textContent = shown.length + (shown.length === 1 ? ' product' : ' products');

  if (shown.length === 0) {
    grid.className = '';
    grid.innerHTML = '<p class="empty">' + (products.length === 0 ? 'No products yet. Please check back soon.' : 'No products match your search.') + '</p>';
    return;
  }

  let html = '';
  shown.forEach(function (product) {
    html += Woober.productCardHtml(product, isAdmin);
  });
  grid.className = 'item-grid';
  grid.innerHTML = html;
}

async function start() {
  try {
    const user = await Woober.start();
    isAdmin = !!user && user.role === 'admin';
    products = await Woober.listProducts();
    showProducts();
  } catch (err) {
    grid.className = '';
    grid.innerHTML = '<p class="empty">' + Woober.escapeHtml(err.message) + '</p>';
  }
}

search.addEventListener('input', showProducts);
Woober.watchAddButtons(grid, message);
start();
