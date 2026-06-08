/**
 * Load pre-seeded NYRA_VIDEO_DEMO workflow context via GET only (read-only safe).
 */

import {
  fetchMesCoreCustomerOrders,
  fetchMesCoreCustomers,
  fetchMesCoreProductionLots,
  fetchMesCoreProductionOrders,
  fetchMesCoreProducts,
} from "../services/mesCoreApi";

export const DEMO_ORDER_CODE = "ORD-DEMO-1042";
export const DEMO_PO_CODE = "PO-DEMO-1042";
export const DEMO_LOT_BLOCKED = "LOT-DEMO-001";
export const DEMO_LOT_READY = "LOT-DEMO-002";

/**
 * @returns {Promise<{
 *   customerId: string,
 *   customerName: string,
 *   orderId: string,
 *   orderLineId: string,
 *   partId: string,
 *   plannedQuantity: number,
 *   productionOrderId: string,
 *   lotId: string,
 * }>}
 */
export async function loadDemoWalkthroughContext() {
  const [customers, orders, products, productionOrders, lots] = await Promise.all([
    fetchMesCoreCustomers(),
    fetchMesCoreCustomerOrders(),
    fetchMesCoreProducts(),
    fetchMesCoreProductionOrders(),
    fetchMesCoreProductionLots(),
  ]);

  const order = orders.find((o) => o.order_id === DEMO_ORDER_CODE || o.order_code === DEMO_ORDER_CODE);
  if (!order) {
    throw new Error(
      `Demo order ${DEMO_ORDER_CODE} not found. Run: python scripts/seed_video_demo.py --reset --force`
    );
  }

  const line = (order.lines || [])[0];
  if (!line) {
    throw new Error(`Demo order ${DEMO_ORDER_CODE} has no lines. Re-run the video demo seed script.`);
  }

  const customer = customers.find(
    (c) =>
      c.customer_id === order.customer_id ||
      c.customer_code === order.customer_id ||
      c.customer_code === "CUST-APEX-001"
  );
  const product = products.find(
    (p) => p.product_id === line.product_id || p.part_code === "BRK-PAD-450"
  );
  const po = productionOrders.find(
    (p) =>
      p.production_order_id === DEMO_PO_CODE ||
      p.production_order_code === DEMO_PO_CODE
  );
  const lot = lots.find((l) => l.lot_id === DEMO_LOT_BLOCKED) || lots[0];

  return {
    customerId: customer?.customer_id ?? order.customer_id,
    customerName: customer?.customer_name ?? "Apex Automotive",
    orderId: order.order_id,
    orderLineId: line.order_line_id,
    partId: product?.part_code ?? product?.part_id ?? line.part_code ?? "BRK-PAD-450",
    plannedQuantity: Number(line.quantity ?? po?.planned_quantity ?? 500),
    productionOrderId: po?.production_order_id ?? DEMO_PO_CODE,
    lotId: lot?.lot_id ?? DEMO_LOT_BLOCKED,
  };
}

/**
 * Build workflow context from an existing order row (includes lines from API).
 * @param {object} order
 * @param {object[]} customers
 * @param {object[]} products
 */
export function workflowContextFromOrder(order, customers = [], products = []) {
  const line = (order.lines || [])[0];
  if (!line) {
    throw new Error(`Order ${order.order_id} has no lines.`);
  }
  const customer = customers.find(
    (c) => c.customer_id === order.customer_id || c.customer_code === order.customer_id
  );
  const product = products.find((p) => p.product_id === line.product_id);
  return {
    customerId: customer?.customer_id ?? order.customer_id,
    customerName: customer?.customer_name ?? order.customer_id,
    orderId: order.order_id,
    orderLineId: line.order_line_id,
    partId: product?.part_code ?? line.part_code ?? line.product_id,
    plannedQuantity: Number(line.quantity ?? 0),
  };
}
