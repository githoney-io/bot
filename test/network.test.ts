import { test } from "node:test";
import assert from "node:assert/strict";
import { isMainnet } from "../src/utils/constants";

test("isMainnet accepts mainnet in any case", () => {
  assert.equal(isMainnet("mainnet"), true);
  assert.equal(isMainnet("Mainnet"), true);
});

test("isMainnet rejects preprod in any case", () => {
  assert.equal(isMainnet("preprod"), false);
  assert.equal(isMainnet("Preprod"), false);
});
