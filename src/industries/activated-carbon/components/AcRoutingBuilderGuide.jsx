import { Link } from "react-router-dom";

const STEPS = [
  {
    n: 1,
    title: "Copy template (once per workspace)",
    desc: "Industry default route (seq 10–110) is read-only. Click “Copy Activated Carbon Template Route” to create your editable workspace copy."
  },
  {
    n: 2,
    title: "Customize process steps",
    desc: "Use Add Operation or Insert after on a row (e.g. insert “Post Screening Inspection” at seq 75 after Screening)."
  },
  {
    n: 3,
    title: "Parameters & execution resources",
    desc: "Each step has default capture fields (iodine, mesh size, kiln temps, etc.). Add or edit parameters on a row, and set Requires machine / crew when adding a custom operation."
  },
  {
    n: 4,
    title: "Use the route in production",
    desc: "This workspace route drives lot routing, feasibility, and execution. Configure raw material types under Masters to link feedstock to this process."
  }
];

function AcRoutingBuilderGuide() {
  return (
    <div className="wf-ac-flow-guide ac-rb-guide">
      <div className="wf-ac-flow-guide-title">How Routing Builder works</div>
      <p className="wf-ac-flow-guide-intro">
        Routing Builder defines the <strong>manufacturing process</strong> for your Activated
        Carbon workspace — the ordered list of steps from raw material inward through dispatch.
        It is <strong>not</strong> where you create customers or run lots; those happen on other
        screens after the route is set up.
      </p>
      <ol className="wf-ac-flow-guide-steps">
        {STEPS.map((step) => (
          <li key={step.n}>
            <div className="wf-ac-flow-guide-step">
              <span className="wf-ac-flow-guide-num">{step.n}</span>
              <span>
                <span className="wf-ac-flow-guide-step-title">{step.title}</span>
                <span className="wf-ac-flow-guide-step-desc">{step.desc}</span>
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p className="ac-rb-guide-links text-sm text-slate-600 mt-3">
        <strong>Related setup:</strong>{" "}
        <Link to="/activated-carbon/masters" className="text-blue-700 underline">
          Masters
        </Link>{" "}
        — add customers, raw material types, and kiln parameter catalog.{" "}
        <Link to="/activated-carbon/raw-material-inward" className="text-blue-700 underline">
          Raw Material Inward
        </Link>{" "}
        — create customer orders using those masters.
      </p>
    </div>
  );
}

export default AcRoutingBuilderGuide;
