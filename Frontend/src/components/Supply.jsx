import { useCallback, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { Button, EmptyState, Field, LoadingState, Modal, Notice, PageHeader, Panel, SelectField, StatusBadge } from "./UI.jsx";
import { useLoad } from "../lib/useLoad.js";

export default function Supply({ token, user }) {
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ product: "", warehouse: "", quantity: "" });
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
      setForm({ product: "", warehouse: "", quantity: "" });
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const updateStatus = async (request, status) => {
    try {
      await apiRequest(`/supply-requests/${request._id}/status`, { token, method: "PUT", body: { status } });
      await reload();
    } catch (err) { window.alert(err.message); }
  };
  const requests = data?.requests || [];

  return <>
    <PageHeader eyebrow="SUPPLIER OPERATIONS" title={isSupplier ? "My supply requests" : "Supply requests"} description={isSupplier ? "Request replenishment and track your approvals." : "Review incoming requests and replenish warehouse stock."} action={isSupplier && <Button onClick={() => { setError(""); setDialog(true); }}>＋ New request</Button>} />
    <Notice message={loadError} />
    <div className="order-summary">
      <div><span>Total requests</span><b>{requests.length}</b></div>
      <div><span>Pending</span><b>{requests.filter((item) => item.status === "Pending").length}</b></div>
      <div><span>Approved</span><b>{requests.filter((item) => item.status === "Approved").length}</b></div>
      <div><span>Rejected</span><b>{requests.filter((item) => item.status === "Rejected").length}</b></div>
    </div>
    {loading ? <LoadingState /> : <Panel className="table-panel" title="Request activity" subtitle="Supply requests and their latest status">
      {!requests.length ? <EmptyState title="No supply requests">{isSupplier ? "Submit a request when your products need replenishing." : "Supplier requests will appear here."}</EmptyState> : <div className="table-wrap"><table>
        <thead><tr><th>Product</th><th>Supplier</th><th>Warehouse</th><th>Quantity</th><th>Submitted</th><th>Status</th>{!isSupplier && <th>Action</th>}</tr></thead>
        <tbody>{requests.map((request) => <tr key={request._id}>
          <td><strong>{request.product?.name || "Product"}</strong><small className="mono">{request.product?.sku || ""}</small></td>
          <td>{request.supplier?.name || "Supplier"}</td><td>{request.warehouse?.name || "—"}</td><td className="table-number">{request.quantity}</td>
          <td>{new Date(request.createdAt || request.date).toLocaleDateString()}</td><td><StatusBadge>{request.status}</StatusBadge></td>
          {!isSupplier && <td>{request.status === "Pending" ? <div className="button-row compact-buttons"><button className="row-action" onClick={() => updateStatus(request, "Approved")}>Approve</button><button className="row-action danger-text" onClick={() => updateStatus(request, "Rejected")}>Reject</button></div> : "—"}</td>}
        </tr>)}</tbody>
      </table></div>}
    </Panel>}
    {dialog && <Modal title="New supply request" onClose={() => setDialog(false)}>
      <Notice message={error} />
      <form className="form-stack" onSubmit={createRequest}>
        <SelectField label="Product" value={form.product} onChange={change("product")} options={(data?.products || []).map((product) => ({ value: product._id, label: `${product.name} · ${product.sku}` }))} required />
        <SelectField label="Deliver to warehouse" value={form.warehouse} onChange={change("warehouse")} options={(data?.warehouses || []).map((warehouse) => ({ value: warehouse._id, label: warehouse.name }))} required />
        <Field label="Quantity requested" type="number" min="1" step="1" value={form.quantity} onChange={change("quantity")} required />
        <div className="form-hint">Approved requests are added to the selected warehouse’s inventory.</div>
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setDialog(false)}>Cancel</Button><Button disabled={busy}>{busy ? "Submitting…" : "Submit request"}</Button></div>
      </form>
    </Modal>}
  </>;
}
