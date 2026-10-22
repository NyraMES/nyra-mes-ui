import assert from "node:assert/strict";
import test from "node:test";

import { MES_ROLES } from "../../../auth/roles.js";
import {
  buildAreaWeeks,
  buildEngineerWeek,
  checksOnDay,
  collectEngineerChecks,
  collectReceiptChecks,
  currentWeekDays
} from "./acEngineerPerformance.js";
import { canAccessAcMenuItem } from "./acMenuAccess.js";
import { acOperationVisibleForRoles } from "./acPrivileges.js";
import {
  acPerformanceAreas,
  acRawMaterialTabsForRoles,
  userCanEnterAcInboundBags,
  userCanRaiseAcDebitNote,
  userCanRecordAcLab,
  userCanRecordAcRmsOutward,
  userCanSeeAcSupplier,
  userIsAcEngineer,
  userIsAcRmsOnly,
  userIsAcSecurityOnly,
  userSeesAcPlantDashboard
} from "./acPrivileges.js";

const NOW = new Date(2026, 9, 14, 12, 0, 0);
const ENGINEER = "activation@plant";
const LEAD = "lead@plant";

function saved(bag, user, kg, at, extra = {}) {
  return { bag_code: bag, quantity_kg: kg, user_id: user, saved_at: at, ...extra };
}

function weekChecks() {
  return collectEngineerChecks({
    kilnBags: [
      saved("KA_131026_00001", ENGINEER, 100, "2026-10-13T04:30:00Z"),
      saved("KA_131026_00002", "maker", 50, "", { created_at: "2026-10-13T05:00:00Z", created_by: "maker" })
    ],
    destonQc: [
      saved("DS_131026_00001", LEAD, 80, "2026-10-14T03:30:00Z"),
      saved("DS_131026_00002", ENGINEER, 40, "2026-10-14T05:30:00Z"),
      saved("DS_061026_00001", ENGINEER, 200, "2026-10-06T05:30:00Z")
    ],
    qualitySections: [
      {
        process: "screening",
        process_label: "Screening",
        bags: [saved("SC_131026_00001", LEAD, 90, "2026-10-13T08:00:00Z")]
      }
    ]
  });
}

test("unsaved bags and last week's checks stay off this week's line", () => {
  const checks = weekChecks();
  assert.deepEqual(
    checks.map((row) => row.bag),
    [
      "KA_131026_00001",
      "KA_131026_00002",
      "DS_131026_00001",
      "DS_131026_00002",
      "DS_061026_00001",
      "SC_131026_00001"
    ]
  );
  const week = buildEngineerWeek(checks, [ENGINEER], { now: NOW });
  assert.deepEqual(currentWeekDays(NOW), [
    "2026-10-12",
    "2026-10-13",
    "2026-10-14",
    "2026-10-15",
    "2026-10-16",
    "2026-10-17",
    "2026-10-18"
  ]);
  assert.equal(week.yourWeekKg, 140);
  assert.equal(week.series.find((row) => row.day === "2026-10-15").you, null);
  assert.equal(week.series.find((row) => row.day === "2026-10-15").expected, null);
});

test("engineer line sits against the top performer, with that day's bags listed", () => {
  const checks = weekChecks();
  const week = buildEngineerWeek(checks, [ENGINEER], { now: NOW });
  assert.equal(week.youAreTop, false);
  assert.equal(week.topActor, LEAD);
  assert.equal(week.topWeekKg, 170);
  assert.equal(week.yourWeekKg, 140);
  const byDay = Object.fromEntries(week.series.map((row) => [row.label, row]));
  assert.equal(byDay["Mon 12"].you, 0);
  assert.equal(byDay["Mon 12"].expected, 0);
  assert.equal(byDay["Tue 13"].you, 100);
  assert.equal(byDay["Tue 13"].expected, 90);
  assert.equal(byDay["Wed 14"].you, 40);
  assert.equal(byDay["Wed 14"].expected, 80);

  const wednesday = checksOnDay(checks, [ENGINEER, "Activation@Plant"], "2026-10-14");
  assert.deepEqual(
    wednesday.map((row) => [row.process, row.bag, row.kg]),
    [["Destoning quality", "DS_131026_00002", 40]]
  );
});

test("quality checks stay off the activation and post-activation lines", () => {
  const checks = collectEngineerChecks({
    kilnBags: [
      saved("KA_131026_00001", "quality@plant", 100, "2026-10-13T04:30:00Z", {
        created_at: "2026-10-13T04:00:00Z",
        created_by: ENGINEER
      })
    ],
    destonQc: [
      saved("DS_131026_00002", "quality@plant", 40, "2026-10-14T05:30:00Z", {
        created_at: "2026-10-14T05:00:00Z",
        created_by: ENGINEER
      })
    ],
    qualitySections: [
      {
        process: "screening",
        process_label: "Screening",
        bags: [saved("SC_131026_00001", LEAD, 90, "2026-10-13T08:00:00Z")]
      }
    ],
    postOutputs: [
      {
        bag_code: "SC_131026_00008",
        quantity_kg: 70,
        created_at: "2026-10-13T07:00:00Z",
        created_by: "post@plant",
        process_label: "Screening"
      }
    ]
  });
  assert.equal(checks.find((row) => row.process === "Kiln output").area, "activation");
  assert.equal(checks.find((row) => row.process === "Destoning").area, "activation");
  assert.equal(checks.find((row) => row.process === "Kiln output quality").area, "quality");
  assert.equal(checks.find((row) => row.process === "Destoning quality").area, "quality");
  assert.equal(checks.find((row) => row.process === "Screening quality").area, "quality");
  assert.equal(checks.find((row) => row.process === "Screening").area, "post");
  const split = buildAreaWeeks(checks, [ENGINEER], ["activation", "post", "quality"], { now: NOW });
  assert.equal(split.weeks.activation.yourWeekKg, 140);
  assert.equal(split.weeks.activation.youAreTop, true);
  assert.equal(split.weeks.post.yourWeekKg, 0);
  assert.equal(split.weeks.post.topActor, "post@plant");
  assert.equal(split.weeks.post.topWeekKg, 70);
  assert.equal(split.weeks.quality.yourWeekKg, 0);
  assert.equal(split.weeks.quality.topActor, "quality@plant");
  assert.equal(split.weeks.quality.topWeekKg, 140);
  const tuesday = split.series.find((row) => row.day === "2026-10-13");
  assert.equal(tuesday.activation, 100);
  assert.equal(tuesday.post, 0);
  assert.equal(tuesday.postExpected, 70);
  assert.equal(tuesday.quality, 0);
  assert.equal(tuesday.qualityExpected, 100);
  assert.equal(tuesday.activationExpected, null);
});

test("when the engineer is the top performer the expected line is their own week", () => {
  const checks = collectEngineerChecks({
    kilnBags: [saved("KA_141026_00001", ENGINEER, 90, "2026-10-14T06:00:00Z")],
    destonQc: [saved("DS_141026_00001", LEAD, 30, "2026-10-14T04:00:00Z")],
    qualitySections: []
  });
  const week = buildEngineerWeek(checks, [ENGINEER], { now: NOW });
  assert.equal(week.youAreTop, true);
  assert.equal(week.topActor, "");
  assert.equal(week.topWeekKg, 90);
  assert.equal(week.yourWeekCount, 1);
  assert.ok(week.series.every((row) => row.expected == null));
  assert.equal(week.series.find((row) => row.day === "2026-10-14").you, 90);
});

test("email and username for the same person add up as one line", () => {
  const checks = collectEngineerChecks({
    kilnBags: [saved("KA_131026_00009", "activation@plant", 25, "2026-10-13T06:00:00Z")],
    destonQc: [saved("DS_131026_00009", "activation.user", 15, "2026-10-14T06:00:00Z")],
    qualitySections: []
  });
  const week = buildEngineerWeek(checks, ["activation@plant", "activation.user"], { now: NOW });
  assert.equal(week.youAreTop, true);
  assert.equal(week.yourWeekKg, 40);
  assert.equal(week.yourWeekCount, 2);
});

test("kiln output quality is recorded by Quality", () => {
  const kilnQuality = { operation_code: "OP-KILN-OUT-QC", operation_name: "Kiln output quality" };
  const kilnFeed = { operation_code: "OP-KILN-FEED", operation_name: "Kiln feed" };
  const destonQuality = { operation_code: "OP-DESTON-QC", operation_name: "Destoning quality" };
  const postQuality = { operation_code: "OP-POST-QC", operation_name: "Quality" };
  const activation = [MES_ROLES.ACTIVATION];
  const quality = [MES_ROLES.QUALITY];
  const user = { username: "floor@grcarbons" };
  assert.equal(acOperationVisibleForRoles(kilnQuality, activation, user), false);
  assert.equal(acOperationVisibleForRoles(destonQuality, activation, user), false);
  assert.equal(acOperationVisibleForRoles(postQuality, activation, user), false);
  assert.equal(acOperationVisibleForRoles(kilnFeed, activation, user), true);
  assert.equal(acOperationVisibleForRoles(kilnQuality, [MES_ROLES.OPERATOR], user), false);
  assert.equal(acOperationVisibleForRoles(kilnQuality, quality, user), true);
  assert.equal(acOperationVisibleForRoles(kilnFeed, quality, user), false);
  assert.equal(
    acOperationVisibleForRoles(kilnQuality, [MES_ROLES.MANAGER], { username: "manager@grcarbons" }),
    true
  );
});

test("admin, supervisor, and viewer keep the plant dashboard", () => {
  const engineerRoles = [
    MES_ROLES.RMS,
    MES_ROLES.ACTIVATION,
    MES_ROLES.POST_ACTIVATION,
    MES_ROLES.QUALITY,
    MES_ROLES.OPERATOR
  ];
  for (const role of engineerRoles) {
    assert.equal(userIsAcEngineer([role], { username: "floor" }), true);
    assert.equal(userSeesAcPlantDashboard([role], { username: "floor" }), false);
  }
  const plantLogins = [
    { roles: [MES_ROLES.ADMIN], user: { username: "plantadmin" } },
    { roles: [MES_ROLES.MANAGER], user: { username: "supervisor" } },
    { roles: [MES_ROLES.PLANNER], user: { username: "planner" } },
    { roles: [MES_ROLES.VIEWER], user: { username: "viewer" } },
    { roles: [MES_ROLES.SUPER_ADMIN], user: { username: "nyraservices", email: "nyraservices@grcarbons" } },
    { roles: [MES_ROLES.ACTIVATION], user: { username: "nyraservices", email: "nyraservices@grcarbons" } }
  ];
  for (const login of plantLogins) {
    assert.equal(userSeesAcPlantDashboard(login.roles, login.user), true, login.user.username);
  }
  assert.equal(
    userSeesAcPlantDashboard([MES_ROLES.MANAGER, MES_ROLES.ACTIVATION], { username: "lead" }),
    true
  );
});

test("two shop roles draw one performance line each", () => {
  assert.deepEqual(acPerformanceAreas([MES_ROLES.ACTIVATION, MES_ROLES.POST_ACTIVATION]), [
    "activation",
    "post"
  ]);
  assert.deepEqual(acPerformanceAreas([MES_ROLES.RMS, MES_ROLES.QUALITY]), ["rms", "quality"]);
  assert.deepEqual(acPerformanceAreas([MES_ROLES.SECURITY, MES_ROLES.ACTIVATION]), ["entry", "activation"]);
  assert.deepEqual(acPerformanceAreas([MES_ROLES.OPERATOR]), ["activation", "post"]);
  assert.deepEqual(acPerformanceAreas([MES_ROLES.ADMIN, MES_ROLES.ACTIVATION]), ["activation"]);
  const checks = collectReceiptChecks(
    [{ order_code: "ORD-1", our_weight_kg: 25, created_at: "2026-10-14T04:00:00Z", rms_bag_weight_kg: 20 }],
    { area: "entry", mode: "our_weight" }
  );
  assert.equal(checks[0].area, "entry");
  assert.equal(checks[0].kg, 25);
  assert.equal(checks[0].actor, "__plant__");
});

test("an RMS engineer sees raw material only", () => {
  const roles = [MES_ROLES.RMS];
  const user = { username: "rms@grcarbons" };
  assert.equal(userIsAcRmsOnly(roles, user), true);
  assert.equal(canAccessAcMenuItem("dashboard", roles, user), true);
  assert.equal(canAccessAcMenuItem("raw-material", roles, user), true);
  for (const menuId of ["bag-tracing", "execution", "dispatch", "reports", "admin", "masters", "routing-builder"]) {
    assert.equal(canAccessAcMenuItem(menuId, roles, user), false, menuId);
  }
  assert.equal(userIsAcRmsOnly([MES_ROLES.RMS, MES_ROLES.ACTIVATION], { username: "both" }), false);
});

test("supplier identity is manager and supervisor only", () => {
  const hidden = [
    [MES_ROLES.RMS],
    [MES_ROLES.ACTIVATION],
    [MES_ROLES.POST_ACTIVATION],
    [MES_ROLES.QUALITY],
    [MES_ROLES.OPERATOR],
    [MES_ROLES.VIEWER]
  ];
  for (const roles of hidden) {
    assert.equal(userCanSeeAcSupplier(roles, { username: "eng@grcarbons" }), false, roles.join(","));
  }
  assert.equal(userCanSeeAcSupplier([MES_ROLES.MANAGER], { username: "manager@grcarbons" }), true);
  assert.equal(userCanSeeAcSupplier([MES_ROLES.PLANNER], { username: "planner@grcarbons" }), true);
  assert.equal(userCanSeeAcSupplier([MES_ROLES.ADMIN], { username: "admin@grcarbons" }), true);
  assert.equal(userCanSeeAcSupplier([], { username: "nyraservices@grcarbons" }), true);
  assert.equal(userCanSeeAcSupplier([MES_ROLES.SECURITY], { username: "security@grcarbons" }), true);
});

test("gate receipt is for the supervisor and security", () => {
  const security = [MES_ROLES.SECURITY];
  const securityUser = { username: "security@grcarbons" };
  assert.equal(userIsAcSecurityOnly(security, securityUser), true);
  assert.equal(userSeesAcPlantDashboard(security, securityUser), false);
  assert.deepEqual(acRawMaterialTabsForRoles(security, securityUser), ["inward"]);
  assert.equal(canAccessAcMenuItem("raw-material", security, securityUser), true);
  assert.equal(canAccessAcMenuItem("dashboard", security, securityUser), true);
  for (const menuId of ["bag-tracing", "execution", "dispatch", "reports", "admin", "masters"]) {
    assert.equal(canAccessAcMenuItem(menuId, security, securityUser), false, menuId);
  }
  assert.deepEqual(acRawMaterialTabsForRoles([MES_ROLES.RMS], { username: "rms@grcarbons" }), [
    "prep",
    "release",
    "reports"
  ]);
  assert.equal(userCanEnterAcInboundBags([MES_ROLES.RMS], { username: "rms@grcarbons" }), true);
  assert.equal(userCanRecordAcRmsOutward([MES_ROLES.RMS], { username: "rms@grcarbons" }), true);
  assert.equal(userCanRecordAcRmsOutward([MES_ROLES.QUALITY], { username: "quality@grcarbons" }), false);
  assert.equal(userCanRecordAcRmsOutward([MES_ROLES.MANAGER], { username: "manager@grcarbons" }), false);
  assert.equal(userCanEnterAcInboundBags([MES_ROLES.MANAGER], { username: "manager@grcarbons" }), false);
  assert.equal(userCanEnterAcInboundBags([MES_ROLES.SECURITY], { username: "security@grcarbons" }), false);
  assert.equal(userCanRecordAcLab([MES_ROLES.QUALITY], { username: "quality@grcarbons" }), true);
  assert.equal(userCanRecordAcLab([MES_ROLES.RMS], { username: "rms@grcarbons" }), false);
  assert.equal(userCanRecordAcLab([MES_ROLES.MANAGER], { username: "manager@grcarbons" }), false);
  assert.equal(userCanRaiseAcDebitNote([MES_ROLES.MANAGER], { username: "manager@grcarbons" }), true);
  assert.equal(userCanRaiseAcDebitNote([MES_ROLES.PLANNER], { username: "planner@grcarbons" }), true);
  assert.equal(userCanRaiseAcDebitNote([MES_ROLES.ADMIN], { username: "admin@grcarbons" }), true);
  assert.equal(userCanRaiseAcDebitNote([MES_ROLES.QUALITY], { username: "quality@grcarbons" }), false);
  assert.equal(userCanRaiseAcDebitNote([MES_ROLES.RMS], { username: "rms@grcarbons" }), false);
  assert.equal(canAccessAcMenuItem("raw-material", [MES_ROLES.QUALITY], { username: "quality@grcarbons" }), true);
  assert.deepEqual(acRawMaterialTabsForRoles([MES_ROLES.QUALITY], { username: "quality@grcarbons" }), ["prep"]);
  assert.deepEqual(
    acRawMaterialTabsForRoles([MES_ROLES.MANAGER], { username: "manager@grcarbons" }),
    ["inward", "prep", "release", "reports"]
  );
});
