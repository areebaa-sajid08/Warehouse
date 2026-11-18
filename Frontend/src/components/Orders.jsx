import { useCallback, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { Button, EmptyState, Field, LoadingState, Modal, Notice, PageHeader, Panel, SelectField, StatusBadge } from "./UI.jsx";
import { useLoad } from "../lib/useLoad.js";
import { formatCurrency } from "../lib/format.js";

export default function Orders({ token, user }) {
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ customerName: "", customerPhone: "", warehouse: "", product: "", quantity: "1" });
  const load = useCallback(async () => {
    const [orders, warehouses, products] = await Promise.all([
      apiRequest("/orders", { token }),
      apiRequest("/warehouses", { token }),
      apiRequest("/products", { token }),
    ]);
    return { orders: orders.orders, warehouses: warehouses.warehouses, products: products.products };
  }, [token]);
  const { data, loading, error: loadError, reload } = useLoad(load);
  const canCreate = user.role === "salesRepresentative";
  const canProcess = ["admin", "warehouseManager"].includes(user.role);
  const change = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));

  const createOrder = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest("/orders", {
        token, method: "POST",
        body: {
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          warehouse: form.warehouse,
          products: [{ product: form.product, quantity: Number(form.quantity) }],
        },
      });
      setDialog(false);
      setForm({ customerName: "", customerPhone: "", warehouse: "", product: "", quantity: "1" });
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const updateStatus = async (order, status) => {
    try {
      await apiRequest(`/orders/${order._id}/status`, { token, method: "PUT", body: { status } });
      await reload();
    } catch (err) { window.alert(err.message); }
  };

  const orders = data?.orders || [];
  return <>
    <PageHeader eyebrow="ORDER MANAGEMENT" title="Orders" description="Follow each order from request to fulfillment." action={canCreate && <Button onClick={() => { setError(""); setDialog(true); }}>＋ Create order</Button>} />
    <Notice message={loadError} />
    {loading ? <LoadingState /> : <>
      <div className="order-summary">
        <div><span>All orders</span><b>{orders.length}</b></div>
        <div><span>Pending</span><b>{orders.filter((item) => item.status === "Pending").length}</b></div>
        <div><span>Processing</span><b>{orders.filter((item) => item.status === "Processing").length}</b></div>
        <div><span>Completed</span><b>{orders.filter((item) => item.status === "Completed").length}</b></div>
      </div>
      <Panel className="table-panel" title="Order activity" subtitle="Latest order records">
        {!orders.length ? <EmptyState title="No orders yet">{canCreate ? "Create your first order to get started." : "Orders will appear here once they are placed."}</EmptyState> : <div className="table-wrap"><table>
          <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Warehouse</th><th>Total</th><th>Status</th>{canProcess && <th>Update</th>}</tr></thead>
          <tbody>{orders.map((order) => <tr key={order._id}>
            <td><strong className="mono">{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleDateString()}</small></td>
            <td><strong>{order.customerName}</strong><small>{order.customerPhone}</small></td>
            <td>{(order.products || []).map((line) => `${line.product?.name || "Product"} × ${line.quantity}`).join(", ")}</td>
            <td>{order.warehouse?.name || "—"}</td><td className="table-number">{formatCurrency(order.totalAmount)}</td><td><StatusBadge>{order.status}</StatusBadge></td>
            {canProcess && <td>{order.status === "Pending" ? <button className="row-action" onClick={() => updateStatus(order, "Processing")}>Process order →</button> : order.status === "Processing" ? <button className="row-action" onClick={() => updateStatus(order, "Completed")}>Complete order →</button> : "—"}</td>}
          </tr>)}</tbody>
        </table></div>}
      </Panel>
    </>}
    {dialog && <Modal title="Create a new order" onClose={() => setDialog(false)}>
      <Notice message={error} />
      <form className="form-stack" onSubmit={createOrder}>
        <div className="form-grid"><Field label="Customer name" value={form.customerName} onChange={change("customerName")} required /><Field label="Phone number" type="tel" value={form.customerPhone} onChange={change("customerPhone")} required /></div>
        <SelectField label="Warehouse" value={form.warehouse} onChange={change("warehouse")} options={(data?.warehouses || []).map((warehouse) => ({ value: warehouse._id, label: warehouse.name }))} required />
        <SelectField label="Product" value={form.product} onChange={change("product")} options={(data?.products || []).map((product) => ({ value: product._id, label: `${product.name} · ${formatCurrency(product.price)}` }))} required />
        <Field label="Quantity" type="number" min="1" step="1" value={form.quantity} onChange={change("quantity")} required />
        <div className="form-hint">The order total is calculated using the current product price. Stock is deducted when the order is processed.</div>
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setDialog(false)}>Cancel</Button><Button disabled={busy}>{busy ? "Creating…" : "Create order"}</Button></div>
      </form>
    </Modal>}
  </>;
}
