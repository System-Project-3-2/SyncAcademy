import test from "node:test";
import assert from "node:assert/strict";
import { isCircuitOpen, recordFailure, recordSuccess } from "../services/circuitBreaker.js";

test("circuit opens after repeated failures", () => {
  recordSuccess();
  for (let i = 0; i < 6; i += 1) recordFailure();
  assert.equal(isCircuitOpen(), true);
});

test("circuit closes after success reset", () => {
  recordSuccess();
  assert.equal(isCircuitOpen(), false);
});
