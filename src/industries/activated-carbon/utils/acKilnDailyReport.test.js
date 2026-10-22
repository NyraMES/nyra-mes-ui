import assert from "node:assert/strict";
import test from "node:test";

import { buildKilnDailyAverages } from "./acKilnDailyReport.js";

function localStamp(hour) {
  return new Date(2026, 9, 17, hour, 0, 0).toISOString();
}

test("daily kiln report averages temperature, CTC, and yield", () => {
  const rows = buildKilnDailyAverages(
    {
      readings: [
        {
          kiln_resource_code: "RES-KILN-01",
          slot_start: localStamp(10),
          readings: { t1: 800, t2: 820, t3: 780 }
        },
        {
          kiln_resource_code: "RES-KILN-01",
          slot_start: localStamp(11),
          readings: { t1: 810, t2: 810, t3: 810 }
        }
      ],
      kilnBags: [
        {
          kiln_resource_code: "RES-KILN-01",
          quantity_kg: 40,
          created_at: localStamp(12),
          saved_at: localStamp(13),
          values: { kiln_out_ctc: "50" }
        },
        {
          kiln_resource_code: "RES-KILN-01",
          quantity_kg: 60,
          created_at: localStamp(14),
          saved_at: localStamp(15),
          values: { kiln_out_ctc: "40" }
        }
      ],
      lots: [
        {
          kiln_feed_events: [
            { kiln_resource_code: "RES-KILN-01", kg: 200, loaded_at: localStamp(9) }
          ]
        }
      ]
    },
    { from: "2026-10-17", to: "2026-10-17" }
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kiln, "RES-KILN-01");
  assert.equal(rows[0].avg_temp, "805.0");
  assert.equal(rows[0].avg_ctc, "45.0");
  assert.equal(rows[0].yield_avg, "50.0");
});
