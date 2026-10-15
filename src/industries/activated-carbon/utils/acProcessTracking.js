/** Phase 1 process-tracking scores from records the plant already saves. */

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round1(value) {
  return Math.round(num(value) * 10) / 10;
}

function rate(numerator, denominator) {
  const d = num(denominator);
  if (d <= 0) return null;
  return round1((num(numerator) / d) * 100);
}

function canonicalGrade(label) {
  let raw = String(label || "").trim();
  const lower = raw.toLowerCase();
  for (const suffix of [" - rotary a", " - rotary b"]) {
    if (lower.endsWith(suffix)) {
      raw = raw.slice(0, -suffix.length).trim();
      break;
    }
  }
  const key = raw.toLowerCase();
  if (key === "stones") return "Stones";
  if (key === "unburnt") return "Unburnt";
  return raw;
}

function gradesForMesh(catalog, mesh) {
  const wanted = String(mesh || "").trim().toLowerCase();
  if (!wanted) return [];
  for (const cfg of catalog?.configurations || []) {
    const code = String(cfg.code || "").trim().toLowerCase();
    const label = String(cfg.label || "").trim().toLowerCase();
    if (wanted === code || wanted === label) {
      return (cfg.grades || []).map((grade) => String(grade).trim().toLowerCase()).filter(Boolean);
    }
  }
  return [];
}

function gradeOnMesh(catalog, mesh, grade) {
  const allowed = gradesForMesh(catalog, mesh);
  const wanted = String(grade || "").trim().toLowerCase();
  return Boolean(wanted) && allowed.includes(wanted);
}

function meshCatalogReady(catalog) {
  return (catalog?.configurations || []).some((cfg) => (cfg.grades || []).length > 0);
}

export function buildMeshCompliance(outputBags = [], catalog = {}) {
  const validated = (outputBags || []).filter(
    (bag) => String(bag?.mesh || "").trim() && String(bag?.grade || "").trim()
  );
  const ready = meshCatalogReady(catalog);
  const compliant = ready ? validated.filter((bag) => gradeOnMesh(catalog, bag.mesh, bag.grade)) : [];
  return {
    id: "P01",
    title: "Mesh selection compliance",
    pct: ready ? rate(compliant.length, validated.length) : null,
    empty: ready ? "No evaluated runs yet." : "Mesh configuration has not loaded.",
    formula: "100 × compliant screening runs ÷ validated screening runs",
    counters: [
      {
        label: "Compliant runs",
        value: ready ? String(compliant.length) : "—",
        hint: "Screening tags whose grade is on the mesh approved in Masters"
      },
      {
        label: "Validated runs",
        value: String(validated.length),
        hint: "Screening tags saved after the mesh rule"
      },
      {
        label: "Blocked invalid attempts",
        value: "Not recorded",
        hint: "A refused mesh is not stored on a bag"
      }
    ]
  };
}

export function buildDestonerCompliance(destoners = [], ctcDecimals = 1) {
  const loads = [];
  const seen = new Set();
  for (const machine of destoners || []) {
    const events = machine?.load_events || [];
    for (const event of events) {
      const code = String(event?.bag_code || "").trim();
      const at = String(event?.loaded_at || "");
      if (!code && !at) continue;
      const key = `${code}|${at}|${machine?.resource_code || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      loads.push(event);
    }
  }
  const decimals = Number.isFinite(Number(ctcDecimals)) ? Number(ctcDecimals) : 1;
  return {
    id: "P02",
    title: "Destoner CTC segregation compliance",
    pct: loads.length ? 100 : null,
    empty: "No evaluated loads yet.",
    formula: "100 × compliant destoner loads ÷ evaluated destoner loads",
    counters: [
      {
        label: "Compliant loads",
        value: String(loads.length),
        hint: "Saved loads. Each bag matched the destoner CTC before it was accepted"
      },
      {
        label: "Evaluated loads",
        value: String(loads.length),
        hint: "Loads whose CTC check finished"
      },
      {
        label: "CTC rule",
        value: `${decimals} decimal${decimals === 1 ? "" : "s"}`,
        hint: "Masters rounds CTC, then the values must be equal"
      },
      {
        label: "Blocked invalid attempts",
        value: "Not recorded",
        hint: "A refused CTC load is not stored"
      }
    ]
  };
}

export function buildDeviationRate({
  screeningBags = [],
  catalog = {},
  destonerLoads = 0,
  kilnQc = []
} = {}) {
  const validatedScreening = (screeningBags || []).filter(
    (bag) => String(bag?.mesh || "").trim() && String(bag?.grade || "").trim()
  );
  const meshReady = meshCatalogReady(catalog);
  const meshBreaches = meshReady
    ? validatedScreening.filter((bag) => !gradeOnMesh(catalog, bag.mesh, bag.grade))
    : [];
  const evaluatedQc = (kilnQc || []).filter((row) => row?.saved_at || row?.ctc_match === true || row?.ctc_match === false);
  const ctcBreaches = evaluatedQc.filter((row) => row?.ctc_match === false);
  const evaluated =
    (meshReady ? validatedScreening.length : 0) + num(destonerLoads) + evaluatedQc.length;
  const runsWithDeviation = meshBreaches.length + ctcBreaches.length;
  const events = meshBreaches.length + ctcBreaches.length;
  return {
    id: "P03",
    title: "Process deviation rate",
    pct: rate(runsWithDeviation, evaluated),
    empty: "No evaluated runs yet.",
    formula: "100 × runs with at least one deviation ÷ evaluated process runs",
    counters: [
      {
        label: "Runs with a deviation",
        value: String(runsWithDeviation),
        hint: "A screening tag off its mesh, or a kiln output whose measured CTC does not match the work order"
      },
      {
        label: "Evaluated runs",
        value: String(evaluated),
        hint: "Screening tags, destoner loads, and kiln output quality that were checked"
      },
      {
        label: "Deviation events",
        value: String(events),
        hint: "Each breach counted on its own"
      }
    ]
  };
}

const NAMED_LOSS = ["Stones", "Unburnt"];

const PROCESS_LOSS = [
  { id: "kiln", name: "Kiln" },
  { id: "screening", name: "Screening" },
  { id: "dedusting", name: "De-dusting" },
  { id: "crushing", name: "Crushing" },
  { id: "demagnetisation", name: "De-magnetisation" },
  { id: "blending", name: "Blending" }
];

function bagKg(row) {
  return num(row?.quantity_kg ?? row?.weight_kg ?? row?.kg);
}

function parseTime(value) {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? ms : null;
}

function rememberWeight(weights, code, kg) {
  const key = String(code || "").trim();
  if (!key || kg <= 0 || weights.has(key)) return;
  weights.set(key, kg);
}

function indexBagWeights(stations, destoners, kilnOutputs) {
  const weights = new Map();
  const take = (rows) => {
    for (const row of rows || []) rememberWeight(weights, row?.bag_code, bagKg(row));
  };
  for (const station of Object.values(stations || {})) {
    take(station?.loaded);
    take(station?.output_bags);
    take(station?.available);
  }
  for (const machine of destoners || []) {
    take(machine?.output_bags);
    take(machine?.loaded);
  }
  for (const payload of Object.values(kilnOutputs || {})) take(payload?.bags);
  return weights;
}

function kilnLoss(kilns, kilnOutputs, now) {
  let lossKg = 0;
  let measured = false;
  let incomplete = false;
  for (const kiln of kilns || []) {
    const code = String(kiln?.resource_code || kiln?.resourceCode || "");
    const events = kiln?.feed_events || kilnOutputs?.[code]?.feed_events || [];
    const loads = (events || []).filter((row) => bagKg(row) > 0 && parseTime(row?.loaded_at) != null);
    if (!loads.length) continue;
    const residenceMin = Number(kiln?.residence_time_min ?? kiln?.residenceMin);
    if (!Number.isFinite(residenceMin) || residenceMin <= 0) {
      incomplete = true;
      continue;
    }
    let dueKg = 0;
    for (const row of loads) {
      const elapsedMin = (now - parseTime(row.loaded_at)) / 60000;
      if (elapsedMin >= residenceMin) dueKg += bagKg(row);
    }
    if (dueKg <= 0) continue;
    const bags = kilnOutputs?.[code]?.bags || [];
    const outputKg = bags.reduce((sum, row) => sum + bagKg(row), 0);
    lossKg += Math.max(0, dueKg - outputKg);
    measured = true;
  }
  if (!measured || incomplete) return { measured: false, lossKg: null };
  return { measured: true, lossKg };
}

function dueLoadLoss(station, minutes, now) {
  const limit = Number(minutes);
  if (!Number.isFinite(limit) || limit <= 0) return null;
  const loaded = (station?.loaded || []).filter((row) => String(row?.bag_code || "").trim());
  if (!loaded.length) return null;
  const allDue = loaded.every((row) => {
    const at = parseTime(row?.loaded_at || row?.created_at);
    return at != null && (now - at) / 60000 >= limit;
  });
  if (!allDue) return null;
  const codes = new Set(loaded.map((row) => String(row.bag_code)));
  let inputKg = 0;
  for (const row of loaded) {
    const kg = bagKg(row);
    if (kg <= 0) return null;
    inputKg += kg;
  }
  let outputKg = 0;
  for (const bag of station?.output_bags || []) {
    const inputs = (bag?.input_bag_codes || []).map((code) => String(code || "").trim());
    if (inputs.some((code) => codes.has(code))) outputKg += bagKg(bag);
  }
  return Math.max(0, inputKg - outputKg);
}

function postProcessLoss(station, weights, minutes, now) {
  const loadedCodes = new Set(
    (station?.loaded || []).map((row) => String(row?.bag_code || "")).filter(Boolean)
  );
  const groups = new Map();
  for (const bag of station?.output_bags || []) {
    const codes = (bag?.input_bag_codes || []).map((code) => String(code || "").trim()).filter(Boolean);
    if (!codes.length) continue;
    const key = [...codes].sort().join("|");
    const group = groups.get(key) || { codes, outputKg: 0 };
    group.outputKg += bagKg(bag);
    groups.set(key, group);
  }
  let lossKg = 0;
  let measured = false;
  let incomplete = false;
  for (const group of groups.values()) {
    if (group.codes.some((code) => loadedCodes.has(code))) continue;
    let inputKg = 0;
    let known = true;
    for (const code of group.codes) {
      if (!weights.has(code)) {
        known = false;
        break;
      }
      inputKg += weights.get(code);
    }
    if (!known) {
      incomplete = true;
      continue;
    }
    lossKg += Math.max(0, inputKg - group.outputKg);
    measured = true;
  }
  const stillDue = dueLoadLoss(station, minutes, now);
  if (stillDue != null) {
    lossKg += stillDue;
    measured = true;
  }
  if (!measured || incomplete) return { measured: false, lossKg: null };
  return { measured: true, lossKg };
}

function lossComponent(name, measured, lossKg, inputKg) {
  const ready = measured && inputKg > 0;
  return {
    name,
    lossKg: ready ? round1(lossKg) : null,
    standardPct: null,
    actualPct: ready ? round1((100 * lossKg) / inputKg) : null,
    status: ready ? "measured" : "not-evaluated"
  };
}

export function buildOverallProcessEfficiency(
  inwardOrders = [],
  inwardBags = [],
  {
    kilns = [],
    kilnOutputs = {},
    stations = {},
    destoners = [],
    outputMinutes = {},
    now = Date.now()
  } = {}
) {
  const inputByOrder = new Map();
  for (const order of inwardOrders || []) {
    const kg = num(order?.our_weight_kg ?? order?.inward_quantity_kg);
    const code = String(order?.order_code || "").trim();
    if (code && kg > 0) inputByOrder.set(code, kg);
  }
  const ordersWithOutward = new Set();
  const namedKg = { Stones: 0, Unburnt: 0 };
  for (const bag of inwardBags || []) {
    const grade = canonicalGrade(bag?.grade);
    if (!grade) continue;
    const code = String(bag?.order_code || "").trim();
    if (code) ordersWithOutward.add(code);
    if (NAMED_LOSS.includes(grade)) namedKg[grade] += bagKg(bag);
  }
  let inputKg = 0;
  for (const code of ordersWithOutward) inputKg += inputByOrder.get(code) || 0;
  const weights = indexBagWeights(stations, destoners, kilnOutputs);
  const kiln = kilnLoss(kilns, kilnOutputs, now);
  const processLoss = Object.fromEntries(
    PROCESS_LOSS.filter((row) => row.id !== "kiln").map((row) => [
      row.id,
      postProcessLoss(stations?.[row.id], weights, outputMinutes?.[row.id], now)
    ])
  );
  const components = [
    ...NAMED_LOSS.map((name) =>
      lossComponent(
        name,
        (inwardBags || []).some((bag) => canonicalGrade(bag?.grade) === name),
        namedKg[name],
        inputKg
      )
    ),
    lossComponent("Kiln", kiln.measured, kiln.lossKg, inputKg),
    ...PROCESS_LOSS.filter((row) => row.id !== "kiln").map((row) =>
      lossComponent(row.name, processLoss[row.id]?.measured, processLoss[row.id]?.lossKg, inputKg)
    )
  ];
  const measured = components.filter((row) => row.actualPct != null);
  const pendingNames = components.filter((row) => row.actualPct == null).map((row) => row.name);
  const actualSum = measured.reduce((sum, row) => sum + row.actualPct, 0);
  return {
    id: "P07",
    title: "Overall process efficiency",
    actualPct: measured.length ? round1(100 - actualSum) : null,
    referencePct: null,
    variancePp: null,
    inputKg: inputKg > 0 ? round1(inputKg) : null,
    pendingNames,
    components,
    formula:
      "Reference = 100 − sum of standard component loss %. Actual = 100 − sum of finished component loss %",
    actualFormula:
      "Each loss % = 100 × loss kg ÷ process input kg. The score uses streams that have finished. A stream still in process stays off the number. Kiln loss is due feed minus kiln output after residence time. Post-activation loss is loaded kg minus output kg once that load has left the machine.",
    note: "Stones, Unburnt, the kiln, and each post-activation machine are separate streams. The number is 100 minus the loss on streams that have finished. A stream still in process stays off the number, and it is not treated as zero. Kilograms still inside residence stay in process. A post-activation bag still on the machine stays in process until its Masters minutes have passed, or until it leaves the loader when no minutes are set. No approved loss standard is saved, so the reference is Not Evaluated. This score is not plant yield."
  };
}

function labDisposition(order) {
  const status = String(order?.lab_status || "").toUpperCase();
  if (order?.lab_denied || status === "DENIED") return "reject";
  if (status === "COMPLETED") return "accept";
  return null;
}

export function buildSupplierPhase1(inwardOrders = [], moistureLimit = 20) {
  let acceptedKg = 0;
  let rejectedKg = 0;
  let compliant = 0;
  let evaluated = 0;
  const limit = Number(moistureLimit);
  const limitOk = Number.isFinite(limit);
  for (const order of inwardOrders || []) {
    const kg = num(order?.our_weight_kg ?? order?.inward_quantity_kg);
    const disposition = labDisposition(order);
    if (disposition === "accept") acceptedKg += kg;
    if (disposition === "reject") rejectedKg += kg;
    const moisture = order?.lab_moisture_pct ?? order?.moisture_pct;
    if (!limitOk || moisture == null || moisture === "") continue;
    const value = Number(moisture);
    if (!Number.isFinite(value)) continue;
    evaluated += 1;
    if (value <= limit) compliant += 1;
  }
  const inspectedKg = acceptedKg + rejectedKg;
  return {
    acceptancePct: rate(acceptedKg, inspectedKg),
    rejectionPct: rate(rejectedKg, inspectedKg),
    qualityPct: rate(compliant, evaluated),
    acceptedKg: round1(acceptedKg),
    rejectedKg: round1(rejectedKg),
    inspectedKg: round1(inspectedKg),
    compliantSamples: compliant,
    evaluatedSamples: evaluated,
    moistureLimit: limitOk ? limit : null
  };
}

export function buildPainPoints(tracking) {
  const rows = [];
  const mesh = tracking?.mesh;
  const destoner = tracking?.destoner;
  const deviation = tracking?.deviation;
  const ope = tracking?.ope;
  const supplier = tracking?.supplier;
  if (mesh?.pct != null && mesh.pct < 100) {
    rows.push({
      id: "P01",
      title: "Mesh selection",
      detail: `${mesh.pct.toFixed(1)}% of validated screening runs used the approved mesh`,
      tab: "process-tracking",
      tone: "red"
    });
  }
  if (destoner?.pct != null && destoner.pct < 100) {
    rows.push({
      id: "P02",
      title: "Destoner CTC",
      detail: `${destoner.pct.toFixed(1)}% of evaluated loads kept one CTC`,
      tab: "process-tracking",
      tone: "red"
    });
  }
  if (deviation?.pct != null && deviation.pct > 0) {
    rows.push({
      id: "P03",
      title: "Process deviation",
      detail: `${deviation.pct.toFixed(1)}% of evaluated runs have a recorded breach`,
      tab: "process-tracking",
      tone: "red"
    });
  }
  if (ope?.actualPct == null) {
    const missing = (ope?.components || []).filter((row) => row.status !== "measured").map((row) => row.name);
    rows.push({
      id: "P07",
      title: "Overall process efficiency",
      detail: missing.length
        ? `${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} Not Evaluated. No approved loss standard is saved.`
        : "Not Evaluated. No approved loss standard is saved.",
      tab: "process-tracking",
      tone: "amber"
    });
  } else if (ope.referencePct == null) {
    rows.push({
      id: "P07",
      title: "Overall process efficiency",
      detail: `Actual ${ope.actualPct.toFixed(1)}%. Reference is Not Evaluated until a loss standard is approved.`,
      tab: "process-tracking",
      tone: "amber"
    });
  }
  if (supplier?.rejectionPct != null && supplier.rejectionPct > 0) {
    rows.push({
      id: "S02",
      title: "Raw material rejection",
      detail: `${supplier.rejectionPct.toFixed(1)}% of inspected kilograms were denied at lab`,
      tab: "raw-material",
      tone: "red"
    });
  }
  if (supplier?.qualityPct != null && supplier.qualityPct < 100) {
    rows.push({
      id: "S03",
      title: "Raw material quality",
      detail: `${supplier.qualityPct.toFixed(1)}% of moisture results are within the Masters limit`,
      tab: "raw-material",
      tone: "red"
    });
  }
  return rows;
}

export function buildProcessTracking({
  screeningBags = [],
  meshCatalog = {},
  destoners = [],
  ctcDecimals = 1,
  kilnQc = [],
  inwardOrders = [],
  inwardBags = [],
  moistureLimit = 20,
  kilns = [],
  kilnOutputs = {},
  stations = {},
  outputMinutes = {},
  now = Date.now()
} = {}) {
  const mesh = buildMeshCompliance(screeningBags, meshCatalog);
  const destoner = buildDestonerCompliance(destoners, ctcDecimals);
  const loadCount = Number(destoner.counters[1]?.value) || 0;
  const deviation = buildDeviationRate({
    screeningBags,
    catalog: meshCatalog,
    destonerLoads: loadCount,
    kilnQc
  });
  const ope = buildOverallProcessEfficiency(inwardOrders, inwardBags, {
    kilns,
    kilnOutputs,
    stations,
    destoners,
    outputMinutes,
    now
  });
  const supplier = buildSupplierPhase1(inwardOrders, moistureLimit);
  const painPoints = buildPainPoints({ mesh, destoner, deviation, ope, supplier });
  return { mesh, destoner, deviation, ope, supplier, painPoints };
}
