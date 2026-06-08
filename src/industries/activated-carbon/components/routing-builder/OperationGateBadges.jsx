function badgeClass(type) {
  if (type === "feasibility_gate") return "ac-rb-badge ac-rb-badge--feasibility";
  if (type === "quality_gate") return "ac-rb-badge ac-rb-badge--quality";
  if (type === "custom") return "ac-rb-badge ac-rb-badge--custom";
  return null;
}

function badgeLabel(type) {
  if (type === "feasibility_gate") return "Feasibility Gate";
  if (type === "quality_gate") return "Quality Gate";
  if (type === "custom") return "Custom";
  return null;
}

function OperationGateBadges({ operation }) {
  const badges = [];
  if (operation.gate_type === "feasibility_gate") badges.push("feasibility_gate");
  if (operation.gate_type === "quality_gate") badges.push("quality_gate");
  if (operation.is_custom || operation.gate_type === "custom") badges.push("custom");

  const execFlags = [];
  if (operation.requires_machine) execFlags.push("Machine");
  if (operation.requires_labor) execFlags.push("Crew");
  if (operation.requires_tools) execFlags.push("Tools");

  if (!badges.length && !execFlags.length) return null;

  return (
    <div className="ac-rb-badges">
      {badges.map((type) => (
        <span key={type} className={badgeClass(type)}>
          {badgeLabel(type)}
        </span>
      ))}
      {execFlags.map((label) => (
        <span key={label} className="ac-rb-badge ac-rb-badge--exec">
          {label}
        </span>
      ))}
    </div>
  );
}

export default OperationGateBadges;
