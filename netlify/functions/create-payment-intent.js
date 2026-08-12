/* POST /create-payment-intent — recompute totals from Printful (never trust
   client prices), then open a Stripe PaymentIntent for that exact amount. */
const { json, preflight, stripe, computeTotals, requireRecipient, itemsFingerprint } = require('./lib/util');

exports.handler = async function (event) {
  const pf = preflight(event);
  if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(event, 405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const recipient = requireRecipient(body.recipient);
    const t = await computeTotals(body.items, recipient, body.shipping_rate_id);
    const amountCents = Math.round(t.total * 100);
    if (amountCents < 50) throw new Error('Order total too small');

    const pi = await stripe('POST', '/v1/payment_intents', {
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: 'true' },
      receipt_email: recipient.email || undefined,
      description: "7 L'ANGES merch order",
      metadata: {
        items: itemsFingerprint(t.resolved).slice(0, 490),
        shipping_rate_id: t.rate.id,
        subtotal: t.subtotal.toFixed(2),
        shipping: t.shipping.toFixed(2),
      },
    });

    return json(event, 200, {
      client_secret: pi.client_secret,
      payment_intent_id: pi.id,
      subtotal: t.subtotal.toFixed(2),
      shipping: t.shipping.toFixed(2),
      total: t.total.toFixed(2),
    });
  } catch (err) {
    return json(event, 400, { error: err.message });
  }
};
