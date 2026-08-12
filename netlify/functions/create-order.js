/* POST /create-order — after Stripe confirms payment, create the Printful order.

   Safety checks before any order is created:
     1. The PaymentIntent exists and its status is "succeeded".
     2. The items sent now match the fingerprint stored on the PaymentIntent.
     3. Totals are recomputed from Printful and must equal the amount paid.
     4. Idempotent: a PaymentIntent that already produced an order returns it.

   By default orders are created as DRAFTS in Printful (you approve them in
   the dashboard). Set PRINTFUL_CONFIRM_ORDERS=true to auto-fulfill. */
const {
  json, preflight, printful, stripe,
  computeTotals, requireRecipient, itemsFingerprint,
} = require('./lib/util');

exports.handler = async function (event) {
  const pf = preflight(event);
  if (pf) return pf;
  if (event.httpMethod !== 'POST') return json(event, 405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const piId = String(body.payment_intent_id || '');
    if (!/^pi_[A-Za-z0-9]+$/.test(piId)) throw new Error('Invalid payment reference');
    const recipient = requireRecipient(body.recipient);

    /* 1 · verify the payment server-side */
    const pi = await stripe('GET', '/v1/payment_intents/' + piId);
    if (pi.status !== 'succeeded') throw new Error('Payment not completed (status: ' + pi.status + ')');

    /* 4 · idempotency — refresh/double-submit returns the same order */
    if (pi.metadata && pi.metadata.printful_order_id) {
      return json(event, 200, { order_id: pi.metadata.printful_order_id, already_existed: true });
    }

    /* 2 + 3 · recompute and compare against what was actually paid */
    const t = await computeTotals(body.items, recipient, body.shipping_rate_id || (pi.metadata && pi.metadata.shipping_rate_id));
    if (itemsFingerprint(t.resolved) !== (pi.metadata && pi.metadata.items)) {
      throw new Error('Cart does not match the payment');
    }
    const paidCents = pi.amount_received;
    const dueCents = Math.round(t.total * 100);
    if (paidCents !== dueCents) throw new Error('Paid amount does not match order total');

    /* create the Printful order */
    const confirm = process.env.PRINTFUL_CONFIRM_ORDERS === 'true';
    const order = await printful('/orders' + (confirm ? '?confirm=true' : ''), {
      method: 'POST',
      body: {
        external_id: piId,
        shipping: t.rate.id,
        recipient: recipient,
        items: t.resolved.map(function (i) {
          return {
            sync_variant_id: i.sync_variant_id,
            quantity: i.quantity,
            retail_price: i.retail_price.toFixed(2),
          };
        }),
        retail_costs: {
          subtotal: t.subtotal.toFixed(2),
          shipping: t.shipping.toFixed(2),
          total: t.total.toFixed(2),
        },
      },
    });

    /* remember the order on the PaymentIntent for idempotency + reconciliation */
    await stripe('POST', '/v1/payment_intents/' + piId, {
      metadata: { printful_order_id: String(order.id) },
    });

    return json(event, 200, { order_id: order.id, status: order.status });
  } catch (err) {
    return json(event, 400, { error: err.message });
  }
};
