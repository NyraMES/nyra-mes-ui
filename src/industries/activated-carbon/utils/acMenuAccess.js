import { MES_ROLES } from "../../../auth/roles";
import {
  userCanAccessAcActivation,
  userCanAccessAcDispatch,
  userCanAccessAcDestoningCtc,
  userCanAccessAcMasters,
  userCanAccessAcPostActivation,
  userCanAccessAcQuality,
  userCanAccessAcReports,
  userCanAccessAcRms,
  userCanAccessAcGateReceipt,
  userIsAcSecurityOnly,
  userCanAccessAcUsers,
  userIsAcAdmin,
  userIsNyraServices
} from "./acPrivileges";

/** Demo users may open these sidebar destinations only. */
export const AC_DEMO_ALLOWED_MENU_IDS = new Set(["dashboard", "execution"]);

const NON_DEMO_OVERRIDES = [
  MES_ROLES.SUPER_ADMIN,
  MES_ROLES.ADMIN,
  MES_ROLES.MANAGER,
  MES_ROLES.PLANNER,
  MES_ROLES.OPERATOR,
  MES_ROLES.QUALITY,
  MES_ROLES.RMS,
  MES_ROLES.SECURITY,
  MES_ROLES.ACTIVATION,
  MES_ROLES.POST_ACTIVATION,
  MES_ROLES.VIEWER
];

/** True when the user is a prospect/demo viewer (MES_Demo only, no other MES role). */
export function userIsAcDemoViewer(roles = []) {
  if (!roles.includes(MES_ROLES.DEMO)) return false;
  return !roles.some((role) => NON_DEMO_OVERRIDES.includes(role));
}

function menuAllowedByRole(menuId, roles = [], user = null) {
  if (menuId === "routing-builder") {
    return userCanAccessAcMasters(roles, user);
  }
  if (menuId === "masters") {
    return userCanAccessAcMasters(roles, user);
  }
  if (userIsNyraServices(user) || roles.includes(MES_ROLES.SUPER_ADMIN)) {
    return true;
  }
  if (menuId === "admin") {
    return userCanAccessAcDestoningCtc(roles, user);
  }
  if (menuId === "users") {
    return userCanAccessAcUsers(roles, user);
  }
  if (userIsAcSecurityOnly(roles, user)) {
    return menuId === "dashboard" || menuId === "raw-material";
  }
  if (userIsAcAdmin(roles)) {
    return menuId === "dashboard" || menuId === "admin" || menuId === "users" || menuId === "raw-material";
  }
  switch (menuId) {
    case "dashboard":
      return true;
    case "raw-material":
      return (
        userCanAccessAcRms(roles, user) ||
        userCanAccessAcGateReceipt(roles, user) ||
        roles.includes(MES_ROLES.QUALITY)
      );
    case "bag-tracing":
      return userCanAccessAcReports(roles, user) || userCanAccessAcDestoningCtc(roles, user);
    case "execution":
      return (
        userCanAccessAcActivation(roles) ||
        userCanAccessAcPostActivation(roles) ||
        userCanAccessAcQuality(roles)
      );
    case "dispatch":
      return userCanAccessAcDispatch(roles);
    case "reports":
      return userCanAccessAcReports(roles);
    default:
      return false;
  }
}

/** Sidebar + deep-link guard for Activated Carbon menu items. */
export function canAccessAcMenuItem(menuId, roles = [], user = null) {
  if (userIsAcDemoViewer(roles)) return AC_DEMO_ALLOWED_MENU_IDS.has(menuId);
  return menuAllowedByRole(menuId, roles, user);
}

export const AC_DEMO_BLOCKED_HINT =
  "Not available for this role — contact your plant administrator.";
