import { useCallback, useState } from "react";
import { apiRequest, queryString } from "../lib/api.js";
import { confirmAction, showError, showSuccess } from "../lib/alerts.js";
import { useLoad } from "../lib/useLoad.js";
import { Button, EmptyState, Field, LoadingState, Modal, PageHeader, Pagination, Panel, SelectField, StatusBadge } from "./UI.jsx";

const initialForm = { product: "", warehouse: "", quantity: "" };
const PAGE_SIZE = 25;

export default function Supply({ token, user }) {
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const query = queryString({ page, limit: PAGE_SIZE, status: statusFilter === "all" ? "" : statusFilter });
  const load = useCallback(async () => {
    const [requests, products, warehouses] = await Promise.all([
      apiRequest(`/supply-requests${query}`, { token }),
      apiRequest("/products?limit=100", { token }),
      apiRequest("/warehouses?limit=100", { token }),
    ]);
    return {
      requests: requests.requests,
      pagination: requests.pagination,
      statusSummary: requests.statusSummary,
      products: products.products,
      warehouses: warehouses.warehouses,
    };
  }, [query, token]);
  const { data, loading, error: loadError, reload } = useLoad(load);
  const isSupplier = user.role === "supplier";
  const change = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const createRequest = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest("/supply-requests", { token, method: "POST", body: { ...form, quantity: Number(form.quantity) } });
      setDialog(false);
      setForm(initialForm);
      await reload();
      await showSuccess("Supply request submitted");
    } catch (err) {
      setError(err.message);
      await showError(err.message);
    } finally { setBusy(false); }
  };
  const updateStatus = async (request, status) => {
    if (status === "Approved") {
      const confirmation = await confirmAction({
        title: "Approve supply request?",
        text: "The requested quantity will be added to this warehouse's inventory.",
        confirmText: "Approve request",
        icon: "question",
      });
      if (!confirmation.isConfirmed) return;
    }
    try {
      await apiRequest(`/supply-requests/${request._id}/status`, { token, method: "PUT", body: { status } });
      await reload();
      await showSuccess(status === "Approved" ? "Request approved" : "Request rejected");
    } catch (err) { await showError(err.message); }
  };
  const requests = data?.requests || [];
  const pagination = data?.pagination || { page: 1, total: 0, pages: 1 };
  const pageCount = Math.max(1, pagination.pages || 1);
  const currentPage = Math.min(page, pageCount);
  const summaries = [
    ["Total requests", Object.values(data?.statusSummary || {}).reduce((sum, item) => sum + item.count, 0)],
    ["Pending", data?.statusSummary?.Pending?.count || 0],
    ["Approved", data?.statusSummary?.Approved?.count || 0],
    ["Rejected", data?.statusSummary?.Rejected?.count || 0],
  ];

  return <>
    <PageHeader eyebrow="SUPPLIER OPERATIONS" title={isSupplier ? "My supply requests" : "Supply requests"} description={isSupplier ? "Request replenishment and track your approvals." : "Review incoming requests and replenish warehouse stock."} action={isSupplier && <Button onClick={() => { setError(""); setDialog(true); }}>＋ New request</Button>} />
    {loadError && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-4 py-3 text-xs text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]">{loadError}</div>}
    <div className="mb-4 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 xl:grid-cols-4">{summaries.map(([label, value]) => <div key={label} className="grid gap-1 rounded-xl border border-[#dedfd4] bg-[#fbfaf5] p-3 shadow-sm dark:border-[#303a30] dark:bg-[#1a211b] sm:p-4"><span className="text-[10px] text-[#858e81] dark:text-[#9ba998]">{label}</span><b className="text-2xl font-semibold tracking-tight text-[#34443a] dark:text-[#d0dacb]">{value}</b></div>)}</div>
    {loading ? <LoadingState /> : <Panel title="Request activity" subtitle={`Showing ${requests.length} of ${pagination.total} supply requests`} action={<select className="h-9 rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-xs text-[#344132] outline-none dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc]" aria-label="Filter supply requests by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select>}>
      {!requests.length ? <EmptyState title={pagination.total ? "No requests on this page" : "No supply requests"}>{pagination.total ? "Choose another page." : isSupplier ? "Submit a request when your products need replenishing." : "Supplier requests will appear here."}</EmptyState> : <>
        <div className="hidden max-w-full overflow-x-auto overscroll-x-contain lg:block"><table className="w-full min-w-max border-collapse text-left">
        <thead className="bg-[#f0f0e8] text-[10px] uppercase tracking-wider text-[#667261] dark:bg-[#252e26] dark:text-[#aab8a4]"><tr>{["Product", "Supplier", "Warehouse", "Quantity", "Submitted", "Status", ...(!isSupplier ? ["Action"] : [])].map((item) => <th className="whitespace-nowrap border-b border-[#e1e2d7] px-4 py-3 font-bold dark:border-[#394339]" key={item}>{item}</th>)}</tr></thead>
        <tbody>{requests.map((request) => <tr className="border-b border-[#e9e9e0] text-xs text-[#68756a] last:border-0 hover:bg-[#f7f7f0] dark:border-[#303a30] dark:text-[#aab8a4] dark:hover:bg-[#222a22]" key={request._id}>
          <td className="px-4 py-3"><strong className="font-semibold text-[#3d4c41] dark:text-[#d6dfd1]">{request.product?.name || "Product"}</strong><small className="mt-1 block font-mono text-[10px] text-[#929b90] dark:text-[#899789]">{request.product?.sku || ""}</small></td>
          <td className="px-4 py-3">{request.supplier?.name || "Supplier"}</td><td className="px-4 py-3">{request.warehouse?.name || "—"}</td>
          <td className="px-4 py-3 font-bold tabular-nums text-[#34443a] dark:text-[#d0dacb]">{request.quantity}</td><td className="px-4 py-3">{new Date(request.createdAt || request.date).toLocaleDateString()}</td>
          <td className="px-4 py-3"><StatusBadge>{request.status}</StatusBadge></td>
          {!isSupplier && <td className="px-4 py-3">{request.status === "Pending" ? <div className="flex items-center gap-3"><button className="text-[10px] font-bold text-[#4b6337] hover:underline" onClick={() => updateStatus(request, "Approved")}>Approve</button><button className="text-[10px] font-bold text-[#b96050] hover:underline" onClick={() => updateStatus(request, "Rejected")}>Reject</button></div> : "—"}</td>}
        </tr>)}</tbody>
      </table></div>
      <div className="grid gap-3 p-3 lg:hidden">{requests.map((request) => <article className="min-w-0 rounded-lg border border-[#e3e3d9] bg-[#fffefa] p-3 dark:border-[#3c473b] dark:bg-[#202820]" key={request._id}>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block break-words text-sm font-semibold text-[#3d4c41] dark:text-[#d6dfd1]">{request.product?.name || "Product"}</strong><span className="mt-1 block font-mono text-[10px] text-[#929b90] dark:text-[#899789]">{request.product?.sku || "—"}</span></div><StatusBadge>{request.status}</StatusBadge></div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <CardDetail label="Supplier">{request.supplier?.name || "Supplier"}</CardDetail>
          <CardDetail label="Warehouse">{request.warehouse?.name || "—"}</CardDetail>
          <CardDetail label="Quantity">{request.quantity}</CardDetail>
          <CardDetail label="Submitted">{new Date(request.createdAt || request.date).toLocaleDateString()}</CardDetail>
        </div>
        {!isSupplier && request.status === "Pending" && <div className="mt-3 flex gap-4 border-t border-[#e9e9e0] pt-2 dark:border-[#394339]">
          <button className="min-h-9 text-xs font-bold text-[#4b6337] hover:underline dark:text-[#c4dd9d]" onClick={() => updateStatus(request, "Approved")}>Approve</button>
          <button className="min-h-9 text-xs font-bold text-[#b96050] hover:underline" onClick={() => updateStatus(request, "Rejected")}>Reject</button>
        </div>}
      </article>)}</div>
      <Pagination page={currentPage} pageSize={PAGE_SIZE} total={pagination.total} onChange={setPage} /></>}
    </Panel>}
    {dialog && <Modal title="New supply request" onClose={() => setDialog(false)}>
      {error && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-3 py-2.5 text-xs text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]">{error}</div>}
      <form className="grid gap-4" onSubmit={createRequest}>
        <SelectField label="Product" value={form.product} onChange={change("product")} options={(data?.products || []).map((product) => ({ value: product._id, label: `${product.name} · ${product.sku}` }))} required />
        <SelectField label="Deliver to warehouse" value={form.warehouse} onChange={change("warehouse")} options={(data?.warehouses || []).map((warehouse) => ({ value: warehouse._id, label: warehouse.name }))} required />
        <Field label="Quantity requested" type="number" min="1" step="1" value={form.quantity} onChange={change("quantity")} required />
        <p className="text-[11px] leading-relaxed text-[#858e82] dark:text-[#9ba998]">Approved requests are added to the selected warehouse’s inventory.</p>
        <div className="mt-1 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setDialog(false)}>Cancel</Button><Button disabled={busy}>{busy ? "Submitting…" : "Submit request"}</Button></div>
      </form>
    </Modal>}
  </>;
}

function CardDetail({ label, children }) {
  return <div className="min-w-0"><span className="block text-[10px] text-[#92998e] dark:text-[#899789]">{label}</span><strong className="mt-1 block break-words text-xs font-semibold text-[#475542] dark:text-[#c7d2c2]">{children}</strong></div>;
}
