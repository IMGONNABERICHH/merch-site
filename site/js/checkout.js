/* ── Checkout flow: address → shipping rate → Stripe payment → Printful order ── */
(function () {
  const cfg = window.MERCH_CONFIG;
  const api = window.MerchAPI;
  const money = api.money;
  const Cart = window.Cart;

  const COUNTRIES = [
    ['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'],
    ['AU', 'Australia'], ['DE', 'Germany'], ['FR', 'France'], ['NL', 'Netherlands'],
    ['ES', 'Spain'], ['IT', 'Italy'], ['SE', 'Sweden'], ['JP', 'Japan'],
    ['NZ', 'New Zealand'], ['IE', 'Ireland'], ['MX', 'Mexico'], ['BR', 'Brazil'],
  ];

  const US_STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
  const CA_PROVINCES = 'AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' ');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showError(msg) {
    const box = document.getElementById('payment-error');
    box.innerHTML = msg ? '<div class="error-note">' + esc(msg) + '</div>' : '';
  }

  /* ── state ── */
  let recipient = null;
  let rates = [];
  let selectedRate = null;
  let stripe = null, elements = null;
  let paymentIntentId = null;
  let totals = { subtotal: Cart.subtotal(), shipping: null, total: null };

  function cartItems() {
    return Cart.items().map(function (i) {
      return { sync_variant_id: i.variantId, quantity: i.qty };
    });
  }

  /* ── returning from a redirect payment method (e.g. bank redirects) ── */
  const qs = new URLSearchParams(location.search);
  if (qs.get('payment_intent') && qs.get('redirect_status')) {
    handleRedirectReturn(qs);
    return;
  }

  /* ── empty cart guard ── */
  if (!Cart.items().length) {
    document.getElementById('checkout-root').innerHTML =
      '<div><div class="drawer-empty" style="text-align:left;padding:20px 0 40px">Your cart is empty</div>' +
      '<a class="btn" href="index.html">Back to Shop</a></div>';
    return;
  }

  renderSummary();
  initCountries();

  if (api.demoMode || !cfg.STRIPE_PUBLISHABLE_KEY) {
    showError('Checkout is not live yet — the store API and Stripe key are not configured. See README for setup.');
  }

  /* ══ STEP 1 · address ══ */
  const form = document.getElementById('address-form');

  function initCountries() {
    const cSel = document.getElementById('f-country');
    cSel.innerHTML = COUNTRIES.map(function (c) {
      return '<option value="' + c[0] + '">' + c[1] + '</option>';
    }).join('');
    cSel.onchange = updateStates;
    updateStates();
  }

  function updateStates() {
    const country = document.getElementById('f-country').value;
    const group = document.getElementById('state-group');
    const sSel = document.getElementById('f-state');
    const list = country === 'US' ? US_STATES : country === 'CA' ? CA_PROVINCES : null;
    if (list) {
      group.style.display = '';
      sSel.required = true;
      sSel.innerHTML = '<option value="" disabled selected>Select</option>' +
        list.map(function (s) { return '<option>' + s + '</option>'; }).join('');
    } else {
      group.style.display = 'none';
      sSel.required = false;
      sSel.innerHTML = '';
    }
  }

  form.onsubmit = function (e) {
    e.preventDefault();
    recipient = {
      name: document.getElementById('f-name').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      address1: document.getElementById('f-address1').value.trim(),
      address2: document.getElementById('f-address2').value.trim(),
      city: document.getElementById('f-city').value.trim(),
      state_code: document.getElementById('f-state').value || '',
      country_code: document.getElementById('f-country').value,
      zip: document.getElementById('f-zip').value.trim(),
    };

    const btn = document.getElementById('address-continue');
    btn.disabled = true;
    btn.textContent = 'Calculating…';

    api.shippingRates(recipient, cartItems())
      .then(function (r) {
        rates = r;
        renderRates();
        document.getElementById('shipping-body').classList.remove('locked');
        document.getElementById('shipping-body').scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function (err) { showError('Could not get shipping rates: ' + err.message); })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Recalculate Shipping';
      });
  };

  /* ══ STEP 2 · shipping method ══ */
  function renderRates() {
    const box = document.getElementById('ship-options');
    if (!rates.length) {
      box.innerHTML = '<div class="error-note">No shipping options available for this address.</div>';
      return;
    }
    selectedRate = rates[0];
    box.innerHTML = rates.map(function (r, i) {
      const eta = (r.minDays && r.maxDays) ? r.minDays + '–' + r.maxDays + ' business days' : '';
      return (
        '<div class="ship-option' + (i === 0 ? ' selected' : '') + '" data-i="' + i + '">' +
          '<div><div class="ship-option-name">' + esc(r.name) + '</div>' +
          (eta ? '<div class="ship-option-eta">' + eta + '</div>' : '') + '</div>' +
          '<span class="ship-option-price">' + money(r.rate) + '</span>' +
        '</div>'
      );
    }).join('');

    box.querySelectorAll('.ship-option').forEach(function (el) {
      el.onclick = function () {
        selectedRate = rates[parseInt(el.dataset.i, 10)];
        box.querySelectorAll('.ship-option').forEach(function (x) { x.classList.remove('selected'); });
        el.classList.add('selected');
        updateTotals();
      };
    });

    document.getElementById('shipping-continue').disabled = false;
    updateTotals();
  }

  document.getElementById('shipping-continue').onclick = function () {
    if (!selectedRate) return;
    if (api.demoMode || !cfg.STRIPE_PUBLISHABLE_KEY) {
      showError('Checkout is not live yet — the store API and Stripe key are not configured. See README for setup.');
      document.getElementById('payment-body').classList.remove('locked');
      return;
    }
    startPayment();
  };

  /* ══ STEP 3 · payment ══ */
  function startPayment() {
    const btn = document.getElementById('shipping-continue');
    btn.disabled = true;
    btn.textContent = 'Preparing payment…';
    showError('');

    api.createPaymentIntent({
      items: cartItems(),
      recipient: recipient,
      shipping_rate_id: selectedRate.id,
      email: recipient.email,
    })
      .then(function (res) {
        paymentIntentId = res.payment_intent_id;
        totals = { subtotal: res.subtotal, shipping: res.shipping, total: res.total };
        updateTotals();

        stripe = Stripe(cfg.STRIPE_PUBLISHABLE_KEY);
        elements = stripe.elements({
          clientSecret: res.client_secret,
          appearance: {
            theme: 'night',
            variables: {
              colorBackground: '#0b0b0b',
              colorText: '#ece8e1',
              colorPrimary: '#ece8e1',
              fontFamily: 'Inter, system-ui, sans-serif',
              borderRadius: '0px',
            },
          },
        });
        elements.create('payment').mount('#payment-element');

        document.getElementById('payment-body').classList.remove('locked');
        document.getElementById('pay-btn').disabled = false;
        document.getElementById('payment-body').scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function (err) { showError(err.message); })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Continue to Payment';
      });
  }

  document.getElementById('pay-btn').onclick = function () {
    if (!stripe || !elements) return;
    const btn = document.getElementById('pay-btn');
    btn.disabled = true;
    btn.textContent = 'Processing…';
    showError('');

    /* Save context in case the payment method redirects away and back */
    sessionStorage.setItem('7l_pending_order', JSON.stringify({
      recipient: recipient,
      items: cartItems(),
      shipping_rate_id: selectedRate.id,
      totals: totals,
    }));

    stripe.confirmPayment({
      elements: elements,
      confirmParams: { return_url: location.origin + location.pathname },
      redirect: 'if_required',
    }).then(function (result) {
      if (result.error) {
        showError(result.error.message);
        btn.disabled = false;
        btn.textContent = 'Pay Now';
        return;
      }
      placeOrder(result.paymentIntent.id);
    });
  };

  function placeOrder(piId) {
    const pending = JSON.parse(sessionStorage.getItem('7l_pending_order') || 'null');
    api.createOrder({
      payment_intent_id: piId,
      recipient: (pending && pending.recipient) || recipient,
      items: (pending && pending.items) || cartItems(),
      shipping_rate_id: (pending && pending.shipping_rate_id) || (selectedRate && selectedRate.id),
    })
      .then(function (res) {
        sessionStorage.setItem('7l_last_order', JSON.stringify({
          order_id: res.order_id,
          email: (pending && pending.recipient.email) || (recipient && recipient.email),
          total: (pending && pending.totals.total) || totals.total,
        }));
        sessionStorage.removeItem('7l_pending_order');
        Cart.clear();
        location.href = 'confirmation.html?order=' + encodeURIComponent(res.order_id);
      })
      .catch(function (err) {
        /* Payment went through but order creation failed — tell the customer
           clearly; the payment reference lets the studio reconcile manually. */
        showError('Your payment succeeded, but the order could not be registered automatically. ' +
          'Please email hello@7-langes.com with payment reference ' + piId + ' — we will sort it out. (' + err.message + ')');
        const btn = document.getElementById('pay-btn');
        btn.textContent = 'Payment Complete';
      });
  }

  function handleRedirectReturn(params) {
    document.getElementById('checkout-steps').innerHTML = '<div class="loading">Finalizing your order</div>';
    if (params.get('redirect_status') !== 'succeeded') {
      document.getElementById('checkout-steps').innerHTML =
        '<div class="error-note">Payment was not completed. Your cart is untouched — you can try again.</div>' +
        '<a class="btn" href="checkout.html">Back to Checkout</a>';
      return;
    }
    renderSummary();
    placeOrder(params.get('payment_intent'));
  }

  /* ── summary sidebar ── */
  function renderSummary() {
    const box = document.getElementById('summary-items');
    box.innerHTML = Cart.items().map(function (i) {
      return (
        '<div class="summary-line">' +
          '<img src="' + esc(i.image) + '" alt="">' +
          '<div><div class="summary-line-name">' + esc(i.name) + '</div>' +
          '<div class="summary-line-variant">' + esc(i.variant) + ' · Qty ' + i.qty + '</div></div>' +
          '<span class="summary-line-price">' + money(parseFloat(i.price) * i.qty) + '</span>' +
        '</div>'
      );
    }).join('');
    updateTotals();
  }

  function updateTotals() {
    const sub = totals.subtotal != null ? parseFloat(totals.subtotal) : Cart.subtotal();
    const ship = totals.shipping != null ? parseFloat(totals.shipping)
      : selectedRate ? parseFloat(selectedRate.rate) : null;
    document.getElementById('sum-subtotal').textContent = money(sub);
    document.getElementById('sum-shipping').textContent = ship != null ? money(ship) : '—';
    document.getElementById('sum-total').textContent = ship != null ? money(sub + ship) : '—';
  }
})();
