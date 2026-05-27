function MesCard({ title, subtitle, children, className = "" }) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {(title || subtitle) && (
        <div className="border-b border-slate-100 px-5 py-4">
          {title && (
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          )}
          {subtitle && (
            <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export default MesCard;
