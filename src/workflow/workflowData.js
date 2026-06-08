import {
  fetchMesCoreOrderLines,
  fetchMesCoreProductionOrderByRef,
} from "../services/mesCoreApi";

/** All order lines from nyra_mes_core customer orders. */
export async function fetchAllOrderLines() {
  return fetchMesCoreOrderLines();
}

export async function fetchProductionOrderById(productionOrderId) {
  return fetchMesCoreProductionOrderByRef(productionOrderId);
}
