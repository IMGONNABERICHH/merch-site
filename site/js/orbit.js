/* ── Floating orbit hero ──
   Large glass-like circular product photos, overlapping and bleeding off
   the hero's edges, each drifting gently on its own and pulling toward
   the cursor when it's nearby — snapping back when the mouse moves away. */
(function () {
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* cx/cy = center position as % of the hero field (can bleed past 0/100).
     size = clamp(min, viewport-relative, max) so circles scale with the
     window but stay large. delay staggers the idle float. */
  var LAYOUT = [
    { cx: '6%', cy: '46%', size: 'clamp(240px, 30vw, 420px)', delay: '0s' },
    { cx: '34%', cy: '58%', size: 'clamp(300px, 38vw, 520px)', delay: '-3.2s' },
    { cx: '64%', cy: '38%', size: 'clamp(280px, 35vw, 480px)', delay: '-1.6s' },
    { cx: '94%', cy: '60%', size: 'clamp(230px, 28vw, 400px)', delay: '-4.8s' },
    { cx: '48%', cy: '14%', size: 'clamp(190px, 22vw, 320px)', delay: '-2.4s' },
    { cx: '80%', cy: '90%', size: 'clamp(170px, 20vw, 280px)', delay: '-5.6s' },
  ];

  var PULL_RADIUS = 220;
  var MAX_PULL = 40;

  window.renderOrbit = function (products) {
    var hero = document.getElementById('orbit-hero');
    var field = document.getElementById('orbit-field');
    if (!hero || !field) return;
    if (!products || !products.length) { hero.style.display = 'none'; return; }

    /* one circle per unique product — never repeat the same item */
    var count = Math.min(products.length, LAYOUT.length);
    var picks = products.slice(0, count);
    var layout = LAYOUT.slice(0, count);

    field.innerHTML = picks.map(function (p, idx) {
      var pos = layout[idx];
      return (
        '<a class="orbit-circle" href="product.html?id=' + encodeURIComponent(p.id) + '" ' +
          'style="top:' + pos.cy + ';left:' + pos.cx + ';width:' + pos.size + ';height:' + pos.size + ';z-index:' + (10 + idx) + ';">' +
          '<span class="orbit-circle-float" style="animation-delay:' + pos.delay + ';">' +
            '<span class="orbit-circle-inner">' +
              '<img src="' + esc(p.thumbnail) + '" alt="' + esc(p.name) + '" loading="lazy">' +
              '<span class="orbit-circle-sheen"></span>' +
            '</span>' +
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
  };
})();
