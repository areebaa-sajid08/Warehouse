import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthScreen from "./components/AuthScreen.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Inventory from "./components/Inventory.jsx";
import Transactions from "./components/Transactions.jsx";
import Catalog from "./components/Catalog.jsx";
import Orders from "./components/Orders.jsx";
import Supply from "./components/Supply.jsx";
import NotificationCenter from "./components/NotificationCenter.jsx";
import { confirmAction, showError } from "./lib/alerts.js";
import { apiRequest } from "./lib/api.js";

const navigation = [
  { id: "overview", label: "Overview", section: "Workspace", roles: ["admin", "warehouseManager", "salesRepresentative", "supplier"] },
  { id: "inventory", label: "Inventory", section: "Workspace", roles: ["admin", "warehouseManager"] },
  { id: "transactions", label: "Transactions", section: "Workspace", roles: ["admin", "warehouseManager"] },
  { id: "products", label: "Products", section: "Workspace", roles: ["admin", "warehouseManager", "supplier", "salesRepresentative"] },
  { id: "warehouses", label: "Warehouses", section: "Workspace", roles: ["admin", "warehouseManager"] },
  { id: "orders", label: "Orders", section: "Operations", roles: ["admin", "warehouseManager", "salesRepresentative"] },
  { id: "supply", label: "Supply requests", section: "Operations", roles: ["admin", "warehouseManager", "supplier"] },
  { id: "users", label: "Team", section: "Manage", roles: ["admin"] },
];

const icons = { overview: "◫", inventory: "▦", transactions: "↻", products: "◇", warehouses: "▤", orders: "⇄", supply: "↗", users: "♙" };

function getStoredTheme() {
  try {
    return localStorage.getItem("warehouse-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [theme, setTheme] = useState(getStoredTheme);
  const requestedPage = location.pathname.replace(/^\/+|\/+$/g, "") || "overview";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("warehouse-theme", theme);
    } catch {
      // The selected theme still applies for this session when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    const signOutExpiredSession = () => {
      try { localStorage.removeItem("warehouse-session"); } catch { /* Cookie auth does not depend on local storage. */ }
      setSession(null);
    };
    window.addEventListener("warehouse:unauthorized", signOutExpiredSession);
    return () => window.removeEventListener("warehouse:unauthorized", signOutExpiredSession);
  }, []);

  useEffect(() => {
    let active = true;
    try { localStorage.removeItem("warehouse-session"); } catch { /* Cookie auth does not depend on local storage. */ }
    apiRequest("/auth/me")
      .then(({ user }) => { if (active) setSession({ user }); })
      .catch(() => { if (active) setSession(null); })
      .finally(() => { if (active) setSessionLoading(false); });
    return () => { active = false; };
  }, []);

  const items = useMemo(
    () => navigation.filter((item) => session?.user && item.roles.includes(session.user.role)),
    [session],
  );
  const active = items.find((item) => item.id === requestedPage) || items[0];

  useEffect(() => {
    if (session?.user && active && active.id !== requestedPage) navigate(`/${active.id}`, { replace: true });
  }, [active, navigate, requestedPage, session]);

  if (sessionLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#fbfaf5] dark:bg-[#111711]" aria-label="Loading session">
      <span className="grid size-12 place-items-center rounded-md bg-[#c9ef6b] text-xl font-extrabold text-[#172019]">W</span>
    </div>;
  }

  if (!session?.user) {
    return <AuthScreen onAuthenticated={(value) => {
      setSession(value);
    }} theme={theme} onToggleTheme={() => setTheme((value) => value === "dark" ? "light" : "dark")} />;
  }

  const navigateToPage = (pageId) => navigate(`/${pageId}`);
  const handleLogout = async () => {
    const result = await confirmAction({ title: "Sign out?", text: "You can sign back in at any time.", confirmText: "Sign out", icon: "question" });
    if (!result.isConfirmed) return;
    try {
      await apiRequest("/auth/logout", { method: "POST" });
      setSession(null);
    } catch (error) {
      await showError(error.message);
    }
  };
  const content = {
    overview: <Dashboard user={session.user} token={session.token} onNavigate={navigateToPage} />,
    inventory: <Inventory token={session.token} onNavigate={navigateToPage} />,
    transactions: <Transactions token={session.token} />,
    products: <Catalog type="products" token={session.token} user={session.user} />,
    warehouses: <Catalog type="warehouses" token={session.token} user={session.user} />,
    orders: <Orders token={session.token} user={session.user} />,
    supply: <Supply token={session.token} user={session.user} />,
    users: <Catalog type="users" token={session.token} user={session.user} />,
  }[active.id];

  return (
    <div className="flex min-h-screen flex-col bg-[#eeeee7] text-[#202820] dark:bg-[#111711] dark:text-[#e1e7dc] md:flex-row">
      <aside className="flex w-full shrink-0 flex-col bg-[#171e18] px-3 pb-2 pt-3 text-white sm:px-4 md:sticky md:top-0 md:h-screen md:w-60 md:overflow-y-auto md:px-4 md:pb-4 md:pt-7">
        <button className="mb-3 flex items-center gap-3 text-left md:mb-10" type="button" onClick={() => navigateToPage("overview")}>
          <span className="grid size-10 place-items-center rounded-md bg-[#c9ef6b] text-lg font-extrabold text-[#172019]">W</span>
          <span className="grid gap-0.5"><strong className="text-base font-bold">Wareflow</strong><small className="text-[8px] font-semibold tracking-[.16em] text-[#a7b09d]">INVENTORY PLATFORM</small></span>
        </button>
        <div className="mb-3 hidden px-3 text-[9px] font-bold tracking-[.18em] text-[#849080] md:block">YOUR WORKSPACE</div>
        <nav className="flex w-full min-w-0 flex-wrap gap-1 pb-1 md:flex-1 md:flex-col md:flex-nowrap md:gap-0" aria-label="Main navigation">
          {["Workspace", "Operations", "Manage"].map((section) => {
            const links = items.filter((item) => item.section === section);
            return links.length ? <div className="w-full min-w-0 md:mb-6" key={section}>
              <span className="mb-2 hidden px-3 text-[10px] font-semibold text-[#91a294] md:block">{section}</span>
              <div className="flex flex-wrap gap-1 md:flex-nowrap md:flex-col">{links.map((item) => <button key={item.id} className={`flex min-h-10 items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-medium transition hover:bg-white/10 md:w-full md:gap-3 ${active.id === item.id ? "bg-[#c9ef6b]/10 text-[#d7f78b] md:shadow-[inset_2px_0_#c9ef6b]" : "text-[#b8c0b1]"}`} onClick={() => navigateToPage(item.id)}>
                <span className="grid w-4 place-items-center text-sm">{icons[item.id]}</span><span>{item.label}</span>
              </button>)}</div>
            </div> : null;
          })}
        </nav>
        <div className="mt-4 hidden md:mt-auto md:block">
          <div className="mb-4 grid gap-1 rounded-lg border border-white/10 bg-white/5 p-3"><span className="mb-1 grid size-6 place-items-center rounded bg-white/10 text-xs text-[#d5f48a]">?</span><strong className="text-[11px]">Need a hand?</strong><span className="text-[10px] leading-relaxed text-[#9aac9c]">Ask your workspace admin for support.</span></div>
          <button className="flex w-full items-center gap-3 border-t border-white/10 pt-4 text-left" onClick={handleLogout} title="Sign out">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#d9e3d6] text-sm font-bold text-[#203d32]">{(session.user.name || session.user.email || "U").slice(0, 1).toUpperCase()}</span>
            <span className="grid min-w-0 flex-1 gap-1"><strong className="truncate text-[11px]">{session.user.name || "Team member"}</strong><small className="text-[10px] capitalize text-[#a5b3a5]">{session.user.role}</small></span>
            <span className="text-sm text-[#a5b3a5]">↗</span>
          </button>
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#dedfd4] bg-[#fbfaf5] px-3 py-2 dark:border-[#303a30] dark:bg-[#1a211b] sm:flex-nowrap sm:px-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 truncate text-xs text-[#969d91] dark:text-[#a0ad9d]"><span className="shrink-0">Workspace</span><b className="shrink-0 font-normal text-[#c4c6b9] dark:text-[#657365]">/</b><strong className="truncate font-semibold text-[#39483e] dark:text-[#d7dfd2]">{active.label}</strong></div>
          <div className="flex shrink-0 items-center gap-2 text-[10px] text-[#858e82] sm:gap-3">
            <NotificationCenter token={session.token} />
            <button className="grid size-9 place-items-center rounded-md border border-[#dfe1d6] bg-[#fffefa] text-sm text-[#475542] hover:bg-[#f1f2eb] dark:border-[#414b3f] dark:bg-[#202820] dark:text-[#d4decf] dark:hover:bg-[#2c362c]" type="button" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{theme === "dark" ? "☀" : "☾"}</button>
            <span className="hidden items-center gap-2 rounded border border-[#dfe4df] bg-[#f7f8f1] px-2.5 py-1.5 dark:border-[#374338] dark:bg-[#222c23] sm:flex"><i className="size-1.5 rounded-full bg-[#79945a]" />Workspace</span><span className="hidden text-[#828b80] dark:text-[#8e9b8b] sm:block">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span>
          </div>
        </header>
        <section className="mx-auto w-full max-w-[1540px] flex-1 p-3 sm:p-5 lg:p-8" key={active.id}>{content}</section>
        <footer className="flex flex-col gap-1 border-t border-[#dedfd4] px-3 py-3 text-[10px] text-[#92998e] dark:border-[#303a30] dark:text-[#929f90] sm:flex-row sm:justify-between sm:px-5 lg:px-8"><span>Wareflow <b className="mx-1 text-[#c1c5b9] dark:text-[#586559]">·</b> Inventory operations, made clear.</span><span className="flex items-center gap-2">API connected <i className="size-1.5 rounded-full bg-[#79945a]" /></span></footer>
      </main>
    </div>
  );
}
