/* ── Floating orbit hero ──
   Circular product photos scattered over the black hero, each drifting
   gently on its own, and pulling toward the cursor when it's nearby —
   snapping back when the mouse moves away. */
(function () {
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* top/left are % of the hero field; size in px; delay staggers the idle float.
     Ordered so the first 4 entries alone (our current product count) land in
     all four corners — later entries only kick in once more products exist. */
  var LAYOUT = [
    { top: '10%', left: '10%', size: 160, delay: '0s' },
    { top: '12%', right: '8%', size: 142, delay: '-2.1s' },
    { top: '58%', left: '8%', size: 132, delay: '-4.4s' },
    { top: '56%', right: '8%', size: 152, delay: '-1.2s' },
    { top: '40%', left: '34%', size: 208, delay: '-3.6s' },
    { top: '2%', left: '52%', size: 108, delay: '-0.6s' },
    { top: '70%', left: '54%', size: 116, delay: '-5.1s' },
    { top: '32%', right: '30%', size: 94, delay: '-2.8s' },
  ];

  var PULL_RADIUS = 160;
  var MAX_PULL = 26;

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
      var hpos = pos.right ? ('right:' + pos.right) : ('left:' + pos.left);
      return (
        '<a class="orbit-circle" href="product.html?id=' + encodeURIComponent(p.id) + '" ' +
          'style="top:' + pos.top + ';' + hpos + ';width:' + pos.size + 'px;height:' + pos.size + 'px;animation-delay:' + pos.delay + ';">' +
          '<span class="orbit-circle-inner">' +
            '<img src="' + esc(p.thumbnail) + '" alt="' + esc(p.name) + '" loading="lazy">' +
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
            (Math.sin(angle) * pull).toFixed(1) + 'px) scale(' + (1 + (1 - dist / PULL_RADIUS) * 0.06).toFixed(3) + ')';
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
