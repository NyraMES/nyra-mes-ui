import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";

const STAGES = [
  { id: "customer-order", label: "Customer Order", path: "/workflow/customer-order" },
  { id: "production-order", label: "Production Order", path: "/workflow/production-order" },
  { id: "lot-split", label: "Lot Split", path: "/workflow/lot-split" },
  { id: "routing", label: "Routing Flow", path: "/workflow/routing" },
  { id: "feasibility", label: "Feasibility", path: "/workflow/feasibility" },
  { id: "scheduling", label: "Scheduling", path: "/workflow/scheduling" },
  { id: "execution", label: "Execution", path: "/workflow/execution" },
  { id: "inspection", label: "Inspection / NCR", path: "/workflow/inspection" },
  { id: "dispatch", label: "Dispatch", path: "/workflow/dispatch" },
  { id: "traceability", label: "Traceability", path: "/workflow/traceability" }
];

const WorkflowContext = createContext(null);

export function WorkflowProvider({ children }) {
  const [context, setContext] = useState({
    orderId: null,
    customerId: null,
    customerName: null,
    partId: null,
    orderLineId: null,
    productionOrderId: null,
    plannedQuantity: null,
    lotId: null,
    completedStages: new Set()
  });

  const update = useCallback((partial) => {
    setContext((prev) => ({ ...prev, ...partial }));
  }, []);

  const markStage = useCallback((stageId) => {
    setContext((prev) => {
      const next = new Set(prev.completedStages);
      next.add(stageId);
      return { ...prev, completedStages: next };
    });
  }, []);

  const reset = useCallback(() => {
    setContext({
      orderId: null,
      customerId: null,
      customerName: null,
      partId: null,
      orderLineId: null,
      productionOrderId: null,
      plannedQuantity: null,
      lotId: null,
      completedStages: new Set()
    });
  }, []);

  const value = useMemo(
    () => ({ context, update, markStage, reset, stages: STAGES }),
    [context, update, markStage, reset]
  );

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext);
  if (!ctx) {
    throw new Error("useWorkflow must be used inside WorkflowProvider");
  }
  return ctx;
}

export { STAGES };
