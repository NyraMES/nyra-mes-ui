import assert from "node:assert/strict";
import test from "node:test";

import { filterKilnFeedDayRows, kilnOutputDone, loadedKilnBagCodes } from "./acKilnLoaderUtils.js";

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

test("kiln feed day list filters by CTC and from-to dates", () => {
  const events = [
    { bagCode: "RO_1", kg: 10, loadedAt: new Date(2026, 9, 17, 12, 0, 0), workOrderCode: "WO-1" },
    { bagCode: "RO_2", kg: 12, loadedAt: new Date(2026, 9, 16, 12, 0, 0), workOrderCode: "WO-2" },
    { bagCode: "RO_3", kg: 8, loadedAt: new Date(2026, 9, 17, 18, 0, 0), workOrderCode: "WO-1" }
  ];
  const ctcByWorkOrder = { "WO-1": "40", "WO-2": "55" };
  const day = filterKilnFeedDayRows(events, {
    from: "2026-10-17",
    to: "2026-10-17",
    ctc: "40",
    ctcByWorkOrder
  });
  assert.deepEqual(day.map((row) => row.bagCode), ["RO_1", "RO_3"]);
});

test("a work order leaves the kiln list once output covers its quantity", () => {
  assert.equal(kilnOutputDone({ quantity_kg: "1000", output_kg: "1000", status: "LOADED" }), true);
  assert.equal(kilnOutputDone({ quantity_kg: "1000", output_kg: "400", status: "IN_PROGRESS" }), false);
  assert.equal(kilnOutputDone({ quantity_kg: "1000", output_kg: "0", status: "FULFILLED" }), true);
  assert.equal(kilnOutputDone({ quantity_kg: "1000", output_kg: "0", status: "OPEN" }), false);
});
