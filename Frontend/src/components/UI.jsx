import { useEffect, useState } from "react";

export function PageHeader({ eyebrow, title, description, action }) {
  return <div className="mb-6 flex min-w-0 flex-col items-start justify-between gap-4 sm:mb-7 sm:flex-row sm:items-end">
    <div className="min-w-0">
      <div className="mb-2 text-[10px] font-bold tracking-[0.18em] text-[#78866a] dark:text-[#a7b69a]">{eyebrow}</div>
      <h1 className="break-words text-3xl font-semibold tracking-[-0.06em] text-[#202820] dark:text-[#e3e9de] sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#737d70] dark:text-[#a0ad9d]">{description}</p>
    </div>
    {action && <div className="flex w-full min-w-0 items-center sm:w-auto">{action}</div>}
  </div>;
}

export function Panel({ title, subtitle, action, children, className = "" }) {
  return <section className={`min-w-0 overflow-hidden rounded-xl border border-[#dedfd4] bg-[#fbfaf5] shadow-sm dark:border-[#303a30] dark:bg-[#1a211b] ${className}`}>
    {(title || action) && <div className="flex min-w-0 flex-col justify-between gap-3 border-b border-[#e9e9e0] px-3 py-4 dark:border-[#303a30] sm:px-5 sm:flex-row sm:items-center">
      <div className="min-w-0">{title && <h2 className="text-sm font-semibold text-[#303e30] dark:text-[#e0e7dc]">{title}</h2>}{subtitle && <p className="mt-1 text-xs text-[#858e82] dark:text-[#9ba998]">{subtitle}</p>}</div>
      {action && <div className="w-full min-w-0 sm:w-auto">{action}</div>}
    </div>}
    {children}
  </section>;
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = variant === "secondary"
    ? "border border-[#d6dacd] bg-[#fbfaf5] text-[#334132] hover:bg-[#eef0e7] dark:border-[#465143] dark:bg-[#222b23] dark:text-[#dbe4d6] dark:hover:bg-[#2c362d]"
    : variant === "danger"
      ? "border border-[#a84d3e] bg-[#a84d3e] text-white hover:bg-[#873b30]"
      : "border border-[#1b261d] bg-[#1b261d] text-[#f8faef] hover:bg-[#344331]";
  return <button className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#849c53] disabled:cursor-wait disabled:opacity-60 ${styles} ${className}`} {...props}>{children}</button>;
}

export function Field({ label, className = "", ...props }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = props.type === "password";
  const input = <input
    className={`h-10 w-full rounded-md border border-[#d8dacf] bg-[#fffefa] px-3 text-sm font-normal text-[#34443a] outline-none transition focus:border-[#80964f] focus:ring-4 focus:ring-[#8ea851]/15 placeholder:text-[#a6aa9f] dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc] dark:placeholder:text-[#788677] ${isPassword ? "pr-10" : ""}`}
    {...props}
    type={isPassword && passwordVisible ? "text" : props.type}
  />;
  return <label className={`grid gap-1.5 text-xs font-semibold text-[#455141] dark:text-[#c7d2c2] ${className}`}>
    <span>{label}</span>
    {isPassword
      ? <span className="relative block">
        {input}
        <button
          className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-[#788273] hover:text-[#34443a] focus-visible:outline-2 focus-visible:outline-[#849c53] dark:text-[#a0ad9d] dark:hover:text-[#e0e7dc]"
          type="button"
          aria-label={passwordVisible ? "Hide password" : "Show password"}
          aria-pressed={passwordVisible}
          onClick={() => setPasswordVisible((visible) => !visible)}
        >
          {passwordVisible
            ? <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.5 0 9 7 9 7a15.7 15.7 0 0 1-3.1 3.9" /><path d="M6.2 6.2C3.9 7.8 3 12 3 12s3.5 7 9 7a9.9 9.9 0 0 0 3-.5" /></svg>
            : <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>}
        </button>
      </span>
      : input}
  </label>;
}

export function SelectField({ label, options, className = "", ...props }) {
  return <label className={`grid gap-1.5 text-xs font-semibold text-[#455141] dark:text-[#c7d2c2] ${className}`}>
    <span>{label}</span>
    <select className="h-10 w-full rounded-md border border-[#d8dacf] bg-[#fffefa] px-3 text-sm font-normal text-[#34443a] outline-none transition focus:border-[#80964f] focus:ring-4 focus:ring-[#8ea851]/15 dark:border-[#465143] dark:bg-[#202820] dark:text-[#e0e7dc]" {...props}>
      <option value="">Select {label.toLowerCase()}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

export function Notice({ message, type = "error", onClose }) {
  if (!message) return null;
  const palette = type === "success"
    ? "border-[#d5e1d3] bg-[#eaf1e9] text-[#3e7357] dark:border-[#3e5a44] dark:bg-[#243629] dark:text-[#b2d8af]"
    : "border-[#eed2c9] bg-[#f8ebe6] text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]";
  return <div className={`mb-4 rounded-md border px-3 py-2.5 text-xs leading-relaxed ${palette}`} role="status">
    {message}{onClose && <button className="float-right ml-3 font-semibold" onClick={onClose} aria-label="Dismiss">×</button>}
  </div>;
}

export function EmptyState({ title = "Nothing here yet", children }) {
  return <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-5 py-8 text-center text-xs text-[#858e82] dark:text-[#9ba998]">
    <span className="mb-1 grid size-10 place-items-center rounded-lg bg-[#edf1e9] text-lg text-[#5b775c] dark:bg-[#2b352b] dark:text-[#c4dd9d]">◇</span>
    <strong className="text-sm text-[#536256] dark:text-[#c4d1c1]">{title}</strong>
    <span>{children}</span>
  </div>;
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#111811]/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#e3e3d9] bg-[#fbfaf5] p-5 shadow-2xl dark:border-[#3c473b] dark:bg-[#1a211b] sm:p-7" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-[#304137] dark:text-[#e0e7dc]">{title}</h2>
        <button className="grid size-8 shrink-0 place-items-center rounded-md bg-[#f0f0e9] text-xl text-[#667366] hover:bg-[#e8e9df] dark:bg-[#2c362c] dark:text-[#b7c3b3] dark:hover:bg-[#384438]" onClick={onClose} aria-label="Close">×</button>
      </div>
      {children}
    </section>
  </div>;
}

export function LoadingState({ label = "Loading data" }) {
  return <div className="grid min-h-40 place-items-center" role="status" aria-live="polite" aria-label={label}>
    <span className="grid size-10 animate-pulse place-items-center rounded-lg bg-[#c9ef6b] text-lg font-extrabold text-[#172019]" aria-hidden="true">W</span>
  </div>;
}

export function StatusBadge({ children }) {
  const status = String(children).toLowerCase();
  const palette = status === "pending" ? "bg-[#f3eddd] text-[#85602e]"
    : status === "processing" ? "bg-[#e8eee8] text-[#465e51] dark:bg-[#2a382d] dark:text-[#b7d0b6]"
      : status === "completed" || status === "approved" ? "bg-[#eaf1e9] text-[#496544] dark:bg-[#26372a] dark:text-[#b2d8af]"
        : status === "cancelled" || status === "rejected" ? "bg-[#f5e8e3] text-[#9c4e3e] dark:bg-[#3a2a27] dark:text-[#e3a79a]"
          : "bg-[#eff0e9] text-[#6d786c] dark:bg-[#303830] dark:text-[#b3bdb0]";
  return <span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-[10px] font-bold ${palette}`}>{children}</span>;
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const buttonClass = "rounded-md border border-[#d6dacd] bg-[#fbfaf5] px-3 py-2 text-[10px] font-semibold text-[#334132] hover:bg-[#eef0e7] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#465143] dark:bg-[#222b23] dark:text-[#dbe4d6] dark:hover:bg-[#2c362d]";
  return <div className="flex items-center justify-between gap-3 border-t border-[#e9e9e0] px-4 py-3 dark:border-[#303a30]">
    <span className="text-[10px] text-[#858e82] dark:text-[#9ba998]">Showing {start}–{end} of {total}</span>
    <div className="flex items-center gap-2">
      <button className={buttonClass} type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="text-[10px] text-[#667261] dark:text-[#aab8a4]">{page} / {pageCount}</span>
      <button className={buttonClass} type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  </div>;
}
