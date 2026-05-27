import Tabs from "../components/Tabs";

import DispatchMasterPage from "./DispatchMasterPage";
import DispatchLinePage from "./DispatchLinePage";
import TraceabilityClosurePage from "./TraceabilityClosurePage";

import "../styles/Form.css";


function DispatchPage() {
  const tabs = [
    {
      label: "Dispatches",
      content: <DispatchMasterPage />
    },
    {
      label: "Dispatch Lines",
      content: <DispatchLinePage />
    },
    {
      label: "Traceability Closures",
      content: <TraceabilityClosurePage />
    }
  ];

  return <Tabs tabs={tabs} />;
}

export default DispatchPage;
