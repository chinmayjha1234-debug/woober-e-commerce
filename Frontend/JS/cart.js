// Cart page: change quantities, remove items, see the total and place the order.
const list = document.getElementById('cartList');
const summary = document.getElementById('summary');
const message = document.getElementById('pageMessage');
let cart = { items: [], total: 0, count: 0 };

function showCart() {
  if (cart.items.length === 0) {
    list.innerHTML = '<p class="empty">Your cart is empty. <a href="products.html">Browse products</a>.</p>';
    summary.hidden = true;
    return;
  }

  let html = '';
  cart.items.forEach(function (item) {
    html += '<div class="manage-row">' +
      '<div class="thumb">' + Woober.imageHtml(item.imageUrl, item.name) + '</div>' +
      '<div class="info"><b>' + Woober.escapeHtml(item.name) + '</b>' +
        '<span>' + Woober.formatPrice(item.price) + ' each · Subtotal ' + Woober.formatPrice(item.subtotal) + '</span></div>' +
      '<div class="actions">' +
        '<input class="qty-input" type="number" min="1" max="' + Math.max(1, Math.min(item.stock, 99)) + '" value="' + item.quantity + '" data-qty="' + item.id + '" aria-label="Quantity">' +
        '<button class="button button-small button-danger" type="button" data-remove="' + item.id + '">Remove</button>' +
      '</div></div>';
  });
  list.innerHTML = html;
  document.getElementById('total').textContent = Woober.formatPrice(cart.total);
  document.getElementById('itemCount').textContent = cart.count + (cart.count === 1 ? ' item' : ' items');
  summary.hidden = false;
}

// Runs a cart request, then refreshes the page. Shows the error if something goes wrong.
async function change(action) {
  try {
    cart = await action();
    Woober.showMessage(message, '', false);
  } catch (err) {
    Woober.showMessage(message, err.message, true);
    cart = await Woober.getCart(); // show the real quantities again
  }
  showCart();
}

list.addEventListener('click', function (event) {
  const id = event.target.dataset.remove;
  if (id) {
    change(function () { return Woober.removeCartItem(id); });
  }
});

// A new quantity is saved when the box loses focus or Enter is pressed.
list.addEventListener('change', function (event) {
  const id = event.target.dataset.qty;
  if (id) {
    change(function () { return Woober.setCartQuantity(id, Number(event.target.value)); });
  }
});

document.getElementById('orderBtn').addEventListener('click', async function () {
  const button = this;
  button.disabled = true;
  try {
    await Woober.placeOrder();
    location.href = 'orders.html?placed=1';
  } catch (err) {
    Woober.showMessage(message, err.message, true);
    button.disabled = false;
    cart = await Woober.getCart();
    showCart();
  }
});

async function start() {
  try {
    const user = await Woober.start({ login: true });
    if (!user) {
      return;
    }
    cart = await Woober.getCart();
    showCart();
  } catch (err) {
    list.innerHTML = '<p class="empty">' + Woober.escapeHtml(err.message) + '</p>';
  }
}
start();
