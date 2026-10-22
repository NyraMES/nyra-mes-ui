import { MES_ROLES } from "../../../auth/roles";
import {
  isAcDestoningQualityStep,
  isAcFgQcStep,
  isAcKilnFeedQualityStep,
  isAcKilnOutputQualityStep,
  isAcPostActivationQualityStep,
  acExecutionStageOf
} from "./acExecutionOperations";

function identityLocalPart(user) {
  const raw = String(user?.username || user?.email || "").trim().toLowerCase();
  return raw.split("@")[0];
}

/** Nyra operator login — Masters plus full plant screens. */
export function userIsNyraServices(user) {
  return identityLocalPart(user) === "nyraservices";
}

function userIsNyraPlantOperator(roles = [], user = null) {
  return roles.includes(MES_ROLES.SUPER_ADMIN) || userIsNyraServices(user);
}

/** Plant Admin role (MES_Admin) — same Admin screens as supervisor. */
export function userIsAcAdmin(roles = []) {
  return roles.includes(MES_ROLES.ADMIN);
}

export function userIsAcManager(roles = []) {
  return roles.includes(MES_ROLES.MANAGER) || roles.includes(MES_ROLES.PLANNER);
}

export function userCanAccessAcRms(roles = [], user = null) {
  return userIsNyraPlantOperator(roles, user) || userIsAcManager(roles) || roles.includes(MES_ROLES.RMS);
}

/** Bag generation after gate receipt: RMS engineer on Inbound prep. Supervisor does not enter bags. */
export function userCanEnterAcInboundBags(roles = [], user = null) {
  return userIsNyraPlantOperator(roles, user) || roles.includes(MES_ROLES.RMS);
}

/** GRN after Lab: the RMS engineer records rotary grade bags. */
export function userCanRecordAcRmsOutward(roles = [], user = null) {
  return userIsNyraPlantOperator(roles, user) || roles.includes(MES_ROLES.RMS);
}

/** Raw-material Lab is a quality check. Only the Quality login records it. */
export function userCanRecordAcLab(roles = [], user = null) {
  return userIsNyraPlantOperator(roles, user) || roles.includes(MES_ROLES.QUALITY);
}

/** Debit note: supervisor (manager, planner, plant admin). Quality records Lab only. */
export function userCanRaiseAcDebitNote(roles = [], user = null) {
  return userIsNyraPlantOperator(roles, user) || userIsAcAdmin(roles) || userIsAcManager(roles);
}

export function userCanAccessAcActivation(roles = [], user = null) {
  return (
    userIsNyraPlantOperator(roles, user) ||
    userIsAcManager(roles) ||
    roles.includes(MES_ROLES.ACTIVATION) ||
    roles.includes(MES_ROLES.OPERATOR)
  );
}

export function userCanAccessAcPostActivation(roles = [], user = null) {
  return (
    userIsNyraPlantOperator(roles, user) ||
    userIsAcManager(roles) ||
    roles.includes(MES_ROLES.POST_ACTIVATION) ||
    roles.includes(MES_ROLES.OPERATOR)
  );
}

export function userCanAccessAcQuality(roles = [], user = null) {
  return userIsNyraPlantOperator(roles, user) || userIsAcManager(roles) || roles.includes(MES_ROLES.QUALITY);
}

export function userIsAcQualityOnly(roles = [], user = null) {
  if (userIsNyraPlantOperator(roles, user)) return false;
  if (!roles.includes(MES_ROLES.QUALITY)) return false;
  if (userIsAcManager(roles)) return false;
  return !roles.includes(MES_ROLES.ACTIVATION) && !roles.includes(MES_ROLES.POST_ACTIVATION);
}

export function userCanRunAcMachines(roles = [], user = null) {
  return userCanAccessAcActivation(roles, user) || userCanAccessAcPostActivation(roles, user);
}

export function userCanAccessAcMasters(_roles = [], user = null) {
  return userIsNyraServices(user);
}

/** Gate receipt tab: supervisor (manager, planner, plant admin) and security. */
export function userCanAccessAcGateReceipt(roles = [], user = null) {
  return (
    userIsNyraPlantOperator(roles, user) ||
    userIsAcAdmin(roles) ||
    userIsAcManager(roles) ||
    roles.includes(MES_ROLES.SECURITY)
  );
}

/** Security login with no shop-floor or supervisor role. */
export function userIsAcSecurityOnly(roles = [], user = null) {
  if (userIsNyraPlantOperator(roles, user) || userIsAcAdmin(roles) || userIsAcManager(roles)) return false;
  if (!roles.includes(MES_ROLES.SECURITY)) return false;
  return !(
    roles.includes(MES_ROLES.RMS) ||
    roles.includes(MES_ROLES.ACTIVATION) ||
    roles.includes(MES_ROLES.POST_ACTIVATION) ||
    roles.includes(MES_ROLES.QUALITY) ||
    roles.includes(MES_ROLES.OPERATOR)
  );
}

/** Supplier name and code on a gate receipt: supervisor, plant admin, Nyra, and security. */
export function userCanSeeAcSupplier(roles = [], user = null) {
  return userCanAccessAcGateReceipt(roles, user);
}

/** Admin: Users, suppliers, destoning CTC, work orders. */
export function userCanAccessAcDestoningCtc(roles = [], user = null) {
  return userIsNyraServices(user) || userIsAcAdmin(roles) || userIsAcManager(roles);
}

/** Shop-floor engineer: RMS, activation, post-activation, quality, or operator. */
export function userIsAcEngineer(roles = [], user = null) {
  if (userCanAccessAcDestoningCtc(roles, user) || userIsNyraPlantOperator(roles, user)) return false;
  return (
    roles.includes(MES_ROLES.RMS) ||
    roles.includes(MES_ROLES.ACTIVATION) ||
    roles.includes(MES_ROLES.POST_ACTIVATION) ||
    roles.includes(MES_ROLES.QUALITY) ||
    roles.includes(MES_ROLES.OPERATOR)
  );
}

/** Admin, supervisor, and viewer keep the plant dashboard. */
export function userSeesAcPlantDashboard(roles = [], user = null) {
  return !userIsAcEngineer(roles, user) && !userIsAcSecurityOnly(roles, user);
}

/** Raw Material tabs this login may open. Gate receipt is supervisor and security. Lab is Quality. */
export function acRawMaterialTabsForRoles(roles = [], user = null) {
  if (userIsAcSecurityOnly(roles, user)) return ["inward"];
  const qualityShop =
    userCanRecordAcLab(roles, user) &&
    !userCanAccessAcRms(roles, user) &&
    !userCanAccessAcGateReceipt(roles, user);
  if (qualityShop) return ["prep"];
  const tabs = [];
  if (userCanAccessAcGateReceipt(roles, user)) tabs.push("inward");
  tabs.push("prep", "release", "reports");
  return tabs;
}

/**
 * Week-chart lines for a shop login. Plant Manager and Admin stay on the plant dashboard.
 * One line per role. An operator covers Activation and Post Activation.
 */
export function acPerformanceAreas(roles = []) {
  const areas = [];
  if (roles.includes(MES_ROLES.RMS)) areas.push("rms");
  if (roles.includes(MES_ROLES.SECURITY)) areas.push("entry");
  if (roles.includes(MES_ROLES.ACTIVATION) || roles.includes(MES_ROLES.OPERATOR)) areas.push("activation");
  if (roles.includes(MES_ROLES.POST_ACTIVATION) || roles.includes(MES_ROLES.OPERATOR)) areas.push("post");
  if (roles.includes(MES_ROLES.QUALITY)) areas.push("quality");
  return areas;
}

/** RMS engineer with no activation, post-activation, or quality role. */
export function userIsAcRmsOnly(roles = [], user = null) {
  if (!userIsAcEngineer(roles, user) || !roles.includes(MES_ROLES.RMS)) return false;
  return (
    !userCanAccessAcActivation(roles, user) &&
    !userCanAccessAcPostActivation(roles, user) &&
    !userCanAccessAcQuality(roles, user)
  );
}

export function userCanAccessAcUsers(roles = [], user = null) {
  return userCanAccessAcDestoningCtc(roles, user);
}

export function userCanAccessAcAdmin(roles = [], user = null) {
  return userCanAccessAcDestoningCtc(roles, user);
}

export function userCanAccessAcReports(roles = [], user = null) {
  return userIsNyraPlantOperator(roles, user) || userIsAcManager(roles) || roles.includes(MES_ROLES.VIEWER);
}

export function userCanAccessAcDispatch(roles = [], user = null) {
  return userIsNyraPlantOperator(roles, user) || userIsAcManager(roles);
}

export function acExecutionStagesForRoles(roles = [], user = null) {
  if (userIsNyraPlantOperator(roles, user) || userIsAcManager(roles) || userIsAcQualityOnly(roles, user)) {
    return ["activation", "post_activation"];
  }
  const stages = [];
  if (userCanAccessAcActivation(roles, user)) stages.push("activation");
  if (userCanAccessAcPostActivation(roles, user)) stages.push("post_activation");
  return stages;
}

function isAcQualityCaptureStep(operation) {
  return (
    isAcKilnFeedQualityStep(operation) ||
    isAcKilnOutputQualityStep(operation) ||
    isAcDestoningQualityStep(operation) ||
    isAcPostActivationQualityStep(operation) ||
    isAcFgQcStep(operation)
  );
}

export function acOperationVisibleForRoles(operation, roles = [], user = null) {
  if (!operation) return false;
  if (userIsNyraPlantOperator(roles, user) || userIsAcManager(roles)) return true;
  if (isAcQualityCaptureStep(operation)) return userCanAccessAcQuality(roles, user);
  if (userIsAcQualityOnly(roles, user)) return false;
  const activation = userCanAccessAcActivation(roles, user);
  const post = userCanAccessAcPostActivation(roles, user);
  if (activation && post) return true;
  if (activation) return acExecutionStageOf(operation) === "activation";
  if (post) return acExecutionStageOf(operation) === "post_activation";
  return false;
}
