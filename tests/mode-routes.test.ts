import { test } from "node:test";
import assert from "node:assert/strict";
import { routeForMode, sectionOf } from "../lib/experience/mode-routes";

test("detail URLs of the other mode fall back to the list page", () => {
  // Real Mode: Ring ids are kept, demo ids are not.
  assert.equal(routeForMode("/events/ring-VWYPRBIHRWEVB6EX", "", "ring"), null);
  assert.equal(routeForMode("/events/EVT-1042", "", "ring"), "/events");
  assert.equal(routeForMode("/devices/ring-98e393d9", "", "ring"), null);
  assert.equal(routeForMode("/devices/cam-front", "", "ring"), "/devices");
  // Demo Mode: the opposite.
  assert.equal(routeForMode("/events/EVT-1042", "", "demo"), null);
  assert.equal(routeForMode("/events/ring-VWYPRBIHRWEVB6EX", "", "demo"), "/events");
  assert.equal(routeForMode("/devices/ring-98e393d9", "", "demo"), "/devices");
});

test("automations are Smart Rules in Real Mode and sample automations in Demo Mode", () => {
  assert.equal(routeForMode("/automations/rule-package", "", "ring"), null);
  assert.equal(routeForMode("/automations/aut-5001", "", "ring"), "/automations");
  assert.equal(routeForMode("/automations/aut-5001", "", "demo"), null);
  assert.equal(routeForMode("/automations/rule-package", "", "demo"), "/automations");
});

test("the Live View camera parameter must match the mode", () => {
  assert.equal(routeForMode("/live", "?camera=ring:ring-98e393d9", "ring"), null);
  assert.equal(routeForMode("/live", "?camera=cam-front", "ring"), "/live");
  assert.equal(routeForMode("/live", "camera=cam-front", "demo"), null);
  assert.equal(routeForMode("/live", "?camera=ring:ring-98e393d9", "demo"), "/live");
  assert.equal(routeForMode("/live", "", "ring"), null, "no camera selected is always fine");
});

test("list pages and pages without ids are never redirected", () => {
  for (const p of ["/", "/events", "/devices", "/automations", "/live", "/insights", "/settings", "/security-modes"]) {
    assert.equal(routeForMode(p, "", "ring"), null, p);
    assert.equal(routeForMode(p, "", "demo"), null, p);
  }
  assert.equal(routeForMode("/events/", "", "ring"), "/events", "an empty id is not a detail page");
  assert.equal(routeForMode("/settings", "?tab=care", "ring"), null);
});

test("sectionOf maps any path to the page it belongs to", () => {
  assert.equal(sectionOf("/events/EVT-1042"), "/events");
  assert.equal(sectionOf("/devices/ring-1"), "/devices");
  assert.equal(sectionOf("/settings"), "/settings");
  assert.equal(sectionOf("/security-modes"), "/security-modes");
  assert.equal(sectionOf("/nope/deep/path"), "/");
  assert.equal(sectionOf("/"), "/");
});
