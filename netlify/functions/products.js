/* GET /products — catalog listing with price range, cached in-memory for 5 min. */
const { json, preflight, printful } = require('./lib/util');

let cache = null;
let cacheAt = 0;
const TTL = 5 * 60 * 1000;

exports.handler = async function (event) {
  const pf = preflight(event);
  if (pf) return pf;
  if (event.httpMethod !== 'GET') return json(event, 405, { error: 'Method not allowed' });

  try {
    if (cache && Date.now() - cacheAt < TTL) return json(event, 200, { products: cache });

    const list = await printful('/store/products?limit=100');
    const products = await Promise.all(list.map(async function (p) {
      const detail = await printful('/store/products/' + p.id);
      const prices = detail.sync_variants
        .map(function (v) { return parseFloat(v.retail_price); })
        .filter(function (n) { return !isNaN(n); });
      return {
        id: p.id,
        name: p.name,
        thumbnail: p.thumbnail_url,
        price_min: prices.length ? Math.min.apply(null, prices).toFixed(2) : null,
        variant_count: detail.sync_variants.length,
      };
    }));

    cache = products;
    cacheAt = Date.now();
    return json(event, 200, { products: products });
  } catch (err) {
    return json(event, err.status === 404 ? 404 : 502, { error: err.message });
  }
};
