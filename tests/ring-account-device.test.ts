import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAccount, normalizeDevices, maskEmail } from "../lib/ring/normalize";
import { capabilityRows, configurationRows, futureFeatures, regionLabel } from "../lib/ring/capabilities";
import type { JsonApiDocument } from "../lib/ring/types";

/**
 * TEST FIXTURES ONLY. Shapes mirror the real Ring Developer Playground responses captured
 * on 2026-09-21 (ids shortened, email replaced). They never reach Real Mode.
 */
const usersMe: JsonApiDocument = { data: { type: "users", id: "ava1.ring.account.FIXTURE", attributes: { first_name: "Playground", last_name: "User", email: "fixture_user@example.com" } } };

const devicesDoc: JsonApiDocument = {
  data: [{ type: "devices", id: "ava1.ring.device.FIXTURE", attributes: { name: "Playground Device", image_url: "https://app-content.ring.com/shared/images/devices/square_device_images/DoorbellPro/rvdp_3x.png" }, relationships: { status: { data: { type: "device-status", id: "st1" } }, capabilities: { data: { type: "device-capabilities", id: "cap1" } }, location: { data: { type: "locations", id: "loc1" } }, configurations: { data: { type: "device-configurations", id: "conf1" } } } }],
  included: [
    { type: "device-status", id: "st1", attributes: { audio: { snooze: { active: null, until: null } }, reported_at: "2026-09-20T19:00:25Z", online: true, state: null } },
    { type: "device-capabilities", id: "cap1", attributes: { motion_detection: { configurations: ["enabled", "motion_zones"] }, co_detection_listener: null, image_enhancements: { configurations: ["color_night_vision", "privacy_zones", "snapshot"] }, video: { configurations: ["resolution_mode"], codecs: ["AVC"], ratio: "16:9", max_resolution: 1080, supported_resolutions: [1080] }, glass_break_detection: null, tamper_detection: null, smoke_detection: null, audio: { customizable_slots: null, supported_actions: null }, flood_detection: null, freeze_detection: null, contact_detection: null, battery_status: null } },
    { type: "locations", id: "loc1", attributes: { country: "US", state: "CA" } },
    { type: "device-configurations", id: "conf1", attributes: { audio: { customizable_slots: null, volume: 11 }, image_enhancements: { color_night_vision: "off", hdr: "off", ir_led_night_vision: "off", auto_zoom_track: "off", privacy_zones: [] }, motion_detection: { enabled: "on", motion_zones: [{ id: "z1", vertices: [] }] } } },
  ],
};

test("account normalization: id + display fields, email masked, never the raw address", () => {
  const a = normalizeAccount(usersMe)!;
  assert.equal(a.accountId, "ava1.ring.account.FIXTURE");
  assert.equal(a.firstName, "Playground");
  assert.equal(a.lastName, "User");
  assert.equal(a.emailMasked, "f******@example.com");
  assert.ok(!JSON.stringify(a).includes("fixture_user@"));
  assert.equal(normalizeAccount({ data: { type: "devices", id: "x" } }), null, "non-user resource → null");
  assert.equal(maskEmail("ab@c.io"), "a**@c.io");
});

test("device normalization uses real Ring values: status, capabilities, coarse location, configuration", () => {
  const [d] = normalizeDevices(devicesDoc);
  assert.equal(d.name, "Playground Device");
  assert.equal(d.type, "doorbell");
  assert.equal(d.model, "Doorbell Pro");
  assert.equal(d.status.online, true);
  assert.equal(d.status.label, "Online");
  assert.equal(d.status.reportedAt, "2026-09-20T19:00:25Z");
  assert.equal(d.status.snoozeActive, null);
  assert.deepEqual(d.location, { country: "US", state: "CA" });
  const c = d.capabilities;
  assert.equal(c.video, true);
  assert.equal(c.maxResolution, 1080);
  assert.deepEqual(c.codecs, ["AVC"]);
  assert.equal(c.ratio, "16:9");
  assert.deepEqual(c.supportedResolutions, [1080]);
  assert.equal(c.motionDetection, true);
  assert.deepEqual(c.configurable?.motion, ["enabled", "motion_zones"]);
  assert.equal(c.snapshot, true);
  assert.equal(c.privacyZones, true);
  assert.equal(c.nightVision, true);
  assert.equal(c.audio, false, "audio null → absent");
  assert.equal(c.battery, false, "battery_status null → absent");
  assert.deepEqual(c.sensors, { co: false, smoke: false, glassBreak: false, tamper: false, flood: false, freeze: false, contact: false });
  assert.equal(c.audioSlots, null);
  const conf = d.configuration!;
  assert.equal(conf.motionEnabled, true);
  assert.equal(conf.motionZonesCount, 1);
  assert.equal(conf.privacyZonesCount, 0);
  assert.equal(conf.audioVolume, 11);
  assert.deepEqual(conf.imageEnhancements, { color_night_vision: "off", hdr: "off", ir_led_night_vision: "off", auto_zoom_track: "off" });
  assert.equal(d.source, "ring-playground");
});

test("offline status and missing resources are represented honestly (never inferred)", () => {
  const doc: JsonApiDocument = { data: [{ type: "devices", id: "d2", attributes: { name: "Bare device" }, relationships: { status: { data: { type: "device-status", id: "s2" } } } }], included: [{ type: "device-status", id: "s2", attributes: { online: false } }] };
  const [d] = normalizeDevices(doc);
  assert.equal(d.status.online, false);
  assert.equal(d.status.label, "Offline");
  assert.equal(d.location, undefined, "no location resource → undefined, not a made-up region");
  assert.equal(d.capabilities.video, undefined);
  assert.equal(d.capabilities.sensors, undefined);
  assert.equal(d.configuration, undefined);
  assert.equal(d.type, "device", "unknown kind stays generic");
  assert.equal(regionLabel(d.location), undefined);
  assert.deepEqual(capabilityRows(d.capabilities).map((r) => r.state), Array(14).fill("unknown"));
  assert.deepEqual(configurationRows(d.configuration), []);
  const none = normalizeDevices({ data: null });
  assert.deepEqual(none, []);
});

test("capability matrix: yes only when Ring reported it, Unavailable when null", () => {
  const [d] = normalizeDevices(devicesDoc);
  const rows = Object.fromEntries(capabilityRows(d.capabilities).map((r) => [r.key, r]));
  assert.equal(rows.video.state, "yes");
  assert.equal(rows.video.detail, "1080p · AVC · 16:9");
  assert.equal(rows.motion.state, "yes");
  assert.equal(rows.snapshot.state, "yes");
  assert.equal(rows.audio.state, "no");
  assert.equal(rows.battery.state, "no");
  assert.equal(rows.smoke.state, "no");
  assert.equal(regionLabel(d.location), "US / CA");
  const conf = Object.fromEntries(configurationRows(d.configuration).map((r) => [r.key, r.value]));
  assert.equal(conf.motion, "On");
  assert.equal(conf.motionZones, "1");
  assert.equal(conf["enh:hdr"], "Off");
  assert.equal(conf.volume, "11");
});

test("non-device resources and foreign types never become Ring devices (no fake data path)", () => {
  const doc: JsonApiDocument = { data: [{ type: "history-events", id: "e1", attributes: { name: "Not a device" } }, { type: "devices", id: "", attributes: {} }] };
  assert.deepEqual(normalizeDevices(doc), []);
});

test("future features are classified with the spec's exact categories and depend on real capabilities", () => {
  const [d] = normalizeDevices(devicesDoc);
  const byKey = Object.fromEntries(futureFeatures([{ details: d.capabilities }]).map((f) => [f.key, f]));
  assert.equal(byKey.deviceControls.classification, "Not documented by Ring");
  assert.equal(byKey.family.classification, "Not documented by Ring");
  assert.equal(byKey.chimeControls.classification, "Documented by Ring but not exposed by Playground", "Playground device reports audio: null");
  assert.equal(byKey.lifecycle.classification, "Documented by Ring but not exposed by Playground");
  assert.equal(byKey.subscriptions.classification, "Documented by Ring but not exposed by Playground");
  const withChime = futureFeatures([{ details: { ...d.capabilities, audioActions: ["play"], audioSlots: 2 } }]).find((f) => f.key === "chimeControls")!;
  assert.equal(withChime.classification, "Documented and exposed but not yet implemented");
  for (const f of Object.values(byKey)) assert.ok(f.message.length > 40 && f.headline.length > 0);
});
