import { useCallback, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { showError, showSuccess } from "../lib/alerts.js";
import { useLoad } from "../lib/useLoad.js";
import { Button, EmptyState, Field, LoadingState, Modal, PageHeader, Panel, SelectField } from "./UI.jsx";

const initialForm = { product: "", warehouse: "", quantity: "", note: "" };

export default function Inventory({ token }) {
  const [dialog, setDialog] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(initialForm);
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
      setForm(initialForm);
      await reload();
      await showSuccess(dialog === "in" ? "Stock received" : "Stock updated");
    } catch (err) {
      setError(err.message);
      await showError(err.message);
    } finally { setBusy(false); }
  };
  const stocks = data?.stock || [];

  return <>
    <PageHeader eyebrow="STOCK CONTROL" title="Inventory" description="Track stock levels across your assigned warehouses." action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setDialog("out")}>− Stock out</Button><Button onClick={() => setDialog("in")}>＋ Stock in</Button></div>} />
    {loadError && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-4 py-3 text-xs text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]">{loadError}</div>}
    {loading ? <LoadingState /> : <>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Tracked items" value={stocks.length} caption="Product / warehouse combinations" />
        <SummaryCard label="Total units" value={stocks.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()} caption="Across visible locations" />
        <SummaryCard label="Low stock" value={stocks.filter((item) => item.product && item.quantity <= item.product.lowStockLimit).length} caption="At or below reorder point" />
      </div>
      <Panel title="Stock on hand" subtitle={`${stocks.length} product and warehouse combinations`}>
        {stocks.length ? <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
          <thead className="bg-[#f0f0e8] text-[10px] uppercase tracking-wider text-[#667261] dark:bg-[#252e26] dark:text-[#aab8a4]"><tr>{["Product", "SKU", "Warehouse", "On hand", "Reorder point", "Status"].map((item) => <th className="border-b border-[#e1e2d7] px-4 py-3 font-bold dark:border-[#394339]" key={item}>{item}</th>)}</tr></thead>
          <tbody>{stocks.map((item) => {
            const low = item.product && item.quantity <= item.product.lowStockLimit;
            return <tr className="border-b border-[#e9e9e0] text-xs text-[#68756a] last:border-0 hover:bg-[#f7f7f0] dark:border-[#303a30] dark:text-[#aab8a4] dark:hover:bg-[#222a22]" key={item._id}>
              <td className="px-4 py-3"><strong className="font-semibold text-[#3d4c41] dark:text-[#d6dfd1]">{item.product?.name || "Deleted product"}</strong><small className="mt-1 block text-[10px] text-[#929b90] dark:text-[#899789]">{item.product?.category || "—"}</small></td>
              <td className="px-4 py-3 font-mono">{item.product?.sku || "—"}</td><td className="px-4 py-3">{item.warehouse?.name || "Deleted warehouse"}</td>
              <td className="px-4 py-3 font-bold tabular-nums text-[#34443a] dark:text-[#d0dacb]">{item.quantity}</td><td className="px-4 py-3">{item.product?.lowStockLimit ?? "—"}</td>
              <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold ${low ? "text-[#b4743b]" : "text-[#4b7957]"}`}><i className={`size-1.5 rounded-full ${low ? "bg-[#d69a58]" : "bg-[#6a996d]"}`} />{low ? "Reorder" : "In stock"}</span></td>
            </tr>;
          })}</tbody>
        </table></div> : <EmptyState title="No stock recorded">Record a stock-in transaction to start tracking inventory.</EmptyState>}
      </Panel>
    </>}
    {dialog && <Modal title={dialog === "in" ? "Receive stock" : "Record stock out"} onClose={() => setDialog("")}>
      <div className="mb-5 text-[10px] font-bold tracking-[.15em] text-[#78866a]">INVENTORY TRANSACTION</div>
      {error && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-3 py-2.5 text-xs text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]">{error}</div>}
      <form className="grid gap-4" onSubmit={submit}>
        <SelectField label="Product" value={form.product} onChange={change("product")} options={(data?.products || []).map((product) => ({ value: product._id, label: `${product.name} · ${product.sku}` }))} required />
        <SelectField label="Warehouse" value={form.warehouse} onChange={change("warehouse")} options={(data?.warehouses || []).map((warehouse) => ({ value: warehouse._id, label: warehouse.name }))} required />
        <Field label="Quantity" type="number" min="1" step="1" value={form.quantity} onChange={change("quantity")} required />
        <Field label="Note (optional)" placeholder="Add a reference or note" value={form.note} onChange={change("note")} />
        <div className="mt-1 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setDialog("")}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : dialog === "in" ? "Record stock in" : "Record stock out"}</Button></div>
      </form>
    </Modal>}
  </>;
}

function SummaryCard({ label, value, caption }) {
  return <div className="grid gap-1 rounded-xl border border-[#dedfd4] bg-[#fbfaf5] p-4 shadow-sm dark:border-[#303a30] dark:bg-[#1a211b]"><span className="text-[10px] text-[#858e81] dark:text-[#9ba998]">{label}</span><b className="text-2xl font-semibold tracking-tight text-[#34443a] dark:text-[#d0dacb]">{value}</b><small className="text-[10px] text-[#92998e] dark:text-[#899789]">{caption}</small></div>;
}
