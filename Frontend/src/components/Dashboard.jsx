import { useCallback } from "react";
import { apiRequest } from "../lib/api.js";
import { EmptyState, LoadingState, PageHeader, Panel, StatusBadge } from "./UI.jsx";
import { useLoad } from "../lib/useLoad.js";

export default function Dashboard({ user, token, onNavigate }) {
  const load = useCallback(async () => {
    if (user.role === "admin") {
      const [stats, stock, orders] = await Promise.all([
        apiRequest("/dashboard/stats", { token }),
        apiRequest("/stock/low", { token }),
        apiRequest("/orders", { token }),
      ]);
      return { stats, lowStock: stock.lowStock, orders: orders.orders };
    }
    if (user.role === "warehouseManager") {
      const [warehouses, stock, orders] = await Promise.all([
        apiRequest("/warehouses", { token }),
        apiRequest("/stock/low", { token }),
        apiRequest("/orders", { token }),
      ]);
      return { warehouses: warehouses.warehouses, lowStock: stock.lowStock, orders: orders.orders };
    }
    if (user.role === "salesRepresentative") {
      const [orders, products] = await Promise.all([
        apiRequest("/orders", { token }),
        apiRequest("/products", { token }),
      ]);
      return { orders: orders.orders, products: products.products };
    }
    const [requests, products] = await Promise.all([
      apiRequest("/supply-requests", { token }),
      apiRequest("/products", { token }),
    ]);
    return { requests: requests.requests, products: products.products };
  }, [token, user.role]);
  const { data, loading, error } = useLoad(load);

  const metrics = user.role === "admin"
    ? [
      ["Products", data?.stats?.products ?? "—", "In your catalog", "◇"],
      ["Warehouses", data?.stats?.warehouses ?? "—", "Active locations", "▤"],
      ["Open orders", data?.stats?.orders ?? "—", "Across all locations", "⇄"],
      ["Low stock", data?.stats?.lowStockProducts ?? "—", "Need your attention", "↓"],
    ]
    : user.role === "warehouseManager"
      ? [
        ["My warehouses", data?.warehouses?.length ?? "—", "Assigned locations", "▤"],
        ["Low stock", data?.lowStock?.length ?? "—", "Items to replenish", "↓"],
        ["Orders", data?.orders?.length ?? "—", "To keep things moving", "⇄"],
      ]
      : user.role === "salesRepresentative"
        ? [
          ["My orders", data?.orders?.length ?? "—", "Placed by you", "⇄"],
          ["Products", data?.products?.length ?? "—", "Available to order", "◇"],
          ["Pending", data?.orders?.filter((item) => item.status === "Pending").length ?? "—", "Awaiting processing", "◷"],
        ]
        : [
          ["My requests", data?.requests?.length ?? "—", "Supply requests", "↗"],
          ["Pending review", data?.requests?.filter((item) => item.status === "Pending").length ?? "—", "Awaiting a decision", "◷"],
          ["Products", data?.products?.length ?? "—", "Available products", "◇"],
        ];

  return <>
    <PageHeader eyebrow="YOUR WORKSPACE" title={`Good ${getGreeting()}, ${user.name?.split(" ")[0] || "there"}.`} description="Here’s what’s happening across your inventory today." action={<button className="button button-secondary" onClick={() => window.location.reload()}>↻ <span>Refresh</span></button>} />
    {loading ? <LoadingState label="Loading your workspace" /> : error ? <div className="notice notice-error">{error}</div> : <>
      <div className={`metric-grid metric-count-${metrics.length}`}>
        {metrics.map(([label, value, caption, icon], index) => <article className={`metric-card metric-accent-${index}`} key={label}>
          <div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
          <strong>{value}</strong><small>{caption}</small>
        </article>)}
      </div>
      <div className="dashboard-grid">
        <Panel title={user.role === "supplier" ? "Recent supply requests" : "Items to keep an eye on"} subtitle={user.role === "supplier" ? "Your latest supplier activity" : "Stock at or below its reorder point"} action={<button className="text-button" onClick={() => onNavigate(user.role === "supplier" ? "supply" : user.role === "salesRepresentative" ? "orders" : "inventory")}>View all <span>→</span></button>}>
          {user.role === "supplier"
            ? <RequestList items={(data?.requests || []).slice(0, 5)} />
            : user.role === "salesRepresentative"
              ? <OrderList items={(data?.orders || []).slice(0, 5)} />
              : <LowStockList items={(data?.lowStock || []).slice(0, 5)} />}
        </Panel>
        <Panel title="Quick actions" subtitle="Jump back into your workflow">
          <div className="quick-actions">
            {user.role !== "supplier" && <button onClick={() => onNavigate("products")}><span className="quick-icon violet">◇</span><span><b>Browse products</b><small>View product details</small></span><i>→</i></button>}
            {(user.role === "admin" || user.role === "warehouseManager") && <button onClick={() => onNavigate("inventory")}><span className="quick-icon green">▦</span><span><b>Manage inventory</b><small>Update stock levels</small></span><i>→</i></button>}
            {(user.role === "admin" || user.role === "salesRepresentative") && <button onClick={() => onNavigate("orders")}><span className="quick-icon amber">⇄</span><span><b>Manage orders</b><small>Review recent activity</small></span><i>→</i></button>}
            {user.role === "supplier" && <button onClick={() => onNavigate("supply")}><span className="quick-icon green">↗</span><span><b>Submit supply request</b><small>Request stock replenishment</small></span><i>→</i></button>}
          </div>
        </Panel>
      </div>
    </>}
    <div className="dashboard-note"><span>✦</span><div><b>A clear view makes a better next move.</b><small>Your workspace updates as your team records stock, orders, and requests.</small></div></div>
  </>;
}

function LowStockList({ items }) {
  if (!items.length) return <EmptyState title="Stock looks healthy">No products are currently below their reorder point.</EmptyState>;
  return <div className="compact-list">{items.map((item) => <div className="compact-row" key={item._id}>
    <span className="product-placeholder">{item.product?.name?.slice(0, 1) || "P"}</span><span className="compact-copy"><b>{item.product?.name || "Product"}</b><small>{item.warehouse?.name || "Warehouse"}</small></span>
    <span className="quantity-alert">{item.quantity}<small>left</small></span>
  </div>)}</div>;
}

function OrderList({ items }) {
  if (!items.length) return <EmptyState title="No orders yet">New orders will show up here.</EmptyState>;
  return <div className="compact-list">{items.map((order) => <div className="compact-row" key={order._id}>
    <span className="order-mark">#</span><span className="compact-copy"><b>{order.orderNumber}</b><small>{order.customerName}</small></span><StatusBadge>{order.status}</StatusBadge>
  </div>)}</div>;
}

function RequestList({ items }) {
  if (!items.length) return <EmptyState title="No requests yet">Your requests and their status will appear here.</EmptyState>;
  return <div className="compact-list">{items.map((request) => <div className="compact-row" key={request._id}>
    <span className="order-mark">↗</span><span className="compact-copy"><b>{request.product?.name || "Supply request"}</b><small>{request.quantity} units · {request.warehouse?.name || "Warehouse"}</small></span><StatusBadge>{request.status}</StatusBadge>
  </div>)}</div>;
}

function getGreeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}
