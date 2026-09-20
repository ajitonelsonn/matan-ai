import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseFallback } from "../lib/matan/email-provider";

const both = { ses: true, smtp: true };

test("SES sandbox/IAM/config/transient failures fall back to SMTP when configured", () => {
  for (const code of ["SES_MESSAGE_REJECTED", "SES_ACCESS_DENIED", "SES_CONFIGURATION_ERROR", "SES_THROTTLED", "SES_NETWORK", "SES_ERROR"]) assert.equal(chooseFallback("ses", code, ["ses", "smtp"], both), "smtp", code);
});

test("no fallback when SMTP isn't configured or SES is forced", () => {
  assert.equal(chooseFallback("ses", "SES_MESSAGE_REJECTED", ["ses", "smtp"], { ses: true, smtp: false }), null);
  assert.equal(chooseFallback("ses", "SES_MESSAGE_REJECTED", ["ses"], both), null);
});

test("SMTP is the last provider - its failure ends the chain", () => {
  assert.equal(chooseFallback("smtp", "SMTP_AUTH", ["ses", "smtp"], both), null);
  assert.equal(chooseFallback("smtp", "SMTP_REJECTED", ["smtp"], both), null);
});
