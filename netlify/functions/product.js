/* GET /product?id=... — one product with variants (size/color/price/image)
   plus the catalog description for the underlying garment. */
const { json, preflight, printful } = require('./lib/util');

exports.handler = async function (event) {
  const pf = preflight(event);
  if (pf) return pf;
  if (event.httpMethod !== 'GET') return json(event, 405, { error: 'Method not allowed' });

  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) return json(event, 400, { error: 'Missing product id' });

  try {
    const detail = await printful('/store/products/' + encodeURIComponent(id));
    const sp = detail.sync_product;
    const svs = detail.sync_variants;

    /* Catalog lookup: gives us description + size/color per catalog variant */
    let description = '';
    const catalogById = {};
    if (svs.length) {
      try {
        const first = await printful('/products/variant/' + svs[0].variant_id);
        const catalog = await printful('/products/' + first.product.id);
        description = (catalog.product && catalog.product.description) || '';
        (catalog.variants || []).forEach(function (v) { catalogById[v.id] = v; });
      } catch (e) {
        /* description is nice-to-have; variants still render from sync data */
      }
    }

    function previewImage(sv) {
      const files = sv.files || [];
      const preview = files.filter(function (f) { return f.type === 'preview' && f.preview_url; }).pop();
      return (preview && preview.preview_url) || sp.thumbnail_url;
    }

    const variants = svs.map(function (sv) {
      const cat = catalogById[sv.variant_id] || {};
      return {
        id: sv.id,
        price: sv.retail_price,
        size: cat.size || null,
        color: cat.color || null,
        image: previewImage(sv),
        in_stock: sv.availability_status ? sv.availability_status === 'active' : true,
      };
    });

    return json(event, 200, {
      product: {
        id: sp.id,
        name: sp.name,
        thumbnail: sp.thumbnail_url,
        description: description,
        variants: variants,
      },
    });
  } catch (err) {
    return json(event, err.status === 404 ? 404 : 502, { error: err.message });
  }
};
