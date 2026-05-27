import api from "../services/api";

/** All order lines — prefers ``GET /order-lines``, falls back to per-order fetches. */
export async function fetchAllOrderLines() {
  try {
    const res = await api.get("/order-lines");
    return res.data || [];
  } catch {
    const ordersRes = await api.get("/orders").catch(() => ({ data: [] }));
    const orders = ordersRes.data || [];
    const chunks = await Promise.all(
      orders.map(async (order) => {
        try {
          const lr = await api.get(`/order/${order.order_id}/lines`);
          return (lr.data || []).map((line) => ({
            ...line,
            order_status: order.status
          }));
        } catch {
          return [];
        }
      })
    );
    return chunks.flat();
  }
}

export async function fetchProductionOrderById(productionOrderId) {
  if (!productionOrderId) return null;
  try {
    const res = await api.get(`/production-order/${productionOrderId}`);
    return res.data || null;
  } catch {
    return null;
  }
}
