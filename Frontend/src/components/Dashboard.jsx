import { useCallback } from "react";
import { apiRequest } from "../lib/api.js";
import { formatCurrency } from "../lib/format.js";
import { useLoad } from "../lib/useLoad.js";
import { EmptyState, LoadingState, PageHeader, Panel, StatusBadge } from "./UI.jsx";

export default function Dashboard({ user, token, onNavigate }) {
  const load = useCallback(async () => {
    if (user.role === "admin") {
      const [stats, warehouses, stock, lowStock, products, orders] = await Promise.all([
        apiRequest("/dashboard/stats", { token }),
        apiRequest("/warehouses?limit=100", { token }),
        apiRequest("/stock?limit=1", { token }),
        apiRequest("/stock/low?limit=5", { token }),
        apiRequest("/products?limit=5", { token }),
        apiRequest("/orders?limit=5", { token }),
      ]);
      return {
        stats,
        warehouses: warehouses.warehouses,
        stockSummary: stock.summary,
        lowStock: lowStock.lowStock,
        products: products.products,
        productCount: products.pagination.total,
        orders: orders.orders,
        orderSummary: orders.statusSummary,
      };
    }
    if (user.role === "warehouseManager") {
      const [warehouses, stock, lowStock, products, orders] = await Promise.all([
        apiRequest("/warehouses?limit=100", { token }),
        apiRequest("/stock?limit=1", { token }),
        apiRequest("/stock/low?limit=5", { token }),
        apiRequest("/products?limit=5", { token }),
        apiRequest("/orders?limit=5", { token }),
      ]);
      return {
        warehouses: warehouses.warehouses,
        stockSummary: stock.summary,
        lowStock: lowStock.lowStock,
        products: products.products,
        productCount: products.pagination.total,
        orders: orders.orders,
        orderSummary: orders.statusSummary,
      };
    }
    if (user.role === "salesRepresentative") {
      const [orders, products] = await Promise.all([
        apiRequest("/orders?limit=5", { token }),
        apiRequest("/products?limit=5", { token }),
      ]);
      return { orders: orders.orders, orderSummary: orders.statusSummary, productCount: products.pagination.total, products: products.products };
    }
    const [requests, products] = await Promise.all([
      apiRequest("/supply-requests?limit=5", { token }),
      apiRequest("/products?limit=5", { token }),
    ]);
    return { requests: requests.requests, requestSummary: requests.statusSummary, productCount: products.pagination.total, products: products.products };
  }, [token, user.role]);
  const { data, loading, error } = useLoad(load);

  const products = data?.products || [];
  const warehouses = data?.warehouses || [];
  const orders = data?.orders || [];
  const requests = data?.requests || [];
  const lowStock = data?.lowStock || [];
  const statusSummary = data?.orderSummary || {};
  const requestSummary = data?.requestSummary || {};
  const unitsOnHand = data?.stockSummary?.totalUnits || 0;

  const metrics = user.role === "admin"
    ? [["Products", data?.stats?.products ?? 0, "In the live catalog", "◇"], ["Locations", data?.stats?.warehouses ?? 0, "Across your network", "▤"], ["Units on hand", unitsOnHand.toLocaleString(), "From recorded stock", "▥"], ["Reorder alerts", data?.stats?.lowStockProducts ?? 0, "At or below reorder point", "↓"]]
    : user.role === "warehouseManager"
    ? [["My locations", warehouses.length, "Assigned warehouses", "▤"], ["Stock records", data?.stockSummary?.trackedItems ?? 0, "Product / location pairs", "▥"], ["Units on hand", unitsOnHand.toLocaleString(), "Across assigned sites", "▦"], ["Reorder alerts", data?.stockSummary?.lowStock ?? 0, "Need a closer look", "↓"]]
      : user.role === "salesRepresentative"
      ? [["My orders", Object.values(statusSummary).reduce((sum, item) => sum + item.count, 0), "Created by your account", "⇄"], ["To process", (statusSummary.Pending?.count || 0) + (statusSummary.Processing?.count || 0), "Pending or in progress", "◷"], ["Products", data?.productCount || 0, "In the live catalog", "◇"], ["Completed value", formatCurrency(statusSummary.Completed?.value || 0), "From completed orders", "PKR"]]
      : [["My requests", Object.values(requestSummary).reduce((sum, item) => sum + item.count, 0), "Submitted by your account", "↗"], ["Awaiting review", requestSummary.Pending?.count || 0, "Pending requests", "◷"], ["Approved", requestSummary.Approved?.count || 0, "Approved requests", "✓"], ["Products", data?.productCount || 0, "In the live catalog", "◇"]];

  return <>
    <PageHeader eyebrow="WAREHOUSE CONTROL ROOM" title={`Good ${getGreeting()}, ${user.name?.split(" ")[0] || "there"}.`} description="A live view of the records your team has put into the system." action={<span className="inline-flex items-center gap-2 rounded border border-[#dfe4d2] bg-[#f7f8ef] px-3 py-2 text-[9px] font-bold tracking-widest text-[#65764c] dark:border-[#45523c] dark:bg-[#252f23] dark:text-[#c4dd9d]"><i className="size-1.5 rounded-full bg-[#9abb56] ring-4 ring-[#dce8c7] dark:ring-[#3b4932]" />LIVE DATABASE</span>} />
    {loading ? <LoadingState label="Loading your workspace" /> : error ? <div className="rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-4 py-3 text-xs text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]">{error}</div> : <>
      <div className="mb-5 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, caption, icon], index) => <article key={label} className="group relative min-h-32 overflow-hidden rounded-xl border border-[#dedfd4] bg-[#fbfaf5] p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-[#303a30] dark:bg-[#1a211b]">
          <div className={`absolute inset-x-0 top-0 h-1 ${index === 3 ? "bg-[#c9ef6b]" : index === 1 ? "bg-[#c5a26c]" : "bg-[#82945d]"}`} />
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#737d70] dark:text-[#a0ad9d]"><span>{label}</span><span className="grid size-8 place-items-center rounded-md bg-[#e8efda] text-sm text-[#293627] dark:bg-[#35432f] dark:text-[#d0e6ae]">{icon}</span></div>
          <strong className="mt-4 block truncate text-2xl font-semibold tracking-tight text-[#293a30] dark:text-[#e0e7dc]">{value}</strong>
          <small className="text-[10px] text-[#929a8f] dark:text-[#899789]">{caption}</small>
        </article>)}
      </div>

      {["admin", "warehouseManager"].includes(user.role) ? <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Warehouse floor" subtitle="Capacity utilization includes stock currently reserved for processing orders" action={<LinkButton onClick={() => onNavigate("inventory")}>Open inventory</LinkButton>} className="xl:col-span-2">
          <WarehouseCapacity warehouses={warehouses} />
        </Panel>
        <Panel title="Reorder watch" subtitle="Items below their saved threshold" action={<LinkButton onClick={() => onNavigate("inventory")}>View stock</LinkButton>}>
          <LowStockList items={lowStock.slice(0, 5)} />
        </Panel>
        <Panel title="Recently added products" subtitle="Newest records from your catalog" action={<LinkButton onClick={() => onNavigate("products")}>All products</LinkButton>}>
          <RecentProductList items={products} />
        </Panel>
        <Panel title="Latest orders" subtitle="Recent customer orders" action={<LinkButton onClick={() => onNavigate("orders")}>All orders</LinkButton>}>
          <OrderList items={orders.slice(0, 5)} />
        </Panel>
      </div> : user.role === "salesRepresentative" ? <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Recent orders" subtitle="Orders created by your account" action={<LinkButton onClick={() => onNavigate("orders")}>Manage orders</LinkButton>}><OrderList items={orders.slice(0, 5)} /></Panel>
        <Panel title="Product catalog" subtitle="Current products and prices" action={<LinkButton onClick={() => onNavigate("products")}>Browse catalog</LinkButton>}><RecentProductList items={products} /></Panel>
      </div> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Supply request activity" subtitle="Requests submitted from your account" action={<LinkButton onClick={() => onNavigate("supply")}>Manage requests</LinkButton>}><RequestList items={requests.slice(0, 5)} /></Panel>
        <Panel title="Product catalog" subtitle="Current products available to request" action={<LinkButton onClick={() => onNavigate("products")}>Browse catalog</LinkButton>}><RecentProductList items={products} /></Panel>
      </div>}
    </>}
  </>;
}

function LinkButton({ children, onClick }) {
  return <button className="text-[10px] font-bold text-[#4b6337] hover:text-[#263f26] hover:underline" onClick={onClick}>{children} <span className="text-[#7c9549]">→</span></button>;
}

function WarehouseCapacity({ warehouses }) {
  if (!warehouses.length) return <EmptyState title="No warehouse locations yet">Add a warehouse to see its stock position here.</EmptyState>;
  return <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
    {warehouses.map((warehouse) => {
      const units = warehouse.usedCapacity || 0;
      const capacity = Number(warehouse.capacity) || 0;
      const percentage = capacity > 0 ? Math.min(100, Math.round(units / capacity * 100)) : 0;
      return <div className="flex min-w-0 items-center gap-3 rounded-lg border border-[#e6e7dc] bg-[#f7f7f0] p-3 dark:border-[#3b473b] dark:bg-[#222a22]" key={warehouse._id}>
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-[#dce2cb] bg-[#edf2e2] text-sm text-[#455e35] dark:border-[#465143] dark:bg-[#303b2e] dark:text-[#c4dd9d]">▤</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2"><strong className="truncate text-[11px] text-[#303e30] dark:text-[#d6dfd1]">{warehouse.name}</strong><span className="truncate text-[9px] text-[#838b7d] dark:text-[#899789]">{warehouse.location}</span></div>
          <progress className="my-2 block h-1 w-full overflow-hidden rounded accent-[#a4ca5d]" value={units} max={capacity || 1} aria-label={`${percentage}% of warehouse capacity used`} />
          <small className="text-[9px] text-[#828b7d] dark:text-[#899789]">{capacity ? `${percentage}% of ${capacity.toLocaleString()} unit capacity` : "No storage capacity available"}</small>
        </div>
        <div className="grid justify-items-end"><strong className="text-xs text-[#2e3c2e] dark:text-[#d6dfd1]">{units.toLocaleString()}</strong><small className="text-[9px] text-[#878f82] dark:text-[#899789]">units</small></div>
      </div>;
    })}
  </div>;
}

function CompactList({ items, render, emptyTitle, emptyText }) {
  if (!items.length) return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  return <div className="px-4 pb-2">{items.map(render)}</div>;
}

function LowStockList({ items }) {
  return <CompactList items={items} emptyTitle="No reorder alerts" emptyText="No recorded stock is currently at or below its reorder point." render={(item) =>
    <div className="flex min-h-16 items-center gap-3 border-t border-[#edede5] py-2 dark:border-[#303a30]" key={item._id}>
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#edf1e9] text-xs font-bold uppercase text-[#4d6c53]">{item.product?.name?.slice(0, 1) || "P"}</span>
      <span className="grid min-w-0 flex-1 gap-1"><b className="truncate text-[11px] text-[#3a493e] dark:text-[#d6dfd1]">{item.product?.name || "Product"}</b><small className="truncate text-[9px] text-[#92998e] dark:text-[#899789]">{item.warehouse?.name || "Warehouse"} · reorder at {item.product?.lowStockLimit}</small></span>
      <span className="text-xs font-bold text-[#b56e39]">{item.quantity}<small className="ml-1 font-normal text-[#999f94] dark:text-[#899789]">left</small></span>
    </div>} />;
}

function RecentProductList({ items }) {
  const recent = items.slice(0, 5);
  return <CompactList items={recent} emptyTitle="No products yet" emptyText="Products saved to the database will appear here." render={(product) =>
    <div className="flex min-h-16 items-center gap-3 border-t border-[#edede5] py-2 dark:border-[#303a30]" key={product._id}>
      {product.imageUrl ? <img className="size-9 shrink-0 rounded-md object-cover" src={product.imageUrl} alt="" /> : <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#edf1e9] text-xs font-bold uppercase text-[#4d6c53]">{product.name?.slice(0, 1) || "P"}</span>}
      <span className="grid min-w-0 flex-1 gap-1"><b className="truncate text-[11px] text-[#3a493e] dark:text-[#d6dfd1]">{product.name}</b><small className="truncate text-[9px] text-[#92998e] dark:text-[#899789]">{product.sku} · {product.category || "Uncategorized"}</small></span>
      <strong className="whitespace-nowrap text-[10px] text-[#485e37] dark:text-[#c4dd9d]">{formatCurrency(product.price)}</strong>
    </div>} />;
}

function OrderList({ items }) {
  return <CompactList items={items} emptyTitle="No orders yet" emptyText="New orders saved to the database will appear here." render={(order) =>
    <div className="flex min-h-16 items-center gap-3 border-t border-[#edede5] py-2 dark:border-[#303a30]" key={order._id}>
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#f1eddf] text-xs font-bold text-[#725a34] dark:bg-[#3b3528] dark:text-[#d4c397]">#</span>
      <span className="grid min-w-0 flex-1 gap-1"><b className="truncate text-[11px] text-[#3a493e] dark:text-[#d6dfd1]">{order.orderNumber}</b><small className="truncate text-[9px] text-[#92998e] dark:text-[#899789]">{order.customerName} · {formatCurrency(order.totalAmount)}</small></span>
      <StatusBadge>{order.status}</StatusBadge>
    </div>} />;
}

function RequestList({ items }) {
  return <CompactList items={items} emptyTitle="No supply requests" emptyText="Requests from your account will appear here." render={(request) =>
    <div className="flex min-h-16 items-center gap-3 border-t border-[#edede5] py-2 dark:border-[#303a30]" key={request._id}>
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#f1eddf] text-xs font-bold text-[#725a34] dark:bg-[#3b3528] dark:text-[#d4c397]">↗</span>
      <span className="grid min-w-0 flex-1 gap-1"><b className="truncate text-[11px] text-[#3a493e] dark:text-[#d6dfd1]">{request.product?.name || "Supply request"}</b><small className="truncate text-[9px] text-[#92998e] dark:text-[#899789]">{request.quantity} units · {request.warehouse?.name || "Warehouse"}</small></span>
      <StatusBadge>{request.status}</StatusBadge>
    </div>} />;
}

function getGreeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}
