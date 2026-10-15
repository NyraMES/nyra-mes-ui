import assert from "node:assert/strict";
import test from "node:test";

import { kilnOutputDone, loadedKilnBagCodes } from "./acKilnLoaderUtils.js";

test("a bag already loaded into a kiln is not available to load again", () => {
  const codes = loadedKilnBagCodes(
    [
      {
        lot_code: "LOT-AC-1",
        kiln_feed_events: [{ bag_code: "RO_BAG_001", kg: 500, kiln_resource_code: "KILN-A" }]
      },
      {
        metadata: {
          kiln_feed_events: [{ bagCode: "RO_BAG_002", kg: 250 }]
        }
      }
    ],
    [{ bag_code: "RO_BAG_003" }]
  );
  assert.equal(codes.has("RO_BAG_001"), true);
  assert.equal(codes.has("RO_BAG_002"), true);
  assert.equal(codes.has("RO_BAG_003"), true);
  assert.equal(codes.has("RO_BAG_004"), false);
});

test("a work order leaves the kiln list once output covers its quantity", () => {
  assert.equal(kilnOutputDone({ quantity_kg: "1000", output_kg: "1000", status: "LOADED" }), true);
  assert.equal(kilnOutputDone({ quantity_kg: "1000", output_kg: "400", status: "IN_PROGRESS" }), false);
  assert.equal(kilnOutputDone({ quantity_kg: "1000", output_kg: "0", status: "FULFILLED" }), true);
  assert.equal(kilnOutputDone({ quantity_kg: "1000", output_kg: "0", status: "OPEN" }), false);
});
