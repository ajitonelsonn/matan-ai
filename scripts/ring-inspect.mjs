#!/usr/bin/env node
/**
 * Read-only inspection of the Ring Partner API with a Ring Developer Playground token.
 *
 *   RING_PLAYGROUND_TOKEN=<token> pnpm ring:inspect            (token from the Playground, valid 30 min)
 *   RING_PLAYGROUND_TOKEN=<token> pnpm ring:inspect --raw      (also print raw JSON, still with the token masked)
 *
 * Calls only GET endpoints (users/me, accounts/me/subscriptions, devices + status/capabilities/location/
 * configurations, history). The token is never printed, written or logged; it is read from the environment only.
 */
const base = process.env.RING_API_BASE_URL ?? "https://api.amazonvision.com";
const token = process.env.RING_PLAYGROUND_TOKEN?.trim();
const raw = process.argv.includes("--raw");
if (!token) { console.error("Set RING_PLAYGROUND_TOKEN (Playground → Get token) in the environment for this command only."); process.exit(1); }

async function get(path) {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json, application/json" } });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text: text.slice(0, 300) };
}
const shape = (v, depth = 0) => {
  if (v === null || v === undefined) return String(v);
  if (Array.isArray(v)) return v.length ? `[${shape(v[0], depth + 1)} ×${v.length}]` : "[]";
  if (typeof v === "object") return depth > 3 ? "{…}" : `{ ${Object.entries(v).map(([k, x]) => `${k}: ${shape(x, depth + 1)}`).join(", ")} }`;
  if (typeof v === "string") return v.length > 60 ? JSON.stringify(v.slice(0, 57) + "…") : JSON.stringify(v);
  return String(v);
};
const report = (label, r) => { console.log(`\n▶ ${label} → HTTP ${r.status}`); if (r.json) { const d = r.json.data; console.log("  data:", shape(d)); if (r.json.included) console.log("  included types:", [...new Set(r.json.included.map((i) => i.type))].join(", ")); if (r.json.meta) console.log("  meta:", shape(r.json.meta)); if (r.json.errors) console.log("  errors:", shape(r.json.errors)); if (raw) console.log(JSON.stringify(r.json, null, 2)); } else console.log("  body:", r.text); return r; };

const me = report("GET /v1/users/me", await get("/v1/users/me"));
report("GET /v1/accounts/me/subscriptions", await get("/v1/accounts/me/subscriptions"));
report("GET /v1/accounts/me/app-integrations (read attempt)", await get("/v1/accounts/me/app-integrations"));
const devices = report("GET /v1/devices?include=status,capabilities,location,configurations", await get("/v1/devices?include=status,capabilities,location,configurations"));
const list = Array.isArray(devices.json?.data) ? devices.json.data : devices.json?.data ? [devices.json.data] : [];
console.log(`\n  devices returned: ${list.length}`);
for (const d of list) {
  const id = d.id;
  console.log(`\n=== device ${id} · name=${JSON.stringify(d.attributes?.name)} · attribute keys: ${Object.keys(d.attributes ?? {}).join(", ")} · relationships: ${Object.keys(d.relationships ?? {}).join(", ")}`);
  report(`GET /v1/devices/${id}`, await get(`/v1/devices/${id}`));
  report(`GET /v1/devices/${id}/status`, await get(`/v1/devices/${id}/status`));
  report(`GET /v1/devices/${id}/capabilities`, await get(`/v1/devices/${id}/capabilities`));
  report(`GET /v1/devices/${id}/location`, await get(`/v1/devices/${id}/location`));
  report(`GET /v1/devices/${id}/configurations`, await get(`/v1/devices/${id}/configurations`));
  const h = report(`GET /v1/history/devices/${id}/events`, await get(`/v1/history/devices/${id}/events`));
  const evs = Array.isArray(h.json?.data) ? h.json.data : [];
  const types = {}; for (const e of evs) { const t = e.attributes?.event_type ?? e.type; types[t] = (types[t] ?? 0) + 1; }
  console.log(`  history: ${evs.length} events · event_type counts: ${JSON.stringify(types)} · sample attribute keys: ${Object.keys(evs[0]?.attributes ?? {}).join(", ")}`);
  const withDet = evs.filter((e) => Array.isArray(e.attributes?.cv_detections) && e.attributes.cv_detections.length);
  console.log(`  events with cv_detections: ${withDet.length}${withDet.length ? " · e.g. " + shape(withDet[0].attributes.cv_detections) : ""}`);
}
console.log(`\nusers/me status ${me.status}. Done (token not printed).`);
