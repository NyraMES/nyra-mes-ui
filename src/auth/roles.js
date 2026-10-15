export const MES_ROLES = {
  SUPER_ADMIN: "MES_SuperAdmin",
  ADMIN: "MES_Admin",
  MANAGER: "MES_Manager",
  PLANNER: "MES_Planner",
  OPERATOR: "MES_Operator",
  QUALITY: "MES_Quality",
  RMS: "MES_RMS",
  SECURITY: "MES_Security",
  ACTIVATION: "MES_Activation",
  POST_ACTIVATION: "MES_PostActivation",
  VIEWER: "MES_Viewer",
  DEMO: "MES_Demo"
};

export const ROLE_LABELS = {
  [MES_ROLES.SUPER_ADMIN]: "Super Administrator",
  [MES_ROLES.ADMIN]: "Administrator",
  [MES_ROLES.MANAGER]: "Plant Manager",
  [MES_ROLES.PLANNER]: "Production Planner",
  [MES_ROLES.OPERATOR]: "Shop Floor Operator",
  [MES_ROLES.QUALITY]: "Quality Control",
  [MES_ROLES.RMS]: "Raw-material section",
  [MES_ROLES.SECURITY]: "Plant Entry",
  [MES_ROLES.ACTIVATION]: "Activation",
  [MES_ROLES.POST_ACTIVATION]: "Post Activation",
  [MES_ROLES.VIEWER]: "Read-only Viewer",
  [MES_ROLES.DEMO]: "Demo Viewer"
};

/** Super Admin — raw materials, process routing, and all admin tasks. */
export function userIsSuperAdmin(roles = []) {
  return roles.includes(MES_ROLES.SUPER_ADMIN);
}

/** Admin or Super Admin — customers, suppliers, plant resources, etc. */
export function userCanManageTenantMasters(roles = []) {
  return userIsSuperAdmin(roles) || roles.includes(MES_ROLES.ADMIN);
}

/** Super Admin only — new raw material types and process steps. */
export function userCanConfigureProcessRouting(roles = []) {
  return userIsSuperAdmin(roles);
}

/** Primary label for the user's highest-privilege role. */
export function primaryRoleLabel(roles = []) {
  const order = [
    MES_ROLES.SUPER_ADMIN,
    MES_ROLES.ADMIN,
    MES_ROLES.MANAGER,
    MES_ROLES.PLANNER,
    MES_ROLES.QUALITY,
    MES_ROLES.ACTIVATION,
    MES_ROLES.POST_ACTIVATION,
    MES_ROLES.RMS,
    MES_ROLES.SECURITY,
    MES_ROLES.OPERATOR,
    MES_ROLES.VIEWER,
    MES_ROLES.DEMO
  ];
  for (const role of order) {
    if (roles.includes(role)) {
      return ROLE_LABELS[role] || role;
    }
  }
  return roles[0] || "User";
}

export function initialsFromUser(user) {
  const name = user?.displayName || user?.email || user?.username || "U";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return String(name).slice(0, 2).toUpperCase();
}

/** Route-level RBAC for workflow screens. Super Admin and Admin always pass. */
export function userHasAnyRole(userRoles = [], allowed = []) {
  if (!allowed.length) return true;
  if (userRoles.includes(MES_ROLES.SUPER_ADMIN) || userRoles.includes(MES_ROLES.ADMIN)) {
    return true;
  }
  return allowed.some((role) => userRoles.includes(role));
}

export const WORKFLOW_ROUTE_ROLES = {
  "customer-order": [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
  "production-order": [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
  "lot-split": [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
  routing: [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
  feasibility: [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER, MES_ROLES.DEMO],
  scheduling: [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
  execution: [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.OPERATOR, MES_ROLES.VIEWER],
  inspection: [MES_ROLES.ADMIN, MES_ROLES.QUALITY, MES_ROLES.VIEWER],
  dispatch: [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.QUALITY, MES_ROLES.VIEWER],
  traceability: Object.values(MES_ROLES),
  oee: Object.values(MES_ROLES),
  ontology: Object.values(MES_ROLES),
  "masters/customers": [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
  "masters/parts": [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
  "masters/routings": [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER]
};
