import { useCallback, useEffect, useState } from "react";

import { useAppContext } from "../../../context/AppContext";
import { fetchAcOntologyConfig, saveAcOntologyConfig } from "../../../services/activatedCarbonApi";
import {
  mergeAcOntologyConfig,
  saveAcOntologyConfigLocal
} from "../utils/acOntologyConfigStore";

export default function useAcOntologyConfig() {
  const { context } = useAppContext();
  const tenantCode = context?.tenant_code;
  const workspaceCode = context?.workspace_code;

  const [config, setConfig] = useState(() =>
    mergeAcOntologyConfig(null, tenantCode, workspaceCode)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const remote = await fetchAcOntologyConfig();
      const merged = mergeAcOntologyConfig(remote, tenantCode, workspaceCode);
      setConfig(merged);
      if (remote) {
        saveAcOntologyConfigLocal(merged, tenantCode, workspaceCode);
      }
    } catch (e) {
      setConfig(mergeAcOntologyConfig(null, tenantCode, workspaceCode));
      setError(e?.message || "Could not load ontology config");
    } finally {
      setLoading(false);
    }
  }, [tenantCode, workspaceCode]);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(
    async (nextConfig) => {
      setSaving(true);
      setError("");
      try {
        const payload = {
          version: nextConfig.version ?? 2,
          qcParameters: nextConfig.qcParameters,
          qualityParameters: nextConfig.qualityParameters,
          dashboardPanels: nextConfig.dashboardPanels
        };
        await saveAcOntologyConfig(payload).catch(() => null);
        saveAcOntologyConfigLocal(payload, tenantCode, workspaceCode);
        setConfig(mergeAcOntologyConfig(payload, tenantCode, workspaceCode));
        return true;
      } catch (e) {
        saveAcOntologyConfigLocal(
          {
            version: nextConfig.version ?? 2,
            qcParameters: nextConfig.qcParameters,
            qualityParameters: nextConfig.qualityParameters,
            dashboardPanels: nextConfig.dashboardPanels
          },
          tenantCode,
          workspaceCode
        );
        setConfig(
          mergeAcOntologyConfig(
            {
              qcParameters: nextConfig.qcParameters,
              qualityParameters: nextConfig.qualityParameters,
              dashboardPanels: nextConfig.dashboardPanels
            },
            tenantCode,
            workspaceCode
          )
        );
        setError(e?.message || "Saved locally — API endpoint may be unavailable");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [tenantCode, workspaceCode]
  );

  return { config, loading, saving, error, reload, save, setConfig };
}
