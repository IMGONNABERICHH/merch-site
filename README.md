# 7 L'ANGES — Merch

Custom storefront for **merch.7-langes.com**. Static frontend (GitHub Pages) +
a tiny serverless API (Netlify Functions) that talks to Printful and Stripe.
No build step, no npm dependencies — hand-coded HTML/CSS/JS matching 7-langes.com.

```
site/                      ← the storefront (deploys to GitHub Pages)
  index.html               catalog
  product.html?id=…        product detail (variants, sizes)
  checkout.html            address → shipping rate → Stripe payment
  confirmation.html        order number + what's next
  js/config.js             ⚠ the only file you edit to go live
netlify/functions/         ← the API (deploys to Netlify; holds secret keys)
  products.js  product.js  shipping.js
  create-payment-intent.js create-order.js
.github/workflows/deploy.yml   auto-deploy to Pages on push to main
```

**Why two hosts?** GitHub Pages can only serve static files — any secret key
placed there is public. The Printful and Stripe secret keys live only in
Netlify environment variables; the functions proxy the two APIs and re-verify
every price server-side, so nobody can tamper with totals from the browser.

Until `js/config.js` is filled in, the site runs in **preview mode** with
placeholder products and checkout disabled — safe to deploy immediately.

---

## Go-live checklist

### 1 · GitHub repo + Pages
1. Create the repo (e.g. `github.com/7-langes/merch-site`), then from this folder:
   ```
   git remote add origin git@github.com:7-langes/merch-site.git
   git push -u origin main
   ```
2. Repo **Settings → Pages** → Source: **GitHub Actions**. The included
   workflow deploys `site/` on every push to `main`.
3. Still in Pages settings, set **Custom domain** = `merch.7-langes.com`,
   and tick **Enforce HTTPS** once the cert is issued (a few minutes after DNS).

### 2 · DNS
Wherever `7-langes.com`'s DNS lives, add:

| Type  | Name    | Value                  |
|-------|---------|------------------------|
| CNAME | `merch` | `<github-username>.github.io` |

(For an org repo under `7-langes`, that's `7-langes.github.io`.)
GitHub provisions the SSL certificate automatically after the CNAME resolves.

### 3 · API on Netlify
1. Netlify → **Add new project → Import from Git** → pick this same repo.
   `netlify.toml` already sets functions dir; name the site something like
   `7langes-merch-api`.
2. **Site configuration → Environment variables**, add:
   - `PRINTFUL_API_KEY` — Printful → Settings → Developers → Tokens.
     Scope it to the **7 L'ANGES** store.
   - `PRINTFUL_STORE_ID` — `14493667` (the 7 L'ANGES store).
   - `STRIPE_SECRET_KEY` — Stripe dashboard → Developers → API keys (`sk_…`).
   - `PRINTFUL_CONFIRM_ORDERS` — leave unset at first. Orders arrive as
     **drafts** you approve in Printful. Set to `true` later for hands-off
     fulfillment (Printful then charges your card/wallet automatically).
3. Redeploy the Netlify site after adding the variables.

### 4 · Wire the frontend
Edit `site/js/config.js`:
```js
API_BASE: 'https://7langes-merch-api.netlify.app/.netlify/functions',
STRIPE_PUBLISHABLE_KEY: 'pk_live_…',   // publishable key is safe in frontend
```
Commit + push → Pages redeploys → store is live.

### 5 · Test before announcing
Use Stripe **test mode** keys first (`sk_test_` / `pk_test_`), buy something
with card `4242 4242 4242 4242`, confirm a draft order appears in Printful,
then swap to live keys.

---

## Notes & gotchas
- **Prices** come from each variant's *retail price* set in Printful; the
  API refuses any checkout where the paid amount doesn't match Printful's
  current prices + live shipping rate.
- **The 7 L'ANGES Printful store is a TikTok Shop integration store.** API
  reads and API orders work against it via `X-PF-Store-Id`. If Printful ever
  rejects API order creation for that store type, create a "Manual order / API"
  store in Printful, re-add the four products from your templates, and point
  `PRINTFUL_STORE_ID` at it — nothing else changes.
- **Sales tax** is not collected at checkout. For US sales Printful may add
  tax to *your* fulfillment cost. When volume justifies it, enable Stripe Tax
  in `create-payment-intent.js`.
- **Refunds/failed order creation**: if payment succeeds but the Printful
  order can't be created, the customer is shown the Stripe payment reference
  and asked to email the studio; find the charge in Stripe by that reference.
- Duplicate protection: an order is created at most once per payment
  (Stripe metadata + Printful `external_id` both enforce it).
