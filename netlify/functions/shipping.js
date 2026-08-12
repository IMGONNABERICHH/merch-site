/* POST /shipping — quote shipping rates for a cart + address. */
const { json, preflight, resolveItems, requireRecipient, shippingRates } = require('./lib/util');

exports.handler = async function (event) {
  const pf = preflight(event);
  if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(event, 405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const recipient = requireRecipient(body.recipient);
    const resolved = await resolveItems(body.items);
    const rates = await shippingRates(recipient, resolved);
    return json(event, 200, { rates: rates });
  } catch (err) {
    return json(event, 400, { error: err.message });
  }
};
