// The AMap JS key is a browser credential and must be restricted to the
// production and preview domains in the AMap console. Never put the
// securityJsCode here; keep it in the Cloudflare Worker secret store.
window.TRAVEL_ROLLS_CONFIG = Object.freeze({
  amapKey: "",
  amapServiceHost: "https://travel-rolls-map-proxy.xuebing277.workers.dev",
  // Set this to the full application Worker URL after D1, R2 and Resend are deployed.
  // Keep it blank in the public prototype so the UI never pretends authentication succeeded.
  apiBase: "",
});
