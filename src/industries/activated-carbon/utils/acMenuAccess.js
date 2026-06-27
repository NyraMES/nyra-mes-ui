import { MES_ROLES } from "../../../auth/roles";

/** Demo users may open these sidebar destinations only. */
export const AC_DEMO_ALLOWED_MENU_IDS = new Set(["dashboard", "feasibility"]);

const NON_DEMO_OVERRIDES = [
  MES_ROLES.SUPER_ADMIN,
  MES_ROLES.ADMIN,
  MES_ROLES.PLANNER,
  MES_ROLES.OPERATOR,
  MES_ROLES.QUALITY,
  MES_ROLES.VIEWER
];

/** True when the user is a prospect/demo viewer (MES_Demo only, no other MES role). */
export function userIsAcDemoViewer(roles = []) {
  if (!roles.includes(MES_ROLES.DEMO)) return false;
  return !roles.some((role) => NON_DEMO_OVERRIDES.includes(role));
}

/** Sidebar + deep-link guard for Activated Carbon menu items. */
export function canAccessAcMenuItem(menuId, roles = []) {
  if (!userIsAcDemoViewer(roles)) return true;
  return AC_DEMO_ALLOWED_MENU_IDS.has(menuId);
}

export const AC_DEMO_BLOCKED_HINT =
  "Not available in demo — contact Nyra for full access.";
