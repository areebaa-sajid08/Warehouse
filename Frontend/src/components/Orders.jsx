import { useCallback, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { confirmAction, showError, showSuccess } from "../lib/alerts.js";
import { useLoad } from "../lib/useLoad.js";
import { formatCurrency } from "../lib/format.js";
import { Button, EmptyState, Field, LoadingState, Modal, PageHeader, Panel, SelectField, StatusBadge } from "./UI.jsx";

const initialForm = { customerName: "", customerPhone: "", warehouse: "", product: "", quantity: "1" };

export default function Orders({ token, user }) {
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
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
      await apiRequest("/orders", { token, method: "POST", body: {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        warehouse: form.warehouse,
        products: [{ product: form.product, quantity: Number(form.quantity) }],
      } });
      setDialog(false);
      setForm(initialForm);
      await reload();
      await showSuccess("Order created");
    } catch (err) {
      setError(err.message);
      await showError(err.message);
    } finally { setBusy(false); }
  };

  const updateStatus = async (order, status) => {
    if (status === "Processing") {
      const confirmation = await confirmAction({
        title: "Process this order?",
        text: "The order quantity will be deducted from the warehouse inventory.",
        confirmText: "Process order",
        icon: "question",
      });
      if (!confirmation.isConfirmed) return;
    }
    try {
      await apiRequest(`/orders/${order._id}/status`, { token, method: "PUT", body: { status } });
      await reload();
      await showSuccess(status === "Processing" ? "Order is processing" : "Order completed");
    } catch (err) { await showError(err.message); }
  };

  const orders = data?.orders || [];
  return <>
    <PageHeader eyebrow="ORDER MANAGEMENT" title="Orders" description="Follow each order from request to fulfillment." action={canCreate && <Button onClick={() => { setError(""); setDialog(true); }}>＋ Create order</Button>} />
    {loadError && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-4 py-3 text-xs text-[#9d5144]">{loadError}</div>}
    {loading ? <LoadingState /> : <>
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard label="All orders" value={orders.length} />
        <SummaryCard label="Pending" value={orders.filter((item) => item.status === "Pending").length} />
        <SummaryCard label="Processing" value={orders.filter((item) => item.status === "Processing").length} />
        <SummaryCard label="Completed" value={orders.filter((item) => item.status === "Completed").length} />
      </div>
      <Panel title="Order activity" subtitle="Latest order records">
        {!orders.length ? <EmptyState title="No orders yet">{canCreate ? "Create your first order to get started." : "Orders will appear here once they are placed."}</EmptyState> : <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
          <thead className="bg-[#f0f0e8] text-[10px] uppercase tracking-wider text-[#667261]"><tr>{["Order", "Customer", "Items", "Warehouse", "Total", "Status", ...(canProcess ? ["Update"] : [])].map((item) => <th className="whitespace-nowrap border-b border-[#e1e2d7] px-4 py-3 font-bold" key={item}>{item}</th>)}</tr></thead>
          <tbody>{orders.map((order) => <tr className="border-b border-[#e9e9e0] text-xs text-[#68756a] last:border-0 hover:bg-[#f7f7f0]" key={order._id}>
            <td className="px-4 py-3"><strong className="font-mono font-semibold text-[#3d4c41]">{order.orderNumber}</strong><small className="mt-1 block text-[10px] text-[#929b90]">{new Date(order.createdAt).toLocaleDateString()}</small></td>
            <td className="px-4 py-3"><strong className="font-semibold text-[#3d4c41]">{order.customerName}</strong><small className="mt-1 block text-[10px] text-[#929b90]">{order.customerPhone}</small></td>
            <td className="px-4 py-3">{(order.products || []).map((line) => `${line.product?.name || "Product"} × ${line.quantity}`).join(", ")}</td>
            <td className="px-4 py-3">{order.warehouse?.name || "—"}</td>
            <td className="px-4 py-3 font-bold tabular-nums text-[#34443a]">{formatCurrency(order.totalAmount)}</td>
            <td className="px-4 py-3"><StatusBadge>{order.status}</StatusBadge></td>
            {canProcess && <td className="px-4 py-3">{order.status === "Pending" ? <button className="whitespace-nowrap text-[10px] font-bold text-[#4b6337] hover:underline" onClick={() => updateStatus(order, "Processing")}>Process order →</button> : order.status === "Processing" ? <button className="whitespace-nowrap text-[10px] font-bold text-[#4b6337] hover:underline" onClick={() => updateStatus(order, "Completed")}>Complete order →</button> : "—"}</td>}
          </tr>)}</tbody>
        </table></div>}
      </Panel>
    </>}
    {dialog && <Modal title="Create a new order" onClose={() => setDialog(false)}>
      {error && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-3 py-2.5 text-xs text-[#9d5144]">{error}</div>}
      <form className="grid gap-4" onSubmit={createOrder}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Customer name" value={form.customerName} onChange={change("customerName")} required /><Field label="Phone number" type="tel" value={form.customerPhone} onChange={change("customerPhone")} required /></div>
        <SelectField label="Warehouse" value={form.warehouse} onChange={change("warehouse")} options={(data?.warehouses || []).map((warehouse) => ({ value: warehouse._id, label: warehouse.name }))} required />
        <SelectField label="Product" value={form.product} onChange={change("product")} options={(data?.products || []).map((product) => ({ value: product._id, label: `${product.name} · ${formatCurrency(product.price)}` }))} required />
        <Field label="Quantity" type="number" min="1" step="1" value={form.quantity} onChange={change("quantity")} required />
        <p className="text-[11px] leading-relaxed text-[#858e82]">The order total is calculated using the current product price. Stock is deducted when the order is processed.</p>
        <div className="mt-1 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setDialog(false)}>Cancel</Button><Button disabled={busy}>{busy ? "Creating…" : "Create order"}</Button></div>
      </form>
    </Modal>}
  </>;
}

function SummaryCard({ label, value }) {
  return <div className="grid gap-1 rounded-xl border border-[#dedfd4] bg-[#fbfaf5] p-3 shadow-sm sm:p-4"><span className="text-[10px] text-[#858e81]">{label}</span><b className="text-2xl font-semibold tracking-tight text-[#34443a]">{value}</b></div>;
}
