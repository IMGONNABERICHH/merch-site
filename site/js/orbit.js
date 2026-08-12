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

  /* top/left are % of the hero field; size in px; delay staggers the idle float */
  var LAYOUT = [
    { top: '10%', left: '12%', size: 168, delay: '0s' },
    { top: '4%', left: '54%', size: 132, delay: '-2.1s' },
    { top: '30%', right: '10%', size: 152, delay: '-4.4s' },
    { top: '46%', left: '30%', size: 210, delay: '-1.2s' },
    { top: '58%', left: '6%', size: 118, delay: '-3.6s' },
    { top: '62%', left: '62%', size: 138, delay: '-0.6s' },
    { top: '14%', right: '5%', size: 104, delay: '-5.1s' },
    { top: '68%', right: '4%', size: 122, delay: '-2.8s' },
  ];

  var PULL_RADIUS = 160;
  var MAX_PULL = 26;

  window.renderOrbit = function (products) {
    var hero = document.getElementById('orbit-hero');
    var field = document.getElementById('orbit-field');
    if (!hero || !field) return;
    if (!products || !products.length) { hero.style.display = 'none'; return; }

    var picks = [];
    var i = 0;
    while (picks.length < LAYOUT.length) {
      picks.push(products[i % products.length]);
      i++;
    }

    field.innerHTML = picks.map(function (p, idx) {
      var pos = LAYOUT[idx];
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
