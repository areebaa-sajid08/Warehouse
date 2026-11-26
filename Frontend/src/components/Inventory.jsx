import { useCallback, useState } from "react";
import { apiRequest, queryString } from "../lib/api.js";
import { showError, showSuccess } from "../lib/alerts.js";
import { useLoad } from "../lib/useLoad.js";
import { Button, EmptyState, Field, LoadingState, Modal, PageHeader, Pagination, Panel, SelectField } from "./UI.jsx";

const initialForm = { product: "", warehouse: "", quantity: "", note: "" };
const PAGE_SIZE = 25;
const emptyList = [];

export default function Inventory({ token, onNavigate }) {
  const [dialog, setDialog] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);
  const query = queryString({ page, limit: PAGE_SIZE, search });
  const load = useCallback(async () => {
    const [stockResult, warehousesResult, productsResult] = await Promise.all([
      apiRequest(`${stockFilter === "low" ? "/stock/low" : "/stock"}${query}`, { token }),
      apiRequest("/warehouses?limit=100", { token }),
      apiRequest("/products?limit=100", { token }),
    ]);
    return {
      stock: stockFilter === "low" ? stockResult.lowStock : stockResult.stock,
      pagination: stockResult.pagination,
      summary: stockResult.summary,
      warehouses: warehousesResult.warehouses,
      products: productsResult.products,
    };
  }, [query, stockFilter, token]);
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
  const stocks = data?.stock || emptyList;
  const pagination = data?.pagination || { page: 1, total: 0, pages: 1 };
  const pageCount = Math.max(1, pagination.pages || 1);
  const currentPage = Math.min(page, pageCount);
  const pageStocks = stocks;

  return <>
    <PageHeader eyebrow="STOCK CONTROL" title="Inventory" description="Track stock levels across your assigned warehouses." action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => onNavigate("transactions")}>Transaction history</Button><Button variant="secondary" onClick={() => setDialog("out")}>− Stock out</Button><Button onClick={() => setDialog("in")}>＋ Stock in</Button></div>} />
    {loadError && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-4 py-3 text-xs text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]">{loadError}</div>}
    {loading ? <LoadingState /> : <>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Tracked items" value={data?.summary?.trackedItems || 0} caption="Product / warehouse combinations" />
        <SummaryCard label="Total units" value={(data?.summary?.totalUnits || 0).toLocaleString()} caption="Across visible locations" />
        <SummaryCard label="Low stock" value={data?.summary?.lowStock || 0} caption="At or below reorder point" />
      </div>
      <Panel title="Stock on hand" subtitle={`Showing ${stocks.length} of ${pagination.total} product and warehouse combinations`} action={<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <select className="h-9 rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-xs text-[#344132] outline-none dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc]" aria-label="Filter stock status" value={stockFilter} onChange={(event) => { setStockFilter(event.target.value); setPage(1); }}>
          <option value="all">All stock</option><option value="low">Low stock</option>
        </select>
        <input className="h-9 w-full rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-xs text-[#344132] outline-none placeholder:text-[#939b8e] dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc] dark:placeholder:text-[#788677] sm:w-56" type="search" aria-label="Search stock" placeholder="Search product or warehouse" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      </div>}>
        {pageStocks.length ? <><div className="hidden max-w-full overflow-x-auto overscroll-x-contain lg:block"><table className="w-full min-w-max border-collapse text-left">
          <thead className="bg-[#f0f0e8] text-[10px] uppercase tracking-wider text-[#667261] dark:bg-[#252e26] dark:text-[#aab8a4]"><tr>{["Product", "SKU", "Warehouse", "On hand", "Reorder point", "Status"].map((item) => <th className="border-b border-[#e1e2d7] px-4 py-3 font-bold dark:border-[#394339]" key={item}>{item}</th>)}</tr></thead>
          <tbody>{pageStocks.map((item) => {
            const low = item.product && item.quantity <= item.product.lowStockLimit;
            return <tr className="border-b border-[#e9e9e0] text-xs text-[#68756a] last:border-0 hover:bg-[#f7f7f0] dark:border-[#303a30] dark:text-[#aab8a4] dark:hover:bg-[#222a22]" key={item._id}>
              <td className="px-4 py-3"><strong className="font-semibold text-[#3d4c41] dark:text-[#d6dfd1]">{item.product?.name || "Deleted product"}</strong><small className="mt-1 block text-[10px] text-[#929b90] dark:text-[#899789]">{item.product?.category || "—"}</small></td>
              <td className="px-4 py-3 font-mono">{item.product?.sku || "—"}</td><td className="px-4 py-3">{item.warehouse?.name || "Deleted warehouse"}</td>
              <td className="px-4 py-3 font-bold tabular-nums text-[#34443a] dark:text-[#d0dacb]">{item.quantity}</td><td className="px-4 py-3">{item.product?.lowStockLimit ?? "—"}</td>
              <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold ${low ? "text-[#b4743b]" : "text-[#4b7957]"}`}><i className={`size-1.5 rounded-full ${low ? "bg-[#d69a58]" : "bg-[#6a996d]"}`} />{low ? "Reorder" : "In stock"}</span></td>
            </tr>;
          })}</tbody>
        </table></div>
        <div className="grid gap-3 p-3 lg:hidden">{pageStocks.map((item) => {
          const low = item.product && item.quantity <= item.product.lowStockLimit;
          return <article className="min-w-0 rounded-lg border border-[#e3e3d9] bg-[#fffefa] p-3 dark:border-[#3c473b] dark:bg-[#202820]" key={item._id}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block break-words text-sm font-semibold text-[#3d4c41] dark:text-[#d6dfd1]">{item.product?.name || "Deleted product"}</strong><small className="mt-1 block text-xs text-[#929b90] dark:text-[#899789]">{item.warehouse?.name || "Deleted warehouse"}</small></div><span className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${low ? "bg-[#f3eddd] text-[#85602e]" : "bg-[#eaf1e9] text-[#496544] dark:bg-[#26372a] dark:text-[#b2d8af]"}`}>{low ? "Reorder" : "In stock"}</span></div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <CardDetail label="SKU">{item.product?.sku || "—"}</CardDetail>
              <CardDetail label="On hand">{item.quantity}</CardDetail>
              <CardDetail label="Reorder point">{item.product?.lowStockLimit ?? "—"}</CardDetail>
            </div>
          </article>;
        })}</div>
        <Pagination page={currentPage} pageSize={PAGE_SIZE} total={pagination.total} onChange={setPage} /></> : <EmptyState title={pagination.total ? "No stock on this page" : "No stock recorded"}>{pagination.total ? "Choose another page." : "Record a stock-in transaction to start tracking inventory."}</EmptyState>}
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

function CardDetail({ label, children }) {
  return <div className="min-w-0"><span className="block text-[10px] text-[#92998e] dark:text-[#899789]">{label}</span><strong className="mt-1 block break-words text-xs font-semibold text-[#475542] dark:text-[#c7d2c2]">{children}</strong></div>;
}
