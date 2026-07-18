/**
 * Chemical Processing industry API — maps to /api/chemical/*
 */

import api, { formatApiError } from "./api";

export function formatChemApiError(error, fallback = "Request failed") {
  return formatApiError(error, fallback);
}

export async function fetchChemDashboard() {
  const res = await api.get("/api/chemical/dashboard");
  return res.data;
}

export async function fetchChemReactorParameterDefinitions() {
  const res = await api.get("/api/chemical/reactor-parameter-definitions");
  return res.data;
}
