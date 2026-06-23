import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider } from "./auth/AuthContext.jsx";
import TenantContextSync from "./components/TenantContextSync.jsx";
import { AppProvider } from "./context/AppContext.jsx";
import "./index.css";
import "./styles/workflow.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <AppProvider>
        <TenantContextSync />
        <App />
      </AppProvider>
    </AuthProvider>
  </StrictMode>
);
