/* ── Orbit shop ──
   The entire product listing: large glass-free circular product photos,
   overlapping and bleeding off the hero's edges, each drifting gently on
   its own and pulling toward the cursor when nearby. Each circle links to
   its product page and carries a small name/price caption, like labels
   under specimens in a catalog spread. */
(function () {
  var api = window.MerchAPI;
  var money = api.money;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* cx/cy = center position as % of the hero field (can bleed past 0/100).
     size = clamp(min, viewport-relative, max) so circles scale with the
     window but stay large. delay staggers the idle float. cap = caption
     anchor so the label sits sensibly relative to the circle. */
  var LAYOUT = [
    { cx: '10%', cy: '48%', size: 'clamp(220px, 27vw, 380px)', delay: '0s', cap: 'below' },
    { cx: '38%', cy: '62%', size: 'clamp(270px, 34vw, 480px)', delay: '-3.2s', cap: 'below' },
    { cx: '66%', cy: '36%', size: 'clamp(250px, 31vw, 440px)', delay: '-1.6s', cap: 'above' },
    { cx: '92%', cy: '64%', size: 'clamp(210px, 25vw, 360px)', delay: '-4.8s', cap: 'below' },
    { cx: '50%', cy: '14%', size: 'clamp(170px, 20vw, 290px)', delay: '-2.4s', cap: 'above' },
    { cx: '80%', cy: '92%', size: 'clamp(150px, 18vw, 260px)', delay: '-5.6s', cap: 'below' },
  ];

  var PULL_RADIUS = 220;
  var MAX_PULL = 40;

  var hero = document.getElementById('orbit-hero');
  var field = document.getElementById('orbit-field');
  if (!hero || !field) return;

  if (api.demoMode) {
    document.getElementById('demo-banner').innerHTML =
      '<div class="demo-banner">Preview mode — placeholder products. Connect the API in js/config.js to go live.</div>';
  }

  api.products()
    .then(function (products) {
      if (!products || !products.length) {
        field.innerHTML = '<div class="drawer-empty">No products yet — check back soon</div>';
        return;
      }
      render(products);
    })
    .catch(function (err) {
      field.innerHTML = '<div class="error-note">Could not load products. ' + esc(err.message) + '</div>';
    });

  function render(products) {
    var count = Math.min(products.length, LAYOUT.length);
    var picks = products.slice(0, count);
    var layout = LAYOUT.slice(0, count);

    field.innerHTML = picks.map(function (p, idx) {
      var pos = layout[idx];
      var priceLabel = money(p.price_min) + (p.variant_count > 1 ? '+' : '');
      return (
        '<a class="orbit-circle" href="product.html?id=' + encodeURIComponent(p.id) + '" ' +
          'style="top:' + pos.cy + ';left:' + pos.cx + ';width:' + pos.size + ';height:' + pos.size + ';z-index:' + (10 + idx) + ';">' +
          '<span class="orbit-circle-float" style="animation-delay:' + pos.delay + ';">' +
            '<span class="orbit-circle-inner">' +
              '<img src="' + esc(p.thumbnail) + '" alt="' + esc(p.name) + '" loading="lazy">' +
              '<span class="orbit-circle-sheen"></span>' +
            '</span>' +
          '</span>' +
          '<span class="orbit-cap orbit-cap-' + pos.cap + '">' +
            '<span class="orbit-cap-name">' + esc(p.name) + '</span>' +
            '<span class="orbit-cap-price">' + priceLabel + '</span>' +
          '</span>' +
        '</a>'
      );
    }).join('');

    var circles = Array.prototype.slice.call(field.querySelectorAll('.orbit-circle-inner'));

    function onMove(e) {
      var mx = e.clientX, my = e.clientY;
      circles.forEach(function (c) {
        var r = c.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dx = mx - cx, dy = my - cy;
        var dist = Math.hypot(dx, dy);
        if (dist < PULL_RADIUS) {
          var pull = (1 - dist / PULL_RADIUS) * MAX_PULL;
          var angle = Math.atan2(dy, dx);
          c.style.transform = 'translate(' + (Math.cos(angle) * pull).toFixed(1) + 'px, ' +
            (Math.sin(angle) * pull).toFixed(1) + 'px) scale(' + (1 + (1 - dist / PULL_RADIUS) * 0.08).toFixed(3) + ')';
        } else {
          c.style.transform = '';
        }
      });
    }

    hero.addEventListener('mousemove', onMove);
    hero.addEventListener('mouseleave', function () {
      circles.forEach(function (c) { c.style.transform = ''; });
    });
  }
})();
