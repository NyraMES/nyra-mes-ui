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
    title: "Work order",
    desc: "Grade, CTC, and quantity in Admin — kiln feed uses that work order",
    to: "/activated-carbon/admin?tab=work-orders"
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
        then create a <strong>work order</strong> in Admin (grade, CTC, KG). Execution kiln feed
        starts from that work order number; any kiln can be loaded. Completed bags move to{" "}
        <strong>In Stock</strong> for dispatch. Customer POs are not recorded.
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
