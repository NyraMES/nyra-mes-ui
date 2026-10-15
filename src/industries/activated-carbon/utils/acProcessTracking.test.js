import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDestonerCompliance,
  buildDeviationRate,
  buildMeshCompliance,
  buildOverallProcessEfficiency,
  buildPainPoints,
  buildProcessTracking,
  buildSupplierPhase1
} from "./acProcessTracking.js";

const catalog = {
  configurations: [
    { code: "A", label: "Mesh A", grades: ["4x8", "8x30"] },
    { code: "B", label: "Mesh B", grades: ["12x40"] }
  ]
};

test("mesh compliance counts tags on the approved mesh", () => {
  const score = buildMeshCompliance(
    [
      { bag_code: "SC1", mesh: "A", grade: "8x30" },
      { bag_code: "SC2", mesh: "A", grade: "12x40" },
      { bag_code: "SC3", grade: "8x30" }
    ],
    catalog
  );
  assert.equal(score.pct, 50);
  assert.equal(score.counters[0].value, "1");
  assert.equal(score.counters[1].value, "2");
  assert.equal(score.counters[2].value, "Not recorded");
});

test("saved destoner loads count as compliant evaluated loads", () => {
  const score = buildDestonerCompliance(
    [
      {
        resource_code: "RES-DESTON-01",
        load_events: [
          { bag_code: "KA1", loaded_at: "2026-10-12T04:00:00Z" },
          { bag_code: "KA1", loaded_at: "2026-10-12T04:00:00Z" }
        ]
      }
    ],
    1
  );
  assert.equal(score.pct, 100);
  assert.equal(score.counters[0].value, "1");
  assert.equal(score.counters[1].value, "1");
  assert.match(score.counters[2].value, /1 decimal/);
});

test("deviation rate uses mesh misses and kiln CTC mismatches", () => {
  const score = buildDeviationRate({
    screeningBags: [
      { mesh: "A", grade: "8x30" },
      { mesh: "A", grade: "12x40" }
    ],
    catalog,
    destonerLoads: 2,
    kilnQc: [
      { bag_code: "KA1", saved_at: "2026-10-12", ctc_match: true },
      { bag_code: "KA2", saved_at: "2026-10-13", ctc_match: false }
    ]
  });
  assert.equal(score.counters[0].value, "2");
  assert.equal(score.counters[1].value, "6");
  assert.equal(score.pct, 33.3);
});

const NOW = Date.parse("2026-10-15T12:00:00Z");

function closedLossContext(kilnOutputKg = 100) {
  return {
    now: NOW,
    kilns: [
      {
        resource_code: "RES-KILN-01",
        residence_time_min: 60,
        feed_events: [{ kg: 100, loaded_at: "2026-10-15T08:00:00Z" }]
      }
    ],
    kilnOutputs: {
      "RES-KILN-01": { bags: [{ bag_code: "KA1", quantity_kg: kilnOutputKg }] }
    },
    destoners: [{ output_bags: [{ bag_code: "DS1", quantity_kg: 40 }] }],
    stations: {
      screening: {
        loaded: [],
        output_bags: [{ bag_code: "SC1", quantity_kg: 40, input_bag_codes: ["DS1"] }]
      },
      dedusting: {
        loaded: [],
        output_bags: [{ bag_code: "DD1", quantity_kg: 40, input_bag_codes: ["SC1"] }]
      },
      crushing: {
        loaded: [],
        output_bags: [{ bag_code: "CR1", quantity_kg: 40, input_bag_codes: ["DD1"] }]
      },
      demagnetisation: {
        loaded: [],
        output_bags: [{ bag_code: "DM1", quantity_kg: 40, input_bag_codes: ["CR1"] }]
      },
      blending: {
        loaded: [],
        output_bags: [{ bag_code: "BL1", quantity_kg: 40, input_bag_codes: ["DM1"] }]
      }
    }
  };
}

test("overall process efficiency subtracts every finished loss stream", () => {
  const score = buildOverallProcessEfficiency(
    [
      { order_code: "ORD-AC-1", our_weight_kg: 1000 },
      { order_code: "ORD-AC-2", our_weight_kg: 500 }
    ],
    [
      { order_code: "ORD-AC-1", grade: "Grade 1st stage - Rotary A", weight_kg: 800 },
      { order_code: "ORD-AC-1", grade: "Stones", weight_kg: 100 },
      { order_code: "ORD-AC-1", grade: "Unburnt - Rotary B", weight_kg: 50 }
    ],
    closedLossContext()
  );
  assert.equal(score.inputKg, 1000);
  assert.equal(score.components.find((row) => row.name === "Stones").actualPct, 10);
  assert.equal(score.components.find((row) => row.name === "Unburnt").actualPct, 5);
  assert.equal(score.components.find((row) => row.name === "Kiln").actualPct, 0);
  assert.equal(score.components.find((row) => row.name === "Screening").actualPct, 0);
  assert.equal(score.actualPct, 85);
  assert.equal(score.referencePct, null);
});

test("kiln loss is the due feed that output did not cover", () => {
  const score = buildOverallProcessEfficiency(
    [{ order_code: "ORD-AC-1", our_weight_kg: 1000 }],
    [
      { order_code: "ORD-AC-1", grade: "Stones", weight_kg: 0 },
      { order_code: "ORD-AC-1", grade: "Unburnt", weight_kg: 0 }
    ],
    closedLossContext(60)
  );
  assert.equal(score.components.find((row) => row.name === "Kiln").lossKg, 40);
  assert.equal(score.components.find((row) => row.name === "Kiln").actualPct, 4);
  assert.equal(score.actualPct, 96);
});

test("a kiln load still inside residence stays in process", () => {
  const context = closedLossContext();
  context.kilns[0].feed_events = [{ kg: 100, loaded_at: "2026-10-15T11:30:00Z" }];
  const score = buildOverallProcessEfficiency(
    [{ order_code: "ORD-AC-1", our_weight_kg: 1000 }],
    [
      { order_code: "ORD-AC-1", grade: "Stones", weight_kg: 10 },
      { order_code: "ORD-AC-1", grade: "Unburnt", weight_kg: 10 }
    ],
    context
  );
  assert.equal(score.components.find((row) => row.name === "Kiln").status, "not-evaluated");
  assert.equal(score.actualPct, 98);
  assert.ok(score.pendingNames.includes("Kiln"));
});

test("a bag still on the screening loader is not loss", () => {
  const context = closedLossContext();
  context.stations.screening = {
    loaded: [{ bag_code: "DS1", quantity_kg: 40 }],
    output_bags: [{ bag_code: "SC1", quantity_kg: 30, input_bag_codes: ["DS1"] }]
  };
  const score = buildOverallProcessEfficiency(
    [{ order_code: "ORD-AC-1", our_weight_kg: 1000 }],
    [
      { order_code: "ORD-AC-1", grade: "Stones", weight_kg: 10 },
      { order_code: "ORD-AC-1", grade: "Unburnt", weight_kg: 10 }
    ],
    context
  );
  assert.equal(score.components.find((row) => row.name === "Screening").status, "not-evaluated");
  assert.equal(score.actualPct, 98);
  assert.ok(score.pendingNames.includes("Screening"));
});

test("a bag past its post-activation minutes counts the uncovered kilograms", () => {
  const context = closedLossContext();
  context.stations.screening = {
    loaded: [{ bag_code: "DS1", quantity_kg: 40, loaded_at: "2026-10-15T10:00:00Z" }],
    output_bags: [{ bag_code: "SC1", quantity_kg: 30, input_bag_codes: ["DS1"] }]
  };
  context.outputMinutes = { screening: 60 };
  const score = buildOverallProcessEfficiency(
    [{ order_code: "ORD-AC-1", our_weight_kg: 1000 }],
    [
      { order_code: "ORD-AC-1", grade: "Stones", weight_kg: 10 },
      { order_code: "ORD-AC-1", grade: "Unburnt", weight_kg: 10 }
    ],
    context
  );
  assert.equal(score.components.find((row) => row.name === "Screening").lossKg, 10);
  assert.equal(score.components.find((row) => row.name === "Screening").actualPct, 1);
});

test("a missing loss stream stays Not Evaluated", () => {
  const score = buildOverallProcessEfficiency(
    [{ order_code: "ORD-AC-1", our_weight_kg: 1000 }],
    [{ order_code: "ORD-AC-1", grade: "Unburnt", weight_kg: 50 }],
    closedLossContext()
  );
  assert.equal(score.actualPct, 95);
  assert.equal(score.components.find((row) => row.name === "Stones").status, "not-evaluated");
  assert.ok(score.pendingNames.includes("Stones"));
});

test("supplier phase 1 uses lab disposition and moisture", () => {
  const score = buildSupplierPhase1(
    [
      { our_weight_kg: 400, lab_status: "COMPLETED", lab_moisture_pct: 10 },
      { our_weight_kg: 100, lab_status: "DENIED", lab_moisture_pct: 25 },
      { our_weight_kg: 50, lab_status: "PENDING" }
    ],
    20
  );
  assert.equal(score.inspectedKg, 500);
  assert.equal(score.acceptancePct, 80);
  assert.equal(score.rejectionPct, 20);
  assert.equal(score.qualityPct, 50);
  assert.equal(score.evaluatedSamples, 2);
});

test("pain points follow the measured gaps", () => {
  const tracking = buildProcessTracking({
    screeningBags: [
      { mesh: "A", grade: "8x30" },
      { mesh: "A", grade: "12x40" }
    ],
    meshCatalog: catalog,
    destoners: [],
    kilnQc: [],
    inwardOrders: [{ our_weight_kg: 100, lab_status: "DENIED", lab_moisture_pct: 30 }],
    inwardBags: [],
    moistureLimit: 20
  });
  const ids = tracking.painPoints.map((row) => row.id);
  assert.ok(ids.includes("P01"));
  assert.ok(ids.includes("S02"));
  assert.ok(ids.includes("S03"));
  assert.ok(ids.includes("P07"));
});
