// Orders page: the logged-in user's previous orders.
const list = document.getElementById('orderList');
const message = document.getElementById('pageMessage');

// HTML for the lines of one order (shared idea with admin-orders.js).
function itemsHtml(order) {
  let html = '<ul class="order-lines">';
  order.items.forEach(function (item) {
    html += '<li><span>' + Woober.escapeHtml(item.name) + ' × ' + item.quantity + '</span><span>' + Woober.formatPrice(item.price * item.quantity) + '</span></li>';
  });
  return html + '</ul>';
}

async function start() {
  try {
    const user = await Woober.start({ login: true });
    if (!user) {
      return;
    }
    if (new URLSearchParams(location.search).get('placed')) {
      Woober.showMessage(message, 'Thank you! Your order has been placed.', false);
    }

    const orders = await Woober.listOrders();
    if (orders.length === 0) {
      list.innerHTML = '<p class="empty">You have not placed any orders yet. <a href="products.html">Start shopping</a>.</p>';
      return;
    }
    let html = '';
    orders.forEach(function (order) {
      html += '<section class="panel order-box">' +
        '<div class="panel-head"><h2>Order #' + order.id + '</h2>' +
        '<span class="chip' + (order.status === 'completed' ? ' chip-done' : '') + '">' + Woober.escapeHtml(order.status) + '</span></div>' +
        '<p class="order-date">Placed on ' + Woober.formatDate(order.createdAt) + '</p>' +
        itemsHtml(order) +
        '<p class="order-total">Total: ' + Woober.formatPrice(order.total) + '</p>' +
        '</section>';
    });
    list.innerHTML = html;
  } catch (err) {
    list.innerHTML = '<p class="empty">' + Woober.escapeHtml(err.message) + '</p>';
  }
}
start();
