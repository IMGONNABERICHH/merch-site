/* ── Cart: localStorage state + slide-over drawer ── */
(function () {
  const KEY = '7l_merch_cart';
  const money = window.MerchAPI.money;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    renderBadge();
    renderDrawer();
  }

  const Cart = {
    items: load,
    count: function () { return load().reduce(function (n, i) { return n + i.qty; }, 0); },
    subtotal: function () { return load().reduce(function (n, i) { return n + parseFloat(i.price) * i.qty; }, 0); },

    add: function (item, qty) {
      const items = load();
      const found = items.find(function (i) { return i.variantId === item.variantId; });
      if (found) found.qty += (qty || 1);
      else items.push(Object.assign({}, item, { qty: qty || 1 }));
      save(items);
      toast('Added to cart');
      openDrawer();
    },

    setQty: function (variantId, qty) {
      let items = load();
      if (qty <= 0) items = items.filter(function (i) { return i.variantId !== variantId; });
      else items.forEach(function (i) { if (i.variantId === variantId) i.qty = qty; });
      save(items);
    },

    remove: function (variantId) { Cart.setQty(variantId, 0); },
    clear: function () { save([]); },
  };
  window.Cart = Cart;

  /* ── Drawer UI (injected so every page shares it) ── */
  let drawer, backdrop, toastEl;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function inject() {
    backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    backdrop.onclick = closeDrawer;

    drawer = document.createElement('aside');
    drawer.className = 'drawer';
    drawer.innerHTML =
      '<div class="drawer-head">' +
        '<span class="drawer-title">Cart</span>' +
        '<button class="text-link" id="drawer-close">Close &nbsp;✕</button>' +
      '</div>' +
      '<div class="drawer-items" id="drawer-items"></div>' +
      '<div class="drawer-foot">' +
        '<div class="drawer-subtotal"><span>Subtotal</span><span id="drawer-subtotal">$0.00</span></div>' +
        '<div class="drawer-ship-note">Shipping calculated at checkout</div>' +
        '<a class="btn btn-block" id="drawer-checkout" href="checkout.html">Checkout</a>' +
      '</div>';

    toastEl = document.createElement('div');
    toastEl.className = 'toast';

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    document.body.appendChild(toastEl);
    drawer.querySelector('#drawer-close').onclick = closeDrawer;

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    const trigger = document.getElementById('cart-trigger');
    if (trigger) trigger.onclick = function () { openDrawer(); };

    renderBadge();
    renderDrawer();
  }

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('open');
    backdrop.classList.add('open');
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
  }
  window.openCartDrawer = openDrawer;

  function renderBadge() {
    const el = document.getElementById('cart-count');
    if (el) el.textContent = Cart.count();
  }

  function renderDrawer() {
    if (!drawer) return;
    const box = drawer.querySelector('#drawer-items');
    const items = load();

    if (!items.length) {
      box.innerHTML = '<div class="drawer-empty">Your cart is empty</div>';
    } else {
      box.innerHTML = items.map(function (i) {
        return (
          '<div class="cart-line">' +
            '<img class="cart-line-img" src="' + esc(i.image) + '" alt="">' +
            '<div>' +
              '<div class="cart-line-name">' + esc(i.name) + '</div>' +
              '<div class="cart-line-variant">' + esc(i.variant) + '</div>' +
              '<div class="cart-qty">' +
                '<button data-dec="' + i.variantId + '">−</button>' +
                '<span>' + i.qty + '</span>' +
                '<button data-inc="' + i.variantId + '">+</button>' +
              '</div>' +
            '</div>' +
            '<div class="cart-line-right">' +
              '<span class="cart-line-price">' + money(parseFloat(i.price) * i.qty) + '</span>' +
              '<button class="cart-remove" data-rm="' + i.variantId + '">Remove</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      box.querySelectorAll('[data-dec]').forEach(function (b) {
        b.onclick = function () {
          const it = load().find(function (i) { return String(i.variantId) === b.dataset.dec; });
          if (it) Cart.setQty(it.variantId, it.qty - 1);
        };
      });
      box.querySelectorAll('[data-inc]').forEach(function (b) {
        b.onclick = function () {
          const it = load().find(function (i) { return String(i.variantId) === b.dataset.inc; });
          if (it) Cart.setQty(it.variantId, it.qty + 1);
        };
      });
      box.querySelectorAll('[data-rm]').forEach(function (b) {
        b.onclick = function () {
          const it = load().find(function (i) { return String(i.variantId) === b.dataset.rm; });
          if (it) Cart.remove(it.variantId);
        };
      });
    }

    drawer.querySelector('#drawer-subtotal').textContent = money(Cart.subtotal());
    const checkoutBtn = drawer.querySelector('#drawer-checkout');
    checkoutBtn.style.display = items.length ? '' : 'none';
  }

  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
