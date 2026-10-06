import { acProcessTabKey, acProcessTabLabel } from "../utils/acExecutionOperations";

function extraTabStyle(selected) {
  return selected
    ? {
        background: "#fff",
        color: "#0f172a",
        border: "1px solid #e2e8f0",
        borderBottomColor: "#fff",
        marginBottom: -1
      }
    : { color: "#cbd5e1", background: "transparent" };
}

export default function AcProcessMapTabs({
  operations = [],
  activeId,
  onSelect,
  sidebar = false,
  title = "",
  showReports = false,
  showKilnParameters = false
}) {
  if (!operations.length && !showReports && !showKilnParameters) return null;

  if (sidebar) {
    return (
      <nav className="ac-exec-process-flow" aria-label="Process map">
        <ol>
          {operations.map((op) => {
            const id = acProcessTabKey(op);
            const selected = Boolean(id) && id === activeId;
            return (
              <li key={id || op.operation_name}>
                <button
                  type="button"
                  className={selected ? "is-active" : ""}
                  onClick={() => id && onSelect?.(id)}
                >
                  {acProcessTabLabel(op)}
                </button>
              </li>
            );
          })}
          {showKilnParameters ? (
            <li>
              <button
                type="button"
                className={activeId === "kiln-parameters" ? "is-active" : ""}
                onClick={() => onSelect?.("kiln-parameters")}
              >
                Kiln Parameters
              </button>
            </li>
          ) : null}
          {showReports ? (
            <li>
              <button
                type="button"
                className={activeId === "reports" ? "is-active" : ""}
                onClick={() => onSelect?.("reports")}
              >
                Reports
              </button>
            </li>
          ) : null}
        </ol>
      </nav>
    );
  }

  return (
    <div className="space-y-2">
      {title ? (
        <p className="ac-exec-process-flow-title" style={{ marginBottom: 0 }}>
          {title}
        </p>
      ) : null}
      <div
        className="flex flex-wrap gap-1 border-b"
        style={{ borderColor: "rgba(148, 163, 184, 0.35)" }}
      >
        {operations.map((op) => {
          const id = acProcessTabKey(op);
          const selected = Boolean(id) && id === activeId;
          return (
            <button
              key={id || op.operation_name}
              type="button"
              onClick={() => id && onSelect?.(id)}
              className="px-3 py-2 text-sm font-medium rounded-t-md"
              style={
                selected
                  ? {
                      background: "#fff",
                      color: "#0f172a",
                      border: "1px solid #e2e8f0",
                      borderBottomColor: "#fff",
                      marginBottom: -1
                    }
                  : { color: "#cbd5e1", background: "transparent" }
              }
            >
              {acProcessTabLabel(op)}
            </button>
          );
        })}
        {showKilnParameters ? (
          <button
            type="button"
            onClick={() => onSelect?.("kiln-parameters")}
            className="px-3 py-2 text-sm font-medium rounded-t-md"
            style={extraTabStyle(activeId === "kiln-parameters")}
          >
            Kiln Parameters
          </button>
        ) : null}
        {showReports ? (
          <button
            type="button"
            onClick={() => onSelect?.("reports")}
            className="px-3 py-2 text-sm font-medium rounded-t-md"
            style={extraTabStyle(activeId === "reports")}
          >
            Reports
          </button>
        ) : null}
      </div>
    </div>
  );
}
