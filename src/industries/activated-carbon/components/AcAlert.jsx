const VARIANTS = {
  error: "ac-alert--error border-red-200 bg-red-50 text-red-800",
  success: "ac-alert--success border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "ac-alert--warning border-amber-200 bg-amber-50 text-amber-900",
  info: "ac-alert--info border-blue-200 bg-blue-50 text-blue-900"
};

function AcAlert({ variant = "error", children, className = "" }) {
  if (!children) return null;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${VARIANTS[variant] || VARIANTS.error} ${className}`}
    >
      {children}
    </div>
  );
}

export default AcAlert;
