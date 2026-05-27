function MesPageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-widest text-[#08264a]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export default MesPageHeader;
