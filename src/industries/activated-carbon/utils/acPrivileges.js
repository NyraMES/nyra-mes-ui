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

/** Plant Administrator — Users screen only. */
export function userIsAcAdmin(roles = []) {
  return roles.includes(MES_ROLES.ADMIN);
}

export function userIsAcManager(roles = []) {
  return roles.includes(MES_ROLES.MANAGER) || roles.includes(MES_ROLES.PLANNER);
}

export function userCanAccessAcRms(roles = [], user = null) {
  return userIsNyraPlantOperator(roles, user) || userIsAcManager(roles) || roles.includes(MES_ROLES.RMS);
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

export function userCanAccessAcUsers(roles = [], user = null) {
  return userIsAcAdmin(roles) || userIsNyraServices(user);
}

export function userCanAccessAcAdmin(roles = [], user = null) {
  return userCanAccessAcUsers(roles, user);
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

export function acOperationVisibleForRoles(operation, roles = [], user = null) {
  if (!operation) return false;
  if (userIsNyraPlantOperator(roles, user) || userIsAcManager(roles)) return true;
  if (userIsAcQualityOnly(roles, user)) {
    return (
      isAcKilnFeedQualityStep(operation) ||
      isAcKilnOutputQualityStep(operation) ||
      isAcDestoningQualityStep(operation) ||
      isAcPostActivationQualityStep(operation) ||
      isAcFgQcStep(operation)
    );
  }
  const activation = userCanAccessAcActivation(roles, user);
  const post = userCanAccessAcPostActivation(roles, user);
  if (activation && post) return true;
  if (activation) return acExecutionStageOf(operation) === "activation";
  if (post) return acExecutionStageOf(operation) === "post_activation";
  return false;
}
