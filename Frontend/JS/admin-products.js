// Admin page: add, edit and delete products (the "CRUD" page).

const form = document.getElementById('productForm');
const list = document.getElementById('list');
const message = document.getElementById('formMessage');

let products = [];     // the products shown in the list
let editingId = null;  // id of the product being edited, or null when adding a new one

function showMessage(text, isError) {
  Woober.showMessage(message, text, isError);
}

// Puts the form back to "add new product" mode.
function resetForm() {
  editingId = null;
  form.reset();
  document.getElementById('formKicker').textContent = 'ADD NEW PRODUCT';
  document.getElementById('submitBtn').textContent = 'Add product';
  document.getElementById('cancelBtn').hidden = true;
  document.getElementById('imageHint').textContent = 'JPG, PNG, GIF or WebP, up to 5 MB.';
}

// READ: show all products in the list.
function showList() {
  document.getElementById('count').textContent = products.length + (products.length === 1 ? ' product' : ' products');

  if (products.length === 0) {
    list.innerHTML = '<p class="empty">No products yet. Use the form to add the first one.</p>';
    return;
  }

  let html = '';
  products.forEach(function (product) {
    html += '<div class="manage-row">' +
      '<div class="thumb">' + Woober.imageHtml(product.imageUrl, product.name) + '</div>' +
      '<div class="info"><b>' + Woober.escapeHtml(product.name) + '</b>' +
        '<span>' + Woober.formatPrice(product.price) + ' · Stock: ' + product.stock + '</span></div>' +
      '<div class="actions">' +
        '<button class="button button-small button-outline" type="button" data-action="edit" data-id="' + product.id + '">Edit</button>' +
        '<button class="button button-small button-danger" type="button" data-action="delete" data-id="' + product.id + '">Delete</button>' +
      '</div></div>';
  });
  list.innerHTML = html;
}

async function loadProducts() {
  products = await Woober.listProducts();
  showList();
}

// UPDATE (step 1): fill the form with the product's current values.
function startEdit(product) {
  editingId = product.id;
  document.getElementById('name').value = product.name;
  document.getElementById('price').value = product.price;
  document.getElementById('stock').value = product.stock;
  document.getElementById('description').value = product.description;
  document.getElementById('image').value = '';
  document.getElementById('formKicker').textContent = 'EDIT PRODUCT';
  document.getElementById('submitBtn').textContent = 'Save changes';
  document.getElementById('cancelBtn').hidden = false;
  document.getElementById('imageHint').textContent = product.imageUrl
    ? 'This product already has an image. Choose a new one only to replace it.'
    : 'No image yet. JPG, PNG, GIF or WebP, up to 5 MB.';
  showMessage('', false);
  form.scrollIntoView();
}

// DELETE: ask first, then remove.
async function removeProduct(product) {
  if (!confirm('Delete "' + product.name + '"? This cannot be undone.')) {
    return;
  }
  try {
    await Woober.deleteProduct(product.id);
    if (editingId === product.id) {
      resetForm();
    }
    showMessage('Product deleted.', false);
    await loadProducts();
  } catch (err) {
    showMessage(err.message, true);
  }
}

// One click listener for all Edit and Delete buttons in the list.
list.addEventListener('click', function (event) {
  const id = event.target.dataset.id;
  const action = event.target.dataset.action;
  if (!id) {
    return; // the click was not on a button
  }
  const product = products.find(function (p) { return p.id == id; });
  if (!product) {
    return;
  }
  if (action === 'edit') {
    startEdit(product);
  } else if (action === 'delete') {
    removeProduct(product);
  }
});

// CREATE or UPDATE: runs when the form is submitted.
form.addEventListener('submit', async function (event) {
  event.preventDefault(); // stop the page from reloading

  const fields = {
    name: document.getElementById('name').value,
    price: document.getElementById('price').value,
    stock: document.getElementById('stock').value,
    description: document.getElementById('description').value
  };
  const image = document.getElementById('image').files[0]; // undefined if no image chosen

  try {
    if (editingId) {
      await Woober.updateProduct(editingId, fields, image);
      showMessage('Changes saved.', false);
    } else {
      await Woober.addProduct(fields, image);
      showMessage('Product added.', false);
    }
    resetForm();
    await loadProducts();
  } catch (err) {
    showMessage(err.message, true);
  }
});

document.getElementById('cancelBtn').addEventListener('click', function () {
  resetForm();
  showMessage('', false);
});

// Start: check that this is an admin, then load the products.
async function start() {
  try {
    const user = await Woober.start({ admin: true });
    if (user) {
      await loadProducts();
    }
  } catch (err) {
    showMessage(err.message, true);
  }
}
start();
