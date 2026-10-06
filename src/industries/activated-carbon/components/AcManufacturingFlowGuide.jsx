import { Link } from "react-router-dom";

const FLOW_STEPS = [
  {
    n: 1,
    title: "Raw Material",
    desc: "Inward receipt, QC, and release to production",
    to: "/activated-carbon/raw-material?tab=inward"
  },
  {
    n: 2,
    title: "Execution",
    desc: "Kiln feed first, then activation, screening, and quality",
    to: "/activated-carbon/execution"
  },
  {
    n: 3,
    title: "Customer PO",
    desc: "Check stock or tentative delivery from raw + lead time",
    to: "/activated-carbon/customer-sales"
  },
  {
    n: 4,
    title: "Dispatch",
    desc: "Ship from stock when available",
    to: "/activated-carbon/dispatch"
  }
];

function AcManufacturingFlowGuide({ highlightStep = null, className = "" }) {
  return (
    <div className={`wf-ac-flow-guide ${className}`}>
      <div className="wf-ac-flow-guide-title">
        How activated carbon manufacturing works
      </div>
      <p className="wf-ac-flow-guide-intro">
        <strong>Suppliers</strong> deliver raw material; that inward is not a customer order.
        After inbound prep you <strong>release to production</strong> on the Raw Material page,
        then open <strong>Execution</strong> — kiln feed is first, then activation, screening,
        and quality. The route is created automatically after Load. Finished goods move to{" "}
        <strong>stock</strong>. A{" "}
        <strong>customer PO</strong> checks stock first — dispatch immediately if enough is on
        hand, otherwise the system suggests a <strong>tentative delivery date</strong> from raw
        material on hand and routing duration.
      </p>
      <ol className="wf-ac-flow-guide-steps">
        {FLOW_STEPS.map((step) => (
          <li
            key={step.n}
            className={
              highlightStep === step.n ? "wf-ac-flow-guide-step--active" : undefined
            }
          >
            <Link to={step.to} className="wf-ac-flow-guide-step">
              <span className="wf-ac-flow-guide-num">{step.n}</span>
              <span>
                <span className="wf-ac-flow-guide-step-title">{step.title}</span>
                <span className="wf-ac-flow-guide-step-desc">{step.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default AcManufacturingFlowGuide;
