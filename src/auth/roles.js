export const MES_ROLES = {
  ADMIN: "MES_Admin",
  PLANNER: "MES_Planner",
  OPERATOR: "MES_Operator",
  QUALITY: "MES_Quality",
  VIEWER: "MES_Viewer"
};

export const ROLE_LABELS = {
  [MES_ROLES.ADMIN]: "Administrator",
  [MES_ROLES.PLANNER]: "Production Planner",
  [MES_ROLES.OPERATOR]: "Shop Floor Operator",
  [MES_ROLES.QUALITY]: "Quality Engineer",
  [MES_ROLES.VIEWER]: "Read-only Viewer"
};

/** Primary label for the user's highest-privilege role. */
export function primaryRoleLabel(roles = []) {
  const order = [
    MES_ROLES.ADMIN,
    MES_ROLES.PLANNER,
    MES_ROLES.QUALITY,
    MES_ROLES.OPERATOR,
    MES_ROLES.VIEWER
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

/** Route-level RBAC for workflow screens. Admin always passes. */
export function userHasAnyRole(userRoles = [], allowed = []) {
  if (!allowed.length) return true;
  if (userRoles.includes(MES_ROLES.ADMIN)) return true;
  return allowed.some((role) => userRoles.includes(role));
}

export const WORKFLOW_ROUTE_ROLES = {
  "customer-order": [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
  "production-order": [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
  "lot-split": [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
  routing: [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
  feasibility: [MES_ROLES.ADMIN, MES_ROLES.PLANNER, MES_ROLES.VIEWER],
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
