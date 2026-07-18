import { Navigate, Route, Routes } from "react-router-dom";

import ChemicalLayout from "../ChemicalLayout";
import ChemicalDashboard from "../pages/ChemicalDashboard";

/**
 * Route paths are relative to App's /chemical/* splat.
 */
export default function ChemicalRoutes() {
  return (
    <Routes>
      <Route element={<ChemicalLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ChemicalDashboard />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}
