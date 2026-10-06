export const GR_COCONUT_SHELL_CODE = "RAW-COCO-SHELL";
export const GR_COCONUT_SHELL_NAME = "Coconut Shell (GR)";

export function isGrCoconutShellType(type) {
  if (!type) return false;
  const code = String(type.product_code || "").toUpperCase();
  const name = String(type.product_name || "").toLowerCase();
  if (code === GR_COCONUT_SHELL_CODE) return true;
  return name.includes("coconut") && (name.includes("(gr)") || name.includes("gr carbons") || /\bgr\b/.test(name));
}

export function keepGrCoconutShellTypes(types = []) {
  const rows = Array.isArray(types) ? types : [];
  const matches = rows.filter(isGrCoconutShellType);
  if (!matches.length) return rows;
  const active = matches.filter(
    (row) => !row.is_obsolete && String(row.status || "").toUpperCase() !== "OBSOLETE"
  );
  return active.length ? active : matches;
}
