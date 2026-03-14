import test from "node:test";
import assert from "node:assert/strict";
import { retryWithBackoff, withTimeout } from "../utils/asyncResilience.js";

test("withTimeout resolves successful promise", async () => {
  const result = await withTimeout(Promise.resolve("ok"), 1000);
  assert.equal(result, "ok");
});

test("withTimeout rejects timed out promise", async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 20, "timeout"),
    /timeout/
  );
});

test("retryWithBackoff retries and succeeds", async () => {
  let count = 0;
  const result = await retryWithBackoff(async () => {
    count += 1;
    if (count < 2) throw new Error("transient");
    return "done";
  }, 2, 1);

  assert.equal(result, "done");
  assert.equal(count, 2);
});
