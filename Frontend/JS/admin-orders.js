// Admin page: all customer orders. The admin can mark an order as completed.
const list = document.getElementById('orderList');
const message = document.getElementById('pageMessage');
let orders = [];

function showOrders() {
  document.getElementById('count').textContent = orders.length + (orders.length === 1 ? ' order' : ' orders');

  if (orders.length === 0) {
    list.innerHTML = '<p class="empty">No orders yet.</p>';
    return;
  }

  let html = '';
  orders.forEach(function (order) {
    const done = order.status === 'completed';
    let lines = '<ul class="order-lines">';
    order.items.forEach(function (item) {
      lines += '<li><span>' + Woober.escapeHtml(item.name) + ' × ' + item.quantity + '</span><span>' + Woober.formatPrice(item.price * item.quantity) + '</span></li>';
    });
    lines += '</ul>';

    html += '<section class="panel order-box">' +
      '<div class="panel-head"><h2>Order #' + order.id + '</h2>' +
      '<span class="chip' + (done ? ' chip-done' : '') + '">' + Woober.escapeHtml(order.status) + '</span></div>' +
      '<p class="order-date">' + Woober.escapeHtml(order.customerName) + ' (' + Woober.escapeHtml(order.customerEmail) + ') · ' + Woober.formatDate(order.createdAt) + '</p>' +
      lines +
      '<p class="order-total">Total: ' + Woober.formatPrice(order.total) + '</p>' +
      '<button class="button button-small ' + (done ? 'button-outline' : '') + '" type="button" data-id="' + order.id + '" data-status="' + (done ? 'pending' : 'completed') + '">' +
        (done ? 'Mark as pending' : 'Mark as completed') + '</button>' +
      '</section>';
  });
  list.innerHTML = html;
}

list.addEventListener('click', async function (event) {
  const id = event.target.dataset.id;
  if (!id) {
    return;
  }
  try {
    const updated = await Woober.setOrderStatus(id, event.target.dataset.status);
    orders = orders.map(function (order) { return order.id === updated.id ? updated : order; });
    Woober.showMessage(message, '', false);
    showOrders();
  } catch (err) {
    Woober.showMessage(message, err.message, true);
  }
});

async function start() {
  try {
    const user = await Woober.start({ admin: true });
    if (!user) {
      return;
    }
    orders = await Woober.listAllOrders();
    showOrders();
  } catch (err) {
    list.innerHTML = '<p class="empty">' + Woober.escapeHtml(err.message) + '</p>';
  }
}
start();
