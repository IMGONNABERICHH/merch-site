/* ── Catalog page ── */
(function () {
  const grid = document.getElementById('catalog');
  const money = window.MerchAPI.money;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  if (window.MerchAPI.demoMode) {
    document.getElementById('demo-banner').innerHTML =
      '<div class="demo-banner">Preview mode — placeholder products. Connect the API in js/config.js to go live.</div>';
  }

  window.MerchAPI.products()
    .then(function (products) {
      if (window.renderOrbit) window.renderOrbit(products);
      if (!products.length) {
        grid.innerHTML = '<div class="drawer-empty" style="grid-column:1/-1">No products yet — check back soon</div>';
        return;
      }
      grid.innerHTML = products.map(function (p, i) {
        return (
          '<a class="shop-item" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
            '<div class="shop-item-img">' +
              '<img src="' + esc(p.thumbnail) + '" alt="' + esc(p.name) + '" loading="lazy">' +
              '<span class="shop-item-index">' + String(i + 1).padStart(2, '0') + '</span>' +
            '</div>' +
            '<div class="shop-item-meta">' +
              '<span class="shop-item-name">' + esc(p.name) + '</span>' +
              '<span class="shop-item-price">' + money(p.price_min) + (p.variant_count > 1 ? '+' : '') + '</span>' +
            '</div>' +
          '</a>'
        );
      }).join('');
      document.getElementById('catalog-meta').textContent =
        String(products.length).padStart(2, '0') + ' Items';
    })
    .catch(function (err) {
      grid.innerHTML = '<div class="error-note" style="grid-column:1/-1">Could not load products. ' + esc(err.message) + '</div>';
    });
})();
