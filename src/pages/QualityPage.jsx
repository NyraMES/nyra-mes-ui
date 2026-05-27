import Tabs from "../components/Tabs";

import InspectionResultPage from "./InspectionResultPage";
import InspectionParameterResultPage from "./InspectionParameterResultPage";
import NcrPage from "./NcrPage";

import "../styles/Form.css";


function QualityPage() {
  const tabs = [
    {
      label: "Inspection Results",
      content: <InspectionResultPage />
    },
    {
      label: "Parameter Results",
      content: <InspectionParameterResultPage />
    },
    {
      label: "NCRs",
      content: <NcrPage />
    }
  ];

  return <Tabs tabs={tabs} />;
}

export default QualityPage;
