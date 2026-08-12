/* ── Product detail page ── */
(function () {
  const root = document.getElementById('product-root');
  const money = window.MerchAPI.money;
  const id = new URLSearchParams(location.search).get('id');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  if (!id) {
    root.innerHTML = '<div class="error-note">No product selected. <a href="index.html" style="text-decoration:underline">Back to shop</a></div>';
    return;
  }

  window.MerchAPI.product(id)
    .then(render)
    .catch(function (err) {
      root.innerHTML = '<div class="error-note">Could not load this product. ' + esc(err.message) + '</div>';
    });

  function uniq(arr) {
    return arr.filter(function (v, i) { return v && arr.indexOf(v) === i; });
  }

  function render(p) {
    document.title = p.name + " — 7 L'ANGES Merch";
    document.getElementById('crumb-name').textContent = p.name;

    const colors = uniq(p.variants.map(function (v) { return v.color; }));
    const sizes = uniq(p.variants.map(function (v) { return v.size; }));
    let selColor = colors[0] || null;
    let selSize = null;

    root.innerHTML =
      '<div class="product-layout">' +
        '<div class="product-img"><img id="p-img" src="' + esc(p.thumbnail) + '" alt="' + esc(p.name) + '"></div>' +
        '<div>' +
          '<h1 class="product-name">' + esc(p.name) + '</h1>' +
          '<div class="product-price" id="p-price"></div>' +
          (colors.length > 1
            ? '<div class="opt-row"><div class="opt-label">Color</div><div class="opt-pills" id="p-colors"></div></div>'
            : '') +
          (sizes.length > 1 || (sizes[0] && sizes[0] !== 'One size')
            ? '<div class="opt-row"><div class="opt-label">Size</div><div class="opt-pills" id="p-sizes"></div></div>'
            : '') +
          '<button class="btn btn-block" id="p-add" disabled>Add to Cart</button>' +
          (p.description ? '<div class="product-desc">' + p.description.split('\n').filter(Boolean).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>' : '') +
          '<div class="product-note">Ships worldwide<br>Please allow 2–5 business days for production</div>' +
        '</div>' +
      '</div>';

    const priceEl = document.getElementById('p-price');
    const addBtn = document.getElementById('p-add');
    const imgEl = document.getElementById('p-img');

    function variantFor(color, size) {
      return p.variants.find(function (v) {
        return (!color || v.color === color) && (!size || v.size === size);
      });
    }

    function currentVariant() {
      /* single-variant products need no selection */
      if (p.variants.length === 1) return p.variants[0];
      const needSize = sizes.length > 1 || (sizes[0] && sizes[0] !== 'One size');
      if (needSize && !selSize) return null;
      return variantFor(selColor, needSize ? selSize : null) || null;
    }

    function refresh() {
      const v = currentVariant();
      const anyV = v || variantFor(selColor, null) || p.variants[0];
      priceEl.textContent = money(anyV.price) + ' USD';
      if (v && v.image) imgEl.src = v.image;
      else if (!v && selColor) {
        const cv = variantFor(selColor, null);
        if (cv && cv.image) imgEl.src = cv.image;
      }
      addBtn.disabled = !v;
      addBtn.textContent = v ? 'Add to Cart' : 'Select ' + (sizes.length > 1 ? 'a size' : 'options');
    }

    function pills(containerId, values, getSel, setSel) {
      const box = document.getElementById(containerId);
      if (!box) return;
      box.innerHTML = values.map(function (val) {
        return '<button class="opt-pill" data-v="' + esc(val) + '">' + esc(val) + '</button>';
      }).join('');
      box.querySelectorAll('.opt-pill').forEach(function (b) {
        b.onclick = function () {
          setSel(b.dataset.v);
          box.querySelectorAll('.opt-pill').forEach(function (x) {
            x.classList.toggle('selected', x.dataset.v === getSel());
          });
          refresh();
        };
        if (b.dataset.v === getSel()) b.classList.add('selected');
      });
    }

    pills('p-colors', colors, function () { return selColor; }, function (v) { selColor = v; });
    pills('p-sizes', sizes, function () { return selSize; }, function (v) { selSize = v; });

    addBtn.onclick = function () {
      const v = currentVariant();
      if (!v) return;
      window.Cart.add({
        productId: p.id,
        variantId: v.id,
        name: p.name,
        variant: [v.color, v.size].filter(function (x) { return x && x !== 'One size'; }).join(' / ') || 'One size',
        price: v.price,
        image: v.image || p.thumbnail,
      });
    };

    refresh();
  }
})();
