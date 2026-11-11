// Product details page: product.html?id=3
const box = document.getElementById('detail');
const message = document.getElementById('pageMessage');

async function start() {
  try {
    const user = await Woober.start();
    const id = new URLSearchParams(location.search).get('id');
    const product = await Woober.getProduct(id);
    const isAdmin = !!user && user.role === 'admin';
    const inStock = product.stock > 0;

    document.title = product.name + ' — Woober';
    let html = '<div class="detail-image">' + Woober.imageHtml(product.imageUrl, product.name) + '</div>' +
      '<div class="detail-info">' +
        '<h1>' + Woober.escapeHtml(product.name) + '</h1>' +
        '<p class="detail-price">' + Woober.formatPrice(product.price) + '</p>' +
        (inStock
          ? '<p><span class="chip">In stock</span> <span class="stock-note">' + product.stock + ' available</span></p>'
          : '<p><span class="chip chip-out">Out of stock</span></p>') +
        '<p class="full-desc">' + Woober.escapeHtml(product.description || 'No description.') + '</p>';

    if (isAdmin) {
      html += '<p><a class="button button-outline" href="admin-products.html">Manage products</a></p>';
    } else {
      html += '<div class="buy-row">' +
        '<label class="sr-only" for="quantity">Quantity</label>' +
        '<input id="quantity" type="number" min="1" max="' + Math.max(1, Math.min(product.stock, 99)) + '" value="1"' + (inStock ? '' : ' disabled') + '>' +
        '<button class="button" id="addBtn" type="button"' + (inStock ? '' : ' disabled') + '>Add to cart</button>' +
        '</div>';
    }
    html += '</div>';
    box.innerHTML = html;

    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
      addBtn.addEventListener('click', async function () {
        const quantity = Number(document.getElementById('quantity').value);
        try {
          await Woober.addToCart(product.id, quantity);
          Woober.showMessage(message, 'Added to your cart.', false);
        } catch (err) {
          Woober.showMessage(message, err.message, true);
        }
      });
    }
  } catch (err) {
    box.innerHTML = '<p class="empty">' + Woober.escapeHtml(err.message) + ' <a href="products.html">Back to products</a></p>';
  }
}
start();
