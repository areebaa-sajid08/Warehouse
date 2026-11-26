import { useCallback, useState } from "react";
import { apiRequest, queryString } from "../lib/api.js";
import { useLoad } from "../lib/useLoad.js";
import { EmptyState, LoadingState, PageHeader, Pagination, Panel } from "./UI.jsx";

const PAGE_SIZE = 25;
const emptyList = [];

export default function Transactions({ token }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const query = queryString({
    page,
    limit: PAGE_SIZE,
    search,
    type: typeFilter === "all" ? "" : typeFilter,
    warehouse: warehouseFilter === "all" ? "" : warehouseFilter,
    from: dateFrom,
    to: dateTo,
    sort,
  });
  const load = useCallback(async () => {
    const [result, warehouseResult] = await Promise.all([
      apiRequest(`/transactions${query}`, { token }),
      apiRequest("/warehouses?limit=100", { token }),
    ]);
    return {
      transactions: result.transactions || [],
      pagination: result.pagination,
      warehouses: warehouseResult.warehouses || [],
    };
  }, [query, token]);
  const { data, loading, error } = useLoad(load);
  const transactions = data?.transactions || emptyList;
  const warehouses = data?.warehouses || emptyList;
  const pagination = data?.pagination || { page: 1, total: 0, pages: 1 };
  const pageCount = Math.max(1, pagination.pages || 1);
  const currentPage = Math.min(page, pageCount);
  const pageTransactions = transactions;
  const updateFilter = (setter) => (value) => { setter(value); setPage(1); };

  return <>
    <PageHeader eyebrow="INVENTORY AUDIT" title="Transaction history" description="Review who moved stock, when it happened, and the quantities involved." />
    {error && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-4 py-3 text-xs text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]">{error}</div>}
    {loading ? <LoadingState /> : <Panel title="Stock movements" subtitle={`Showing ${transactions.length} of ${pagination.total} transactions`} action={<div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2 xl:grid-cols-6">
      <input className="h-9 min-w-0 rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-xs text-[#344132] outline-none placeholder:text-[#939b8e] dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc] dark:placeholder:text-[#788677]" type="search" aria-label="Search transaction history" placeholder="Search product or person" value={search} onChange={(event) => updateFilter(setSearch)(event.target.value)} />
      <select className="h-9 rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-xs text-[#344132] outline-none dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc]" aria-label="Filter transaction type" value={typeFilter} onChange={(event) => updateFilter(setTypeFilter)(event.target.value)}><option value="all">All movement types</option><option value="stock-in">Stock in</option><option value="stock-out">Stock out</option></select>
      <select className="h-9 rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-xs text-[#344132] outline-none dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc]" aria-label="Filter transactions by warehouse" value={warehouseFilter} onChange={(event) => updateFilter(setWarehouseFilter)(event.target.value)}><option value="all">All warehouses</option>{warehouses.map((warehouse) => <option value={warehouse.value} key={warehouse.value}>{warehouse.label}</option>)}</select>
      <input className="h-9 rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-xs text-[#344132] outline-none dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc]" type="date" aria-label="Transactions from date" value={dateFrom} onChange={(event) => updateFilter(setDateFrom)(event.target.value)} />
      <input className="h-9 rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-xs text-[#344132] outline-none dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc]" type="date" aria-label="Transactions to date" value={dateTo} onChange={(event) => updateFilter(setDateTo)(event.target.value)} />
      <select className="h-9 rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-xs text-[#344132] outline-none dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc]" aria-label="Sort transactions" value={sort} onChange={(event) => updateFilter(setSort)(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
    </div>}>
      {!pageTransactions.length ? <EmptyState title={pagination.total ? "No transactions on this page" : "No stock movements"}>{pagination.total ? "Choose another page." : "Stock-in and stock-out activity will appear here."}</EmptyState> : <>
        <div className="max-w-full overflow-x-auto overscroll-x-contain"><table className="w-full min-w-max border-collapse text-left">
          <thead className="bg-[#f0f0e8] text-[10px] uppercase tracking-wider text-[#667261] dark:bg-[#252e26] dark:text-[#aab8a4]"><tr>{["Date & time", "Movement", "Product", "Warehouse", "Quantity", "Performed by", "Note"].map((label) => <th className="whitespace-nowrap border-b border-[#e1e2d7] px-4 py-3 font-bold dark:border-[#394339]" key={label}>{label}</th>)}</tr></thead>
          <tbody>{pageTransactions.map((transaction) => {
            const isStockIn = transaction.transactionType === "stock-in";
            return <tr className="border-b border-[#e9e9e0] text-xs text-[#68756a] last:border-0 hover:bg-[#f7f7f0] dark:border-[#303a30] dark:text-[#aab8a4] dark:hover:bg-[#222a22]" key={transaction._id}>
              <td className="whitespace-nowrap px-4 py-3">{new Date(transaction.date || transaction.createdAt).toLocaleString()}</td>
              <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-[10px] font-bold ${isStockIn ? "bg-[#eaf1e9] text-[#496544] dark:bg-[#26372a] dark:text-[#b2d8af]" : "bg-[#f5e8e3] text-[#9c4e3e] dark:bg-[#3a2a27] dark:text-[#e3a79a]"}`}>{isStockIn ? "Stock in" : "Stock out"}</span></td>
              <td className="px-4 py-3"><strong className="font-semibold text-[#3d4c41] dark:text-[#d6dfd1]">{transaction.product?.name || "Deleted product"}</strong><small className="mt-1 block font-mono text-[10px] text-[#929b90] dark:text-[#899789]">{transaction.product?.sku || "—"}</small></td>
              <td className="px-4 py-3">{transaction.warehouse?.name || "Deleted warehouse"}</td>
              <td className={`px-4 py-3 font-bold tabular-nums ${isStockIn ? "text-[#496544] dark:text-[#b2d8af]" : "text-[#9c4e3e] dark:text-[#e3a79a]"}`}>{isStockIn ? "+" : "−"}{transaction.quantity}</td>
              <td className="px-4 py-3">{transaction.performedBy?.name || "Unknown user"}</td>
              <td className="max-w-56 px-4 py-3 text-[10px] text-[#858e82] dark:text-[#9ba998]">{transaction.note || "—"}</td>
            </tr>;
          })}</tbody>
        </table></div>
        <Pagination page={currentPage} pageSize={PAGE_SIZE} total={pagination.total} onChange={setPage} />
      </>}
    </Panel>}
  </>;
}
