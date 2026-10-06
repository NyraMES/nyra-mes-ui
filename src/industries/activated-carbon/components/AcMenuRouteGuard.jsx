import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../../auth/AuthContext";
import { canAccessAcMenuItem } from "../utils/acMenuAccess";
import { getActivatedCarbonMenu } from "../menu/activatedCarbonMenu";

/** Map URL segment after /activated-carbon/ to sidebar menu id. */
const PATH_TO_MENU_ID = Object.fromEntries(
  getActivatedCarbonMenu([]).flatMap((item) => {
    const segment = String(item.to || "")
      .replace(/^\/activated-carbon\/?/, "")
      .replace(/^\//, "")
      .split("?")[0]
      .split("/")[0];
    return segment ? [[segment, item.id]] : [];
  })
);

function AcMenuRouteGuard({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const roles = user?.roles || [];

  const segment = pathname.replace(/^\/activated-carbon\/?/, "").split("/")[0] || "dashboard";
  const menuId = PATH_TO_MENU_ID[segment] || segment;

  if (!canAccessAcMenuItem(menuId, roles, user)) {
    return <Navigate to="/activated-carbon/dashboard" replace />;
  }

  return children;
}

export default AcMenuRouteGuard;
