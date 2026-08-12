/* Shared helpers for the merch API functions.
   Secrets come from Netlify environment variables:
     PRINTFUL_API_KEY        (required) Printful private token
     PRINTFUL_STORE_ID       (required for account-level tokens) e.g. 14493667
     STRIPE_SECRET_KEY       (required) sk_live_... / sk_test_...
     PRINTFUL_CONFIRM_ORDERS (optional) "true" to submit orders for fulfillment
                             immediately; otherwise orders arrive as drafts you
                             approve in the Printful dashboard.
     ALLOWED_ORIGINS         (optional) comma-separated extra CORS origins */

const PRINTFUL_API = 'https://api.printful.com';
const STRIPE_API = 'https://api.stripe.com';

const DEFAULT_ORIGINS = [
  'https://merch.7-langes.com',
  'https://7-langes.github.io',
];

function corsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  const allowed = DEFAULT_ORIGINS.concat(extra);
  const ok = allowed.indexOf(origin) !== -1 || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function json(event, status, data) {
  return { statusCode: status, headers: corsHeaders(event), body: JSON.stringify(data) };
}

function preflight(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(event), body: '' };
  }
  return null;
}

async function printful(path, opts) {
  opts = opts || {};
  const headers = {
    Authorization: 'Bearer ' + process.env.PRINTFUL_API_KEY,
    'Content-Type': 'application/json',
  };
  if (process.env.PRINTFUL_STORE_ID) headers['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;

  const res = await fetch(PRINTFUL_API + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    const msg = (data && (data.error && data.error.message || data.result)) || ('Printful error ' + res.status);
    const err = new Error(typeof msg === 'string' ? msg : 'Printful error ' + res.status);
    err.status = res.status;
    throw err;
  }
  return data.result;
}

/* Stripe REST without the SDK: form-encoded params, supports nested keys. */
function formEncode(obj, prefix, out) {
  out = out || [];
  Object.keys(obj).forEach(function (k) {
    const v = obj[k];
    if (v === undefined || v === null) return;
    const key = prefix ? prefix + '[' + k + ']' : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
  });
  return out;
}

async function stripe(method, path, params) {
  const res = await fetch(STRIPE_API + path, {
    method: method,
    headers: {
      Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? formEncode(params).join('&') : undefined,
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    throw new Error((data.error && data.error.message) || 'Stripe error ' + res.status);
  }
  return data;
}

/* ── order math, always recomputed server-side from Printful data ── */

async function resolveItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Cart is empty');
  if (items.length > 30) throw new Error('Too many line items');

  const resolved = await Promise.all(items.map(async function (i) {
    const qty = parseInt(i.quantity, 10);
    if (!qty || qty < 1 || qty > 50) throw new Error('Invalid quantity');
    const sv = await printful('/store/variants/' + encodeURIComponent(i.sync_variant_id));
    return {
      sync_variant_id: sv.id,
      catalog_variant_id: sv.variant_id,
      name: sv.name,
      retail_price: parseFloat(sv.retail_price),
      quantity: qty,
    };
  }));
  return resolved;
}

function requireRecipient(r) {
  if (!r) throw new Error('Missing shipping address');
  ['name', 'address1', 'city', 'country_code', 'zip'].forEach(function (f) {
    if (!r[f] || !String(r[f]).trim()) throw new Error('Missing address field: ' + f);
  });
  return {
    name: String(r.name).slice(0, 100),
    address1: String(r.address1).slice(0, 200),
    address2: r.address2 ? String(r.address2).slice(0, 200) : undefined,
    city: String(r.city).slice(0, 100),
    state_code: r.state_code ? String(r.state_code).slice(0, 10) : undefined,
    country_code: String(r.country_code).slice(0, 2).toUpperCase(),
    zip: String(r.zip).slice(0, 20),
    phone: r.phone ? String(r.phone).slice(0, 30) : undefined,
    email: r.email ? String(r.email).slice(0, 200) : undefined,
  };
}

async function shippingRates(recipient, resolvedItems) {
  const result = await printful('/shipping/rates', {
    method: 'POST',
    body: {
      recipient: {
        address1: recipient.address1,
        city: recipient.city,
        country_code: recipient.country_code,
        state_code: recipient.state_code,
        zip: recipient.zip,
      },
      items: resolvedItems.map(function (i) {
        return { variant_id: i.catalog_variant_id, quantity: i.quantity };
      }),
    },
  });
  return result.map(function (r) {
    return {
      id: r.id,
      name: r.name,
      rate: r.rate,
      minDays: r.minDeliveryDays,
      maxDays: r.maxDeliveryDays,
    };
  });
}

/* Returns {resolved, subtotal, shipping, total, rate} — all money as float dollars. */
async function computeTotals(items, recipient, shippingRateId) {
  const resolved = await resolveItems(items);
  const subtotal = resolved.reduce(function (n, i) { return n + i.retail_price * i.quantity; }, 0);

  const rates = await shippingRates(recipient, resolved);
  if (!rates.length) throw new Error('No shipping methods available for this address');
  const rate = rates.find(function (r) { return r.id === shippingRateId; }) || rates[0];

  const shipping = parseFloat(rate.rate);
  const total = Math.round((subtotal + shipping) * 100) / 100;
  return { resolved: resolved, subtotal: subtotal, shipping: shipping, total: total, rate: rate };
}

function itemsFingerprint(resolved) {
  return resolved
    .map(function (i) { return i.sync_variant_id + ':' + i.quantity; })
    .sort()
    .join(',');
}

module.exports = {
  corsHeaders: corsHeaders,
  json: json,
  preflight: preflight,
  printful: printful,
  stripe: stripe,
  resolveItems: resolveItems,
  requireRecipient: requireRecipient,
  shippingRates: shippingRates,
  computeTotals: computeTotals,
  itemsFingerprint: itemsFingerprint,
};
