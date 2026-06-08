import { useEffect, useState } from "react";

import { fetchMesCoreTriples } from "../../services/mesCoreApi";
import {
  WfCard,
  WfCardHeader,
  WfCardBody,
  SectionHeader,
  EmptyState,
} from "../ui";


function KgTriplesPage() {
  const [triples, setTriples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const rows = await fetchMesCoreTriples();
        setTriples(rows);
      } catch (e) {
        setError(e?.response?.data?.detail || e.message || "Failed to load triples");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Ontology & Knowledge Graph"
        title="Staged KG Triples"
        subtitle="Tenant-scoped RDF triples from nyra_mes_core (kg.triple_store_staging)"
      />

      <WfCard>
        <WfCardHeader
          title="Triple store staging"
          subtitle="Exported to SPARQL / graph services when ready"
        />
        <WfCardBody>
          {loading && <p className="text-slate-600 text-sm">Loading triples…</p>}
          {error && (
            <p className="text-red-600 text-sm" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && triples.length === 0 && (
            <EmptyState
              title="No staged triples"
              description="Seed data or routing exports will appear here."
            />
          )}
          {!loading && !error && triples.length > 0 && (
            <div className="overflow-x-auto wf-light-panel rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium text-slate-600">Subject</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Predicate</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Object</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {triples.map((t) => (
                    <tr key={t.triple_id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-slate-800">
                        {t.subject_uri}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">
                        {t.predicate_uri}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">
                        {t.object_uri || t.object_literal || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{t.export_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WfCardBody>
      </WfCard>
    </div>
  );
}

export default KgTriplesPage;
