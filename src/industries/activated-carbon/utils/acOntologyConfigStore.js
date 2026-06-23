import { getDefaultAcOntologyConfig } from "../constants/defaultAcOntologyConfig";

const STORAGE_PREFIX = "nyra_ac_ontology_config_v1";

function storageKey(tenantCode, workspaceCode) {
  return `${STORAGE_PREFIX}:${tenantCode || "default"}:${workspaceCode || "default"}`;
}

function readLocal(tenantCode, workspaceCode) {
  try {
    const raw = localStorage.getItem(storageKey(tenantCode, workspaceCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(tenantCode, workspaceCode, config) {
  localStorage.setItem(storageKey(tenantCode, workspaceCode), JSON.stringify(config));
}

function asConfigArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeParameterList(saved = [], defaults = []) {
  const savedRows = asConfigArray(saved);
  const defaultRows = asConfigArray(defaults);
  const defaultByKey = new Map(defaultRows.map((row) => [row.key, row]));
  const merged = [];

  for (const row of savedRows) {
    const base = defaultByKey.get(row.key);
    if (base) {
      merged.push({ ...base, ...row });
      defaultByKey.delete(row.key);
    } else if (row.key) {
      merged.push(row);
    }
  }

  for (const row of defaultByKey.values()) {
    merged.push({ ...row });
  }

  return merged.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

const mergeQcParameters = mergeParameterList;

function mergeDashboardPanels(saved = [], defaults = []) {
  const savedRows = asConfigArray(saved);
  const defaultRows = asConfigArray(defaults);
  const defaultById = new Map(defaultRows.map((row) => [row.id, row]));
  const merged = [];

  for (const row of savedRows) {
    const base = defaultById.get(row.id);
    if (base) {
      merged.push({ ...base, ...row });
      defaultById.delete(row.id);
    }
  }

  for (const row of defaultById.values()) {
    merged.push({ ...row });
  }

  return merged.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

export function mergeAcOntologyConfig(partial, tenantCode, workspaceCode) {
  const defaults = getDefaultAcOntologyConfig();
  const local = readLocal(tenantCode, workspaceCode);

  const source = partial || local || {};
  return {
    version: source.version ?? defaults.version,
    qcParameters: mergeQcParameters(source.qcParameters, defaults.qcParameters),
    qualityParameters: mergeParameterList(source.qualityParameters, defaults.qualityParameters),
    dashboardPanels: mergeDashboardPanels(source.dashboardPanels, defaults.dashboardPanels),
    source: partial ? "api" : local ? "local" : "default"
  };
}

export function saveAcOntologyConfigLocal(config, tenantCode, workspaceCode) {
  writeLocal(tenantCode, workspaceCode, {
    version: config.version ?? 2,
    qcParameters: config.qcParameters,
    qualityParameters: config.qualityParameters,
    dashboardPanels: config.dashboardPanels,
    updatedAt: new Date().toISOString()
  });
}

export function getEnabledQcParameters(config) {
  return (config?.qcParameters || [])
    .filter((row) => row.enabled !== false)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

export function getEnabledQualityParameters(config) {
  return (config?.qualityParameters || [])
    .filter((row) => row.enabled !== false)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

export function getEnabledDashboardPanels(config) {
  return (config?.dashboardPanels || [])
    .filter((row) => row.enabled !== false)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

export function isDashboardPanelEnabled(config, panelId) {
  const panel = (config?.dashboardPanels || []).find((row) => row.id === panelId);
  return panel ? panel.enabled !== false : true;
}

const PCT_FALLBACK_BY_KG_KEY = {
  stones_kg: "foreign_matter_pct",
  unburnt_kg: "ash_pct",
  minus20_kg: "moisture_pct"
};

export function getImpurityChartConfig(config) {
  return getEnabledQcParameters(config)
    .filter((row) => row.chartSeries && row.key?.endsWith("_kg"))
    .map((row) => ({
      key: row.key,
      series: row.chartSeries,
      color: row.chartColor || "#64748b",
      pctFallbackKey: row.pctFallbackKey || PCT_FALLBACK_BY_KG_KEY[row.key] || null
    }));
}
