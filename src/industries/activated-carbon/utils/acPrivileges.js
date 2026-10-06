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

/** Nyra operator login — Masters and routing only. */
export function userIsNyraServices(user) {
  return identityLocalPart(user) === "nyraservices";
}

/** Plant Administrator — Users screen only. */
export function userIsAcAdmin(roles = []) {
  return roles.includes(MES_ROLES.ADMIN);
}

export function userIsAcManager(roles = []) {
  return roles.includes(MES_ROLES.MANAGER) || roles.includes(MES_ROLES.PLANNER);
}

export function userCanAccessAcRms(roles = []) {
  return userIsAcManager(roles) || roles.includes(MES_ROLES.RMS);
}

export function userCanAccessAcActivation(roles = []) {
  return (
    userIsAcManager(roles) ||
    roles.includes(MES_ROLES.ACTIVATION) ||
    roles.includes(MES_ROLES.OPERATOR)
  );
}

export function userCanAccessAcPostActivation(roles = []) {
  return (
    userIsAcManager(roles) ||
    roles.includes(MES_ROLES.POST_ACTIVATION) ||
    roles.includes(MES_ROLES.OPERATOR)
  );
}

export function userCanAccessAcQuality(roles = []) {
  return userIsAcManager(roles) || roles.includes(MES_ROLES.QUALITY);
}

export function userIsAcQualityOnly(roles = []) {
  if (!roles.includes(MES_ROLES.QUALITY)) return false;
  if (userIsAcManager(roles)) return false;
  return !roles.includes(MES_ROLES.ACTIVATION) && !roles.includes(MES_ROLES.POST_ACTIVATION);
}

export function userCanRunAcMachines(roles = []) {
  return userCanAccessAcActivation(roles) || userCanAccessAcPostActivation(roles);
}

export function userCanAccessAcMasters(_roles = [], user = null) {
  return userIsNyraServices(user);
}

export function userCanAccessAcUsers(roles = []) {
  return userIsAcAdmin(roles);
}

export function userCanAccessAcReports(roles = []) {
  return userIsAcManager(roles) || roles.includes(MES_ROLES.VIEWER);
}

export function userCanAccessAcDispatch(roles = []) {
  return userIsAcManager(roles);
}

export function acExecutionStagesForRoles(roles = []) {
  if (userIsAcManager(roles) || userIsAcQualityOnly(roles)) {
    return ["activation", "post_activation"];
  }
  const stages = [];
  if (userCanAccessAcActivation(roles)) stages.push("activation");
  if (userCanAccessAcPostActivation(roles)) stages.push("post_activation");
  return stages;
}

export function acOperationVisibleForRoles(operation, roles = []) {
  if (!operation) return false;
  if (userIsAcManager(roles)) return true;
  if (userIsAcQualityOnly(roles)) {
    return (
      isAcKilnFeedQualityStep(operation) ||
      isAcKilnOutputQualityStep(operation) ||
      isAcDestoningQualityStep(operation) ||
      isAcPostActivationQualityStep(operation) ||
      isAcFgQcStep(operation)
    );
  }
  const activation = userCanAccessAcActivation(roles);
  const post = userCanAccessAcPostActivation(roles);
  if (activation && post) return true;
  if (activation) return acExecutionStageOf(operation) === "activation";
  if (post) return acExecutionStageOf(operation) === "post_activation";
  return false;
}
