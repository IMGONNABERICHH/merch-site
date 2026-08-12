/* ── API client + demo-mode fallback ── */
(function () {
  const cfg = window.MERCH_CONFIG;
  const DEMO = !cfg.API_BASE;

  /* Placeholder art for demo mode: monochrome SVG in the brand style. */
  function ph(label) {
    const svg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'>" +
      "<rect width='800' height='1000' fill='%230f0f0f'/>" +
      "<text x='400' y='480' fill='%23ece8e1' fill-opacity='0.85' font-family='Georgia,serif' font-size='44' font-style='italic' text-anchor='middle'>" + label + "</text>" +
      "<text x='400' y='540' fill='%23555555' font-family='Helvetica,Arial,sans-serif' font-size='15' letter-spacing='6' text-anchor='middle'>7 L'ANGES</text>" +
      "</svg>";
    return 'data:image/svg+xml;utf8,' + svg;
  }

  const SIZES5 = ['S', 'M', 'L', 'XL', '2XL'];

  function demoVariants(id, colors, sizes, price) {
    const out = [];
    let n = 1;
    colors.forEach(function (c) {
      sizes.forEach(function (s) {
        out.push({ id: id * 100 + n++, price: price, size: s, color: c, in_stock: true });
      });
    });
    return out;
  }

  const DEMO_PRODUCTS = [
    { id: 1, name: 'Classic Logo Tee in 7 L’ANGES Cotton Fabric', thumbnail: ph('Classic Logo Tee'), price_min: '30.00', variant_count: 10,
      variants: demoVariants(1, ['Black', 'White'], SIZES5, '30.00'),
      description: 'Heavyweight cotton tee with the 7 L’ANGES classic logo. Cut boxy, printed to order in Los Angeles.' },
    { id: 2, name: 'Bleu Classic “7L’ANGES” White Tee', thumbnail: ph('Bleu Classic Tee'), price_min: '28.00', variant_count: 6,
      variants: demoVariants(2, ['White'], ['XS'].concat(SIZES5), '28.00'),
      description: 'The Bleu Classic mark in cobalt on bone white cotton.' },
    { id: 3, name: '7 L’ANGES Classic Logo Hoodie', thumbnail: ph('Classic Logo Hoodie'), price_min: '55.00', variant_count: 8,
      variants: demoVariants(3, ['Black', 'Bone'], ['S', 'M', 'L', 'XL'], '55.00'),
      description: 'Midweight fleece hoodie, classic logo across the chest.' },
    { id: 4, name: '7L’ANGES Staple Bag', thumbnail: ph('Staple Bag'), price_min: '22.00', variant_count: 1,
      variants: [{ id: 401, price: '22.00', size: 'One size', color: 'Natural', in_stock: true }],
      description: 'Canvas tote for records, tapes, and everything after the shoot.' },
  ];

  async function call(path, opts) {
    const res = await fetch(cfg.API_BASE + path, opts);
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
    return data;
  }

  function post(path, body) {
    return call(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  window.MerchAPI = {
    demoMode: DEMO,

    money: function (v) {
      const n = typeof v === 'string' ? parseFloat(v) : v;
      return '$' + n.toFixed(2);
    },

    products: function () {
      if (DEMO) return Promise.resolve(DEMO_PRODUCTS.map(function (p) {
        return { id: p.id, name: p.name, thumbnail: p.thumbnail, price_min: p.price_min, variant_count: p.variant_count };
      }));
      return call('/products').then(function (d) { return d.products; });
    },

    product: function (id) {
      if (DEMO) {
        const p = DEMO_PRODUCTS.find(function (x) { return String(x.id) === String(id); });
        return p ? Promise.resolve(p) : Promise.reject(new Error('Product not found'));
      }
      return call('/product?id=' + encodeURIComponent(id)).then(function (d) { return d.product; });
    },

    shippingRates: function (recipient, items) {
      if (DEMO) return Promise.resolve([
        { id: 'STANDARD', name: 'Flat Rate (demo)', rate: '4.99', minDays: 4, maxDays: 8 },
        { id: 'EXPRESS', name: 'Express (demo)', rate: '14.99', minDays: 1, maxDays: 3 },
      ]);
      return post('/shipping', { recipient: recipient, items: items }).then(function (d) { return d.rates; });
    },

    createPaymentIntent: function (payload) { return post('/create-payment-intent', payload); },
    createOrder: function (payload) { return post('/create-order', payload); },
  };
})();
