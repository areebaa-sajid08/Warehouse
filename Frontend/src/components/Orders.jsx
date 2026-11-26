import { useCallback, useState } from "react";
import { apiRequest, queryString } from "../lib/api.js";
import { confirmAction, showError, showSuccess } from "../lib/alerts.js";
import { useLoad } from "../lib/useLoad.js";
import { formatCurrency } from "../lib/format.js";
import { Button, EmptyState, Field, LoadingState, Modal, PageHeader, Pagination, Panel, SelectField, StatusBadge } from "./UI.jsx";

const PAGE_SIZE = 25;
const emptyList = [];
const newOrderForm = () => ({ customerName: "", customerPhone: "", warehouse: "", products: [{ product: "", quantity: "1" }] });

export default function Orders({ token, user }) {
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(newOrderForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const query = queryString({ page, limit: PAGE_SIZE, search, status: statusFilter === "all" ? "" : statusFilter });
  const load = useCallback(async () => {
    const [orders, warehouses, products] = await Promise.all([
      apiRequest(`/orders${query}`, { token }),
      apiRequest("/warehouses?limit=100", { token }),
      apiRequest("/products?limit=100", { token }),
    ]);
    return {
      orders: orders.orders,
      pagination: orders.pagination,
      statusSummary: orders.statusSummary,
      warehouses: warehouses.warehouses,
      products: products.products,
    };
  }, [query, token]);
  const { data, loading, error: loadError, reload } = useLoad(load);
  const canCreate = user.role === "salesRepresentative";
  const canProcess = ["admin", "warehouseManager"].includes(user.role);
  const canCancel = ["admin", "warehouseManager", "salesRepresentative"].includes(user.role);
  const change = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const changeLine = (index, key, value) => setForm((current) => ({
    ...current,
    products: current.products.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line),
  }));
  const addLine = () => setForm((current) => ({ ...current, products: [...current.products, { product: "", quantity: "1" }] }));
  const removeLine = (index) => setForm((current) => ({ ...current, products: current.products.filter((_, lineIndex) => lineIndex !== index) }));

  const createOrder = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest("/orders", { token, method: "POST", body: {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        warehouse: form.warehouse,
        products: form.products.map((line) => ({ product: line.product, quantity: Number(line.quantity) })),
      } });
      setDialog(false);
      setForm(newOrderForm());
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
        text: "The order quantities will be deducted from warehouse inventory.",
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

  const cancelOrder = async (order) => {
    const confirmation = await confirmAction({
      title: `Cancel order ${order.orderNumber}?`,
      text: order.status === "Processing" ? "The deducted stock will be returned to inventory." : "This pending order will be cancelled.",
      confirmText: "Cancel order",
      icon: "warning",
    });
    if (!confirmation.isConfirmed) return;
    try {
      await apiRequest(`/orders/${order._id}/cancel`, { token, method: "PUT" });
      await reload();
      await showSuccess("Order cancelled");
    } catch (err) { await showError(err.message); }
  };

  const orders = data?.orders || emptyList;
  const warehouses = data?.warehouses || emptyList;
  const products = data?.products || emptyList;
  const pagination = data?.pagination || { page: 1, total: 0, pages: 1 };
  const pageCount = Math.max(1, pagination.pages || 1);
  const currentPage = Math.min(page, pageCount);
  const pageOrders = orders;
  const estimatedTotal = form.products.reduce((total, line) => {
    const product = products.find((item) => item._id === line.product);
    return total + (product ? product.price * Number(line.quantity || 0) : 0);
  }, 0);

  return <>
    <PageHeader eyebrow="ORDER MANAGEMENT" title="Orders" description="Follow each order from request to fulfillment." action={canCreate && <Button onClick={() => { setError(""); setForm(newOrderForm()); setDialog(true); }}>＋ Create order</Button>} />
    {loadError && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-4 py-3 text-xs text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]">{loadError}</div>}
    {loading ? <LoadingState /> : <>
      <div className="mb-4 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="All orders" value={Object.values(data?.statusSummary || {}).reduce((sum, item) => sum + item.count, 0)} />
        <SummaryCard label="Pending" value={data?.statusSummary?.Pending?.count || 0} />
        <SummaryCard label="Processing" value={data?.statusSummary?.Processing?.count || 0} />
        <SummaryCard label="Completed" value={data?.statusSummary?.Completed?.count || 0} />
      </div>
      <Panel title="Order activity" subtitle={`Showing ${orders.length} of ${pagination.total} orders`} action={<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <select className="h-9 rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-xs text-[#344132] outline-none dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc]" aria-label="Filter orders by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
          <option value="all">All statuses</option><option value="Pending">Pending</option><option value="Processing">Processing</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option>
        </select>
        <input className="h-9 w-full rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-xs text-[#344132] outline-none placeholder:text-[#939b8e] dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc] dark:placeholder:text-[#788677] sm:w-56" type="search" aria-label="Search orders" placeholder="Search order or customer" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      </div>}>
        {!orders.length ? <EmptyState title={pagination.total ? "No orders on this page" : "No orders found"}>{pagination.total ? "Choose another page." : canCreate ? "Create your first order to get started." : "Orders will appear here once they are placed."}</EmptyState> : <>
          <div className="max-w-full overflow-x-auto overscroll-x-contain"><table className="w-full min-w-max border-collapse text-left">
            <thead className="bg-[#f0f0e8] text-[10px] uppercase tracking-wider text-[#667261] dark:bg-[#252e26] dark:text-[#aab8a4]"><tr>{["Order", "Customer", "Items", "Warehouse", "Total", "Status", ...(canProcess || canCancel ? ["Actions"] : [])].map((item) => <th className="whitespace-nowrap border-b border-[#e1e2d7] px-4 py-3 font-bold dark:border-[#394339]" key={item}>{item}</th>)}</tr></thead>
            <tbody>{pageOrders.map((order) => <tr className="border-b border-[#e9e9e0] text-xs text-[#68756a] last:border-0 hover:bg-[#f7f7f0] dark:border-[#303a30] dark:text-[#aab8a4] dark:hover:bg-[#222a22]" key={order._id}>
              <td className="px-4 py-3"><strong className="font-mono font-semibold text-[#3d4c41] dark:text-[#d6dfd1]">{order.orderNumber}</strong><small className="mt-1 block text-[10px] text-[#929b90] dark:text-[#899789]">{new Date(order.createdAt).toLocaleDateString()}</small></td>
              <td className="px-4 py-3"><strong className="font-semibold text-[#3d4c41] dark:text-[#d6dfd1]">{order.customerName}</strong><small className="mt-1 block text-[10px] text-[#929b90] dark:text-[#899789]">{order.customerPhone}</small></td>
              <td className="px-4 py-3">{(order.products || []).map((line) => `${line.product?.name || "Product"} × ${line.quantity}`).join(", ")}</td>
              <td className="px-4 py-3">{order.warehouse?.name || "—"}</td>
              <td className="px-4 py-3 font-bold tabular-nums text-[#34443a] dark:text-[#d0dacb]">{formatCurrency(order.totalAmount)}</td>
              <td className="px-4 py-3"><StatusBadge>{order.status}</StatusBadge></td>
              {(canProcess || canCancel) && <td className="px-4 py-3"><div className="flex flex-col items-start gap-1">
                {canProcess && order.status === "Pending" && <button className="whitespace-nowrap text-[10px] font-bold text-[#4b6337] hover:underline dark:text-[#c4dd9d]" onClick={() => updateStatus(order, "Processing")}>Process order →</button>}
                {canProcess && order.status === "Processing" && <button className="whitespace-nowrap text-[10px] font-bold text-[#4b6337] hover:underline dark:text-[#c4dd9d]" onClick={() => updateStatus(order, "Completed")}>Complete order →</button>}
                {canCancel && ["Pending", "Processing"].includes(order.status) && <button className="whitespace-nowrap text-[10px] font-bold text-[#b96050] hover:underline" onClick={() => cancelOrder(order)}>Cancel order</button>}
                {!["Pending", "Processing"].includes(order.status) && "—"}
              </div></td>}
            </tr>)}</tbody>
          </table></div>
          <Pagination page={currentPage} pageSize={PAGE_SIZE} total={pagination.total} onChange={setPage} />
        </>}
      </Panel>
    </>}
    {dialog && <Modal title="Create a new order" onClose={() => setDialog(false)}>
      {error && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-3 py-2.5 text-xs text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]">{error}</div>}
      <form className="grid gap-4" onSubmit={createOrder}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Customer name" value={form.customerName} onChange={change("customerName")} required /><Field label="Phone number" type="tel" value={form.customerPhone} onChange={change("customerPhone")} required /></div>
        <SelectField label="Warehouse" value={form.warehouse} onChange={change("warehouse")} options={warehouses.map((warehouse) => ({ value: warehouse._id, label: warehouse.name }))} required />
        <div className="grid gap-3">
          {form.products.map((line, index) => {
            const options = products.filter((product) => !form.products.some((selectedLine, selectedIndex) => selectedIndex !== index && selectedLine.product === product._id));
            return <div className="grid items-end gap-3 rounded-lg border border-[#e3e3d9] bg-[#faf9f3] p-3 dark:border-[#3c473b] dark:bg-[#202820] sm:grid-cols-[minmax(0,1fr)_8rem_auto]" key={`order-line-${index}`}>
              <SelectField label={`Product ${index + 1}`} value={line.product} onChange={(event) => changeLine(index, "product", event.target.value)} options={options.map((product) => ({ value: product._id, label: `${product.name} · ${formatCurrency(product.price)}` }))} required />
              <Field label="Quantity" type="number" min="1" step="1" value={line.quantity} onChange={(event) => changeLine(index, "quantity", event.target.value)} required />
              {form.products.length > 1 && <button className="h-10 rounded-md px-2 text-[10px] font-bold text-[#b96050] hover:bg-[#f5e8e3] dark:hover:bg-[#3a2a27]" type="button" onClick={() => removeLine(index)}>Remove</button>}
            </div>;
          })}
        </div>
        <div className="flex items-center justify-between gap-3"><button className="text-[11px] font-bold text-[#4b6337] hover:underline dark:text-[#c4dd9d]" type="button" onClick={addLine}>＋ Add another product</button><span className="text-xs text-[#667261] dark:text-[#aab8a4]">Estimated total: <strong className="text-[#34443a] dark:text-[#d0dacb]">{formatCurrency(estimatedTotal)}</strong></span></div>
        <p className="text-[11px] leading-relaxed text-[#858e82] dark:text-[#9ba998]">Stock is checked when the order is submitted and deducted when it is processed.</p>
        <div className="mt-1 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setDialog(false)}>Cancel</Button><Button disabled={busy}>{busy ? "Creating…" : "Create order"}</Button></div>
      </form>
    </Modal>}
  </>;
}

function SummaryCard({ label, value }) {
  return <div className="grid gap-1 rounded-xl border border-[#dedfd4] bg-[#fbfaf5] p-3 shadow-sm dark:border-[#303a30] dark:bg-[#1a211b] sm:p-4"><span className="text-[10px] text-[#858e81] dark:text-[#9ba998]">{label}</span><b className="text-2xl font-semibold tracking-tight text-[#34443a] dark:text-[#d0dacb]">{value}</b></div>;
}
