import { useCallback, useEffect, useState } from "react";

import { useAppContext } from "../../../context/AppContext";
import { fetchAcMasters, formatAcApiError, normalizeAcMastersRecord } from "../../../services/activatedCarbonApi";
import {
  mergeRawMaterialTypes,
  mergeRawProductsFromMaterialTypes
} from "../utils/rawMaterialTypeStore";
import { isAcContextReady } from "../utils/acContextUtils";
import useAcPageRefresh from "./useAcPageRefresh";

const EMPTY_MASTERS = normalizeAcMastersRecord({});

/**
 * Loads /api/activated-carbon/masters for dropdowns on data-entry pages.
 */
export function useAcMasters() {
  const { context, loading: contextLoading } = useAppContext();
  const { locationKey, focusTick } = useAcPageRefresh();
  const [masters, setMasters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (contextLoading) {
      return null;
    }
    if (!isAcContextReady(context, false)) {
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError("");
    try {
      const data = normalizeAcMastersRecord(await fetchAcMasters());
      setMasters(data);
      return data;
    } catch (e) {
      const types = mergeRawMaterialTypes([]);
      const raw_products = mergeRawProductsFromMaterialTypes([], types);
      if (raw_products.length) {
        setMasters(
          normalizeAcMastersRecord({
            ...EMPTY_MASTERS,
            raw_material_types: types,
            raw_products
          })
        );
        setError(
          formatAcApiError(e, "Masters API unavailable — showing saved raw material types only")
        );
      } else {
        setMasters(null);
        setError(formatAcApiError(e, "Could not load dropdown data — start the local API and seed masters"));
      }
    } finally {
      setLoading(false);
    }
  }, [contextLoading, context.loaded, context.tenant_code, context.workspace_code]);

  useEffect(() => {
    reload();
  }, [reload, locationKey, focusTick]);

  const contextReady = isAcContextReady(context, contextLoading);
  const initialLoad = loading && masters === null;

  return {
    masters: normalizeAcMastersRecord(masters || EMPTY_MASTERS),
    /** True only before first successful/failed masters fetch — keeps dropdown options visible during refresh. */
    loading: contextLoading || !contextReady || initialLoad,
    error,
    reload,
    ready: Boolean(masters) && !initialLoad && contextReady
  };
}

export default useAcMasters;
