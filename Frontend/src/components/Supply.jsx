import { useCallback, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { confirmAction, showError, showSuccess } from "../lib/alerts.js";
import { useLoad } from "../lib/useLoad.js";
import { Button, EmptyState, Field, LoadingState, Modal, PageHeader, Panel, SelectField, StatusBadge } from "./UI.jsx";

const initialForm = { product: "", warehouse: "", quantity: "" };

export default function Supply({ token, user }) {
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const load = useCallback(async () => {
    const [requests, products, warehouses] = await Promise.all([
      apiRequest("/supply-requests", { token }),
      apiRequest("/products", { token }),
      apiRequest("/warehouses", { token }),
    ]);
    return { requests: requests.requests, products: products.products, warehouses: warehouses.warehouses };
  }, [token]);
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
  const summaries = [
    ["Total requests", requests.length],
    ["Pending", requests.filter((item) => item.status === "Pending").length],
    ["Approved", requests.filter((item) => item.status === "Approved").length],
    ["Rejected", requests.filter((item) => item.status === "Rejected").length],
  ];

  return <>
    <PageHeader eyebrow="SUPPLIER OPERATIONS" title={isSupplier ? "My supply requests" : "Supply requests"} description={isSupplier ? "Request replenishment and track your approvals." : "Review incoming requests and replenish warehouse stock."} action={isSupplier && <Button onClick={() => { setError(""); setDialog(true); }}>＋ New request</Button>} />
    {loadError && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-4 py-3 text-xs text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]">{loadError}</div>}
    <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">{summaries.map(([label, value]) => <div key={label} className="grid gap-1 rounded-xl border border-[#dedfd4] bg-[#fbfaf5] p-3 shadow-sm dark:border-[#303a30] dark:bg-[#1a211b] sm:p-4"><span className="text-[10px] text-[#858e81] dark:text-[#9ba998]">{label}</span><b className="text-2xl font-semibold tracking-tight text-[#34443a] dark:text-[#d0dacb]">{value}</b></div>)}</div>
    {loading ? <LoadingState /> : <Panel title="Request activity" subtitle="Supply requests and their latest status">
      {!requests.length ? <EmptyState title="No supply requests">{isSupplier ? "Submit a request when your products need replenishing." : "Supplier requests will appear here."}</EmptyState> : <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
        <thead className="bg-[#f0f0e8] text-[10px] uppercase tracking-wider text-[#667261] dark:bg-[#252e26] dark:text-[#aab8a4]"><tr>{["Product", "Supplier", "Warehouse", "Quantity", "Submitted", "Status", ...(!isSupplier ? ["Action"] : [])].map((item) => <th className="whitespace-nowrap border-b border-[#e1e2d7] px-4 py-3 font-bold dark:border-[#394339]" key={item}>{item}</th>)}</tr></thead>
        <tbody>{requests.map((request) => <tr className="border-b border-[#e9e9e0] text-xs text-[#68756a] last:border-0 hover:bg-[#f7f7f0] dark:border-[#303a30] dark:text-[#aab8a4] dark:hover:bg-[#222a22]" key={request._id}>
          <td className="px-4 py-3"><strong className="font-semibold text-[#3d4c41] dark:text-[#d6dfd1]">{request.product?.name || "Product"}</strong><small className="mt-1 block font-mono text-[10px] text-[#929b90] dark:text-[#899789]">{request.product?.sku || ""}</small></td>
          <td className="px-4 py-3">{request.supplier?.name || "Supplier"}</td><td className="px-4 py-3">{request.warehouse?.name || "—"}</td>
          <td className="px-4 py-3 font-bold tabular-nums text-[#34443a] dark:text-[#d0dacb]">{request.quantity}</td><td className="px-4 py-3">{new Date(request.createdAt || request.date).toLocaleDateString()}</td>
          <td className="px-4 py-3"><StatusBadge>{request.status}</StatusBadge></td>
          {!isSupplier && <td className="px-4 py-3">{request.status === "Pending" ? <div className="flex items-center gap-3"><button className="text-[10px] font-bold text-[#4b6337] hover:underline" onClick={() => updateStatus(request, "Approved")}>Approve</button><button className="text-[10px] font-bold text-[#b96050] hover:underline" onClick={() => updateStatus(request, "Rejected")}>Reject</button></div> : "—"}</td>}
        </tr>)}</tbody>
      </table></div>}
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
