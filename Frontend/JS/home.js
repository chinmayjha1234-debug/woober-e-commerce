// Home page: shows the 4 newest products.
async function startHome() {
  const featured = document.getElementById('featured');
  const message = document.getElementById('pageMessage');
  try {
    const user = await Woober.start();
    const products = await Woober.listProducts();

    if (products.length === 0) {
      featured.className = '';
      featured.innerHTML = '<p class="empty">No products yet. Please check back soon.</p>';
      return;
    }
    let html = '';
    products.slice(0, 4).forEach(function (product) {
      html += Woober.productCardHtml(product, user && user.role === 'admin');
    });
    featured.innerHTML = html;
    Woober.watchAddButtons(featured, message);
  } catch (err) {
    featured.className = '';
    featured.innerHTML = '<p class="empty">' + Woober.escapeHtml(err.message) + '</p>';
  }
}
startHome();
