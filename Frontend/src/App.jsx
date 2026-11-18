import { useEffect, useMemo, useState } from "react";
import AuthScreen from "./components/AuthScreen.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Inventory from "./components/Inventory.jsx";
import Catalog from "./components/Catalog.jsx";
import Orders from "./components/Orders.jsx";
import Supply from "./components/Supply.jsx";
import "./App.css";

const navigation = [
  { id: "overview", label: "Overview", section: "Workspace", roles: ["admin", "warehouseManager", "salesRepresentative", "supplier"] },
  { id: "inventory", label: "Inventory", section: "Workspace", roles: ["admin", "warehouseManager"] },
  { id: "products", label: "Products", section: "Workspace", roles: ["admin", "warehouseManager", "supplier", "salesRepresentative"] },
  { id: "warehouses", label: "Warehouses", section: "Workspace", roles: ["admin", "warehouseManager"] },
  { id: "orders", label: "Orders", section: "Operations", roles: ["admin", "warehouseManager", "salesRepresentative"] },
  { id: "supply", label: "Supply requests", section: "Operations", roles: ["admin", "warehouseManager", "supplier"] },
  { id: "users", label: "Team", section: "Manage", roles: ["admin"] },
];

const icons = { overview: "◫", inventory: "▦", products: "◇", warehouses: "▤", orders: "⇄", supply: "↗", users: "♙" };

function getStoredSession() {
  try {
    const saved = localStorage.getItem("warehouse-session");
    return saved ? JSON.parse(saved) : null;
  } catch {
    localStorage.removeItem("warehouse-session");
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState(getStoredSession);
  const [page, setPage] = useState("overview");

  useEffect(() => {
    const signOutExpiredSession = () => setSession(null);
    window.addEventListener("warehouse:unauthorized", signOutExpiredSession);
    return () => window.removeEventListener("warehouse:unauthorized", signOutExpiredSession);
  }, []);

  const items = useMemo(
    () => navigation.filter((item) => session?.user && item.roles.includes(session.user.role)),
    [session],
  );

  if (!session?.token || !session?.user) {
    return <AuthScreen onAuthenticated={(value) => {
      localStorage.setItem("warehouse-session", JSON.stringify(value));
      setSession(value);
    }} />;
  }

  const active = items.find((item) => item.id === page) || items[0];
  const handleLogout = () => {
    localStorage.removeItem("warehouse-session");
    setSession(null);
  };
  const content = {
    overview: <Dashboard user={session.user} token={session.token} onNavigate={setPage} />,
    inventory: <Inventory token={session.token} />,
    products: <Catalog type="products" token={session.token} user={session.user} />,
    warehouses: <Catalog type="warehouses" token={session.token} user={session.user} />,
    orders: <Orders token={session.token} user={session.user} />,
    supply: <Supply token={session.token} user={session.user} />,
    users: <Catalog type="users" token={session.token} user={session.user} />,
  }[active.id];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("overview"); }}>
          <span className="brand-mark">W</span>
          <span className="brand-copy"><strong>Wareflow</strong><small>INVENTORY PLATFORM</small></span>
        </a>
        <div className="sidebar-label">YOUR WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {["Workspace", "Operations", "Manage"].map((section) => {
            const links = items.filter((item) => item.section === section);
            return links.length ? <div className="nav-section" key={section}>
              <span className="nav-section-title">{section}</span>
              {links.map((item) => <button key={item.id} className={`nav-link ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
                <span className="nav-icon">{icons[item.id]}</span>{item.label}
                {item.id === "inventory" && <span className="nav-dot" />}
              </button>)}
            </div> : null;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon">?</span><strong>Need a hand?</strong><span>Ask your workspace admin for support.</span></div>
          <button className="profile-button" onClick={handleLogout} title="Sign out">
            <span className="avatar">{(session.user.name || session.user.email || "U").slice(0, 1).toUpperCase()}</span>
            <span className="profile-copy"><strong>{session.user.name || "Team member"}</strong><small>{session.user.role}</small></span>
            <span className="profile-menu">↗</span>
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{active.label}</strong></div>
          <div className="topbar-actions"><span className="status-pill"><i /> System operational</span><span className="topbar-divider" /><span className="today-label">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span></div>
        </header>
        <section className="page-content" key={active.id}>{content}</section>
        <footer className="app-footer"><span>Wareflow <b>·</b> Inventory operations, made clear.</span><span>API connected <i /></span></footer>
      </main>
    </div>
  );
}
