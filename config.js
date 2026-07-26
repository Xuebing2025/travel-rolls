// The AMap JS key is a browser credential and must be restricted to the
// production and preview domains in the AMap console. Never put the
// securityJsCode here; keep it in the Cloudflare Worker secret store.
window.TRAVEL_ROLLS_CONFIG = Object.freeze({
  amapKey: "",
  amapServiceHost: "https://travel-rolls-map-proxy.xuebing277.workers.dev",
  apiBase: "https://api.xbgzh.site",
});
