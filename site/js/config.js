/* ── Store configuration ──
   API_BASE: URL of the serverless API that holds the secret keys
   (a Netlify Functions site — see README). Leave empty for demo mode:
   the site renders placeholder products and disables real checkout.

   STRIPE_PUBLISHABLE_KEY: your pk_live_... (or pk_test_...) key.
   Publishable keys are safe to expose in frontend code. */
window.MERCH_CONFIG = {
  API_BASE: '',            // e.g. 'https://7langes-merch-api.netlify.app/.netlify/functions'
  STRIPE_PUBLISHABLE_KEY: '', // e.g. 'pk_live_...'
  MAIN_SITE: 'https://7-langes.com',
};
