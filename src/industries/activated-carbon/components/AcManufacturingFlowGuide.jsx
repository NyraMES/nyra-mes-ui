import { Link } from "react-router-dom";

const FLOW_STEPS = [
  {
    n: 1,
    title: "Masters",
    desc: "Raw material types, suppliers, customers, fixed routing",
    to: "/activated-carbon/masters"
  },
  {
    n: 2,
    title: "Supplier inward",
    desc: "Record feedstock from supplier (not a customer PO)",
    to: "/activated-carbon/raw-material-inward"
  },
  {
    n: 3,
    title: "Raw material QC",
    desc: "Inspect inward receipt before production release",
    to: "/activated-carbon/raw-material-qc"
  },
  {
    n: 4,
    title: "Kiln feed",
    desc: "Release QC-passed material to production, then charge kiln",
    to: "/activated-carbon/kiln-feed"
  },
  {
    n: 5,
    title: "Feasibility & routing",
    desc: "Validate lot, generate work orders",
    to: "/activated-carbon/feasibility"
  },
  {
    n: 6,
    title: "Execution → stock",
    desc: "Complete routing — finished goods added to inventory",
    to: "/activated-carbon/execution"
  },
  {
    n: 7,
    title: "Customer PO",
    desc: "Check stock or tentative delivery from raw + lead time",
    to: "/activated-carbon/customer-sales"
  },
  {
    n: 8,
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
        After QC you <strong>release to production</strong> (make-to-stock). Kiln feed and
        execution build <strong>finished-goods stock</strong>. A <strong>customer PO</strong>{" "}
        checks stock first — dispatch immediately if enough is on hand, otherwise the system
        suggests a <strong>tentative delivery date</strong> from raw material on hand and routing
        duration.
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
