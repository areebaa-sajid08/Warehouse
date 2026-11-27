import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { apiRequest } from "../lib/api.js";

const toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 4200,
  timerProgressBar: true,
  background: "#fbfaf5",
  color: "#202820",
});

export default function NotificationCenter({ token }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [deletingIds, setDeletingIds] = useState(() => new Set());
  const knownIds = useRef(new Set());
  const firstLoad = useRef(true);
  const containerRef = useRef(null);

  const refresh = useCallback(async () => {
    const result = await apiRequest(`/notifications?page=${page}&limit=25`, { token });
    const incoming = result.notifications || [];
    if (firstLoad.current) {
      firstLoad.current = false;
      knownIds.current = new Set(incoming.map((notification) => notification._id));
    } else {
      const newItems = incoming.filter((notification) => !knownIds.current.has(notification._id));
      incoming.forEach((notification) => knownIds.current.add(notification._id));
      const latest = newItems[0];
      if (latest) toast.fire({ icon: "info", title: latest.title, text: latest.message });
    }
    setNotifications(incoming);
    setUnreadCount(result.unreadCount || 0);
    setPagination(result.pagination || { page: 1, pages: 1 });
    if (result.pagination?.page && result.pagination.page !== page) setPage(result.pagination.page);
    setError("");
  }, [page, token]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await refresh();
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    };
    load();
    const timerId = window.setInterval(load, 15000);
    return () => {
      active = false;
      window.clearInterval(timerId);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const markAllRead = async () => {
    try {
      await apiRequest("/notifications/read", { token, method: "PATCH" });
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
      setError("");
    } catch (readError) {
      setError(readError.message);
    }
  };

  const deleteNotification = async (notificationId) => {
    setDeletingIds((ids) => new Set(ids).add(notificationId));
    try {
      await apiRequest(`/notifications/${notificationId}`, { token, method: "DELETE" });
      await refresh();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingIds((ids) => {
        const nextIds = new Set(ids);
        nextIds.delete(notificationId);
        return nextIds;
      });
    }
  };

  const navigatePage = (nextPage) => {
    firstLoad.current = true;
    setPage(nextPage);
  };

  return <div className="relative" ref={containerRef}>
    <button className="relative grid size-9 place-items-center rounded-md border border-[#dfe1d6] bg-[#fffefa] text-base text-[#475542] hover:bg-[#f1f2eb] dark:border-[#414b3f] dark:bg-[#202820] dark:text-[#d4decf] dark:hover:bg-[#2c362c]" type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span aria-hidden="true">♧</span>
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#b75b48] px-1 text-[9px] font-bold leading-none text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <section className="absolute right-0 top-11 z-40 w-[min(90vw,24rem)] overflow-hidden rounded-xl border border-[#dedfd4] bg-[#fbfaf5] shadow-xl dark:border-[#414b3f] dark:bg-[#1d251e]" aria-label="Notifications">
      <header className="flex items-center justify-between gap-3 border-b border-[#e9e9e0] px-4 py-3 dark:border-[#394339]">
        <div><h2 className="text-sm font-semibold text-[#303e30] dark:text-[#e3e9de]">Notifications</h2><p className="mt-0.5 text-[10px] text-[#858e82] dark:text-[#a0ad9d]">{unreadCount ? `${unreadCount} unread` : "You're all caught up"}</p></div>
        <div className="flex items-center gap-2"><button className="text-[10px] font-semibold text-[#4b6337] hover:underline dark:text-[#c4dd9d]" type="button" onClick={() => refresh().catch((refreshError) => setError(refreshError.message))}>Refresh</button>{unreadCount > 0 && <button className="text-[10px] font-semibold text-[#4b6337] hover:underline dark:text-[#c4dd9d]" type="button" onClick={markAllRead}>Mark all read</button>}<button className="grid size-6 place-items-center rounded text-lg leading-none text-[#78866a] hover:bg-[#eff0e9] dark:text-[#aab8a4] dark:hover:bg-[#303830]" type="button" onClick={() => setOpen(false)} aria-label="Close notifications">×</button></div>
      </header>
      {error && <p className="border-b border-[#eed2c9] bg-[#f8ebe6] px-4 py-2 text-[10px] text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]" role="alert">{error}</p>}
      <div className="max-h-[min(65vh,28rem)] overflow-y-auto">
        {notifications.length ? notifications.map((notification) => <article className={`border-b border-[#e9e9e0] px-4 py-3 last:border-0 dark:border-[#394339] ${notification.read ? "" : "bg-[#f3f5eb] dark:bg-[#252f25]"}`} key={notification._id}>
          <div className="flex items-start gap-2"><span className="mt-0.5 size-2 shrink-0 rounded-full bg-[#8da85b]" aria-hidden="true" /><div className="min-w-0 flex-1"><h3 className="text-xs font-semibold text-[#3d4c41] dark:text-[#e0e7dc]">{notification.title}</h3><p className="mt-1 text-[11px] leading-relaxed text-[#737d70] dark:text-[#aeb9aa]">{notification.message}</p><p className="mt-1.5 text-[9px] text-[#92998e] dark:text-[#899789]">{notification.actor?.name || "Wareflow"} · {new Date(notification.createdAt).toLocaleString()}</p></div><button className="grid size-6 shrink-0 place-items-center rounded text-base leading-none text-[#78866a] hover:bg-[#eff0e9] disabled:opacity-40 dark:text-[#aab8a4] dark:hover:bg-[#303830]" type="button" aria-label={`Delete notification: ${notification.title}`} title="Delete notification" disabled={deletingIds.has(notification._id)} onClick={() => deleteNotification(notification._id)}>×</button></div>
        </article>) : <p className="px-4 py-8 text-center text-xs text-[#858e82] dark:text-[#a0ad9d]">No activity notifications yet.</p>}
      </div>
      {pagination.pages > 1 && <footer className="flex items-center justify-between border-t border-[#e9e9e0] px-4 py-2 text-[10px] text-[#858e82] dark:border-[#394339] dark:text-[#a0ad9d]">
        <button className="font-semibold text-[#4b6337] disabled:opacity-40 dark:text-[#c4dd9d]" type="button" disabled={page <= 1} onClick={() => navigatePage(Math.max(1, page - 1))}>Newer</button>
        <span>Page {pagination.page} of {pagination.pages}</span>
        <button className="font-semibold text-[#4b6337] disabled:opacity-40 dark:text-[#c4dd9d]" type="button" disabled={page >= pagination.pages} onClick={() => navigatePage(Math.min(pagination.pages, page + 1))}>Older</button>
      </footer>}
    </section>}
  </div>;
}
