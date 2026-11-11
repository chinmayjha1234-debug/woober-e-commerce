// Shared JavaScript for Woober's multi-page frontend: mobile menu, footer year, login and register forms.
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    // One listener for all links (some links are added later by api.js).
    nav.addEventListener('click', e => {
      if (e.target.closest('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.querySelectorAll('.year').forEach(el => el.textContent = new Date().getFullYear());

  // Login page
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const user = await Woober.login({ email: document.getElementById('loginEmail').value, password: document.getElementById('loginPassword').value });
      location.href = Woober.homePageFor(user);
    } catch (err) {
      document.getElementById('loginMessage').textContent = err.message;
    }
  });

  // Register page
  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const password = document.getElementById('registerPassword').value;
    const message = document.getElementById('registerMessage');
    if (password !== document.getElementById('registerPassword2').value) {
      message.textContent = 'The two passwords do not match.';
      return;
    }
    try {
      await Woober.register({
        name: document.getElementById('registerName').value,
        email: document.getElementById('registerEmail').value,
        password: password
      });
      location.href = 'dashboard.html';
    } catch (err) {
      message.textContent = err.message;
    }
  });
});
