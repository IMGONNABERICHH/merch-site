/* ── Store configuration ──
   API_BASE: URL of the serverless API that holds the secret keys
   (a Netlify Functions site — see README). Leave empty for demo mode:
   the site renders placeholder products and disables real checkout.

   STRIPE_PUBLISHABLE_KEY: your pk_live_... (or pk_test_...) key.
   Publishable keys are safe to expose in frontend code. */
window.MERCH_CONFIG = {
  API_BASE: 'https://bright-kashata-af865d.netlify.app/.netlify/functions',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_51U3Wce7ywGv01exS89HTFumXSGWqeTBFhfTAACFfZcBMU1oBTRT22zXQI2Hf4nWoe3kkRdUDaHF4wGRZcdxv2iff00rLY4vbgN',
  MAIN_SITE: 'https://7-langes.com',
};
