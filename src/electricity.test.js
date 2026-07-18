import assert from "node:assert/strict";
import test from "node:test";

import { bandFor } from "./electricity.js";

test("electricity unit bands change above 180 and 190 units", () => {
  assert.equal(bandFor(180), "calm");
  assert.equal(bandFor(181), "edge");
  assert.equal(bandFor(190), "edge");
  assert.equal(bandFor(191), "danger");
});
