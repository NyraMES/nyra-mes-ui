/** Friendly banner when the signed-in user can view but not edit. */
export default function AcPermissionNotice({ title, message, variant = "info" }) {
  const styles =
    variant === "info"
      ? "border-sky-200 bg-sky-50 text-sky-950"
      : "border-amber-200 bg-amber-50 text-amber-950";

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm mb-4 ${styles}`}>
      <p className="font-semibold">{title}</p>
      {message ? <p className="mt-1 leading-relaxed opacity-90">{message}</p> : null}
    </div>
  );
}
