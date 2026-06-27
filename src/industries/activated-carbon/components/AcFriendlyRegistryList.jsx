/** Card-style list — name first, reference code secondary (easier for non-technical users). */
export default function AcFriendlyRegistryList({
  items = [],
  nameKey = "name",
  codeKey = "code",
  idKey = "id",
  emptyLabel = "Nothing registered yet."
}) {
  if (!items?.length) {
    return <p className="text-sm text-slate-600 leading-relaxed">{emptyLabel}</p>;
  }

  return (
    <ul className="ac-friendly-registry">
      {items.map((item) => {
        const id = item[idKey] || item[codeKey];
        const name = item[nameKey] || "—";
        const code = item[codeKey];
        const status = item.status || "ACTIVE";
        const isActive = String(status).toUpperCase() === "ACTIVE";

        return (
          <li key={id} className="ac-friendly-registry-row">
            <div className="ac-friendly-registry-main">
              <p className="ac-friendly-registry-name">{name}</p>
              {code ? (
                <p className="ac-friendly-registry-code">Reference number: {code}</p>
              ) : null}
            </div>
            <span
              className={`ac-friendly-registry-badge ${
                isActive ? "ac-friendly-registry-badge--active" : ""
              }`}
            >
              {isActive ? "Active" : status}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
