import { useCallback, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { Button, EmptyState, Field, LoadingState, Notice, PageHeader, Panel, SelectField } from "./UI.jsx";
import { useLoad } from "../lib/useLoad.js";

export default function Inventory({ token }) {
  const [dialog, setDialog] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ product: "", warehouse: "", quantity: "", note: "" });
  const load = useCallback(async () => {
    const [stock, warehouses, products] = await Promise.all([
      apiRequest("/stock", { token }),
      apiRequest("/warehouses", { token }),
      apiRequest("/products", { token }),
    ]);
    return { stock: stock.stock, warehouses: warehouses.warehouses, products: products.products };
  }, [token]);
  const { data, loading, error: loadError, reload } = useLoad(load);
  const change = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/stock/${dialog}`, { token, method: "POST", body: { ...form, quantity: Number(form.quantity) } });
      setDialog("");
      setForm({ product: "", warehouse: "", quantity: "", note: "" });
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const stocks = data?.stock || [];

  return <>
    <PageHeader eyebrow="STOCK CONTROL" title="Inventory" description="Track stock levels across your assigned warehouses." action={<div className="button-row"><Button variant="secondary" onClick={() => setDialog("out")}>− Stock out</Button><Button onClick={() => setDialog("in")}>＋ Stock in</Button></div>} />
    <Notice message={loadError} />
    {loading ? <LoadingState /> : <>
      <div className="inventory-summary">
        <div><span>Tracked items</span><b>{stocks.length}</b><small>Product / warehouse combinations</small></div>
        <div><span>Total units</span><b>{stocks.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}</b><small>Across visible locations</small></div>
        <div><span>Low stock</span><b className="text-amber">{stocks.filter((item) => item.product && item.quantity <= item.product.lowStockLimit).length}</b><small>At or below reorder point</small></div>
      </div>
      <Panel title="Stock on hand" subtitle={`${stocks.length} product and warehouse combinations`} className="table-panel">
        {stocks.length ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Warehouse</th><th>On hand</th><th>Reorder point</th><th>Status</th></tr></thead><tbody>
          {stocks.map((item) => {
            const low = item.product && item.quantity <= item.product.lowStockLimit;
            return <tr key={item._id}><td><strong>{item.product?.name || "Deleted product"}</strong><small>{item.product?.category || "—"}</small></td><td className="mono">{item.product?.sku || "—"}</td><td>{item.warehouse?.name || "Deleted warehouse"}</td><td className="table-number">{item.quantity}</td><td>{item.product?.lowStockLimit ?? "—"}</td><td><span className={`stock-state ${low ? "stock-low" : "stock-good"}`}><i />{low ? "Reorder" : "In stock"}</span></td></tr>;
          })}
        </tbody></table></div> : <EmptyState title="No stock recorded">Record a stock-in transaction to start tracking inventory.</EmptyState>}
      </Panel>
    </>}
    {dialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(""); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label="Record stock">
      <div className="modal-heading"><div><div className="eyebrow">INVENTORY TRANSACTION</div><h2>{dialog === "in" ? "Receive stock" : "Record stock out"}</h2></div><button className="icon-button" onClick={() => setDialog("")}>×</button></div>
      <Notice message={error} />
      <form className="form-stack" onSubmit={submit}>
        <SelectField label="Product" value={form.product} onChange={change("product")} options={(data?.products || []).map((product) => ({ value: product._id, label: `${product.name} · ${product.sku}` }))} required />
        <SelectField label="Warehouse" value={form.warehouse} onChange={change("warehouse")} options={(data?.warehouses || []).map((warehouse) => ({ value: warehouse._id, label: warehouse.name }))} required />
        <Field label="Quantity" type="number" min="1" step="1" value={form.quantity} onChange={change("quantity")} required />
        <Field label="Note (optional)" placeholder="Add a reference or note" value={form.note} onChange={change("note")} />
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setDialog("")}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : dialog === "in" ? "Record stock in" : "Record stock out"}</Button></div>
      </form>
    </section></div>}
  </>;
}
