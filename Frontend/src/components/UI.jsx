import { useEffect } from "react";

export function PageHeader({ eyebrow, title, description, action }) {
  return <div className="mb-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      <div className="mb-2 text-[10px] font-bold tracking-[0.18em] text-[#78866a]">{eyebrow}</div>
      <h1 className="text-3xl font-semibold tracking-[-0.06em] text-[#202820] sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-[#737d70]">{description}</p>
    </div>
    {action && <div className="flex items-center">{action}</div>}
  </div>;
}

export function Panel({ title, subtitle, action, children, className = "" }) {
  return <section className={`min-w-0 overflow-hidden rounded-xl border border-[#dedfd4] bg-[#fbfaf5] shadow-sm ${className}`}>
    {(title || action) && <div className="flex flex-col justify-between gap-3 border-b border-[#e9e9e0] px-5 py-4 sm:flex-row sm:items-center">
      <div>{title && <h2 className="text-sm font-semibold text-[#303e30]">{title}</h2>}{subtitle && <p className="mt-1 text-xs text-[#858e82]">{subtitle}</p>}</div>
      {action}
    </div>}
    {children}
  </section>;
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = variant === "secondary"
    ? "border border-[#d6dacd] bg-[#fbfaf5] text-[#334132] hover:bg-[#eef0e7]"
    : variant === "danger"
      ? "border border-[#a84d3e] bg-[#a84d3e] text-white hover:bg-[#873b30]"
      : "border border-[#1b261d] bg-[#1b261d] text-[#f8faef] hover:bg-[#344331]";
  return <button className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#849c53] disabled:cursor-wait disabled:opacity-60 ${styles} ${className}`} {...props}>{children}</button>;
}

export function Field({ label, className = "", ...props }) {
  return <label className={`grid gap-1.5 text-xs font-semibold text-[#455141] ${className}`}>
    <span>{label}</span>
    <input className="h-10 w-full rounded-md border border-[#d8dacf] bg-[#fffefa] px-3 text-sm font-normal text-[#34443a] outline-none transition focus:border-[#80964f] focus:ring-4 focus:ring-[#8ea851]/15 placeholder:text-[#a6aa9f]" {...props} />
  </label>;
}

export function SelectField({ label, options, className = "", ...props }) {
  return <label className={`grid gap-1.5 text-xs font-semibold text-[#455141] ${className}`}>
    <span>{label}</span>
    <select className="h-10 w-full rounded-md border border-[#d8dacf] bg-[#fffefa] px-3 text-sm font-normal text-[#34443a] outline-none transition focus:border-[#80964f] focus:ring-4 focus:ring-[#8ea851]/15" {...props}>
      <option value="">Select {label.toLowerCase()}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

export function Notice({ message, type = "error", onClose }) {
  if (!message) return null;
  const palette = type === "success"
    ? "border-[#d5e1d3] bg-[#eaf1e9] text-[#3e7357]"
    : "border-[#eed2c9] bg-[#f8ebe6] text-[#9d5144]";
  return <div className={`mb-4 rounded-md border px-3 py-2.5 text-xs leading-relaxed ${palette}`} role="status">
    {message}{onClose && <button className="float-right ml-3 font-semibold" onClick={onClose} aria-label="Dismiss">×</button>}
  </div>;
}

export function EmptyState({ title = "Nothing here yet", children }) {
  return <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-5 py-8 text-center text-xs text-[#858e82]">
    <span className="mb-1 grid size-10 place-items-center rounded-lg bg-[#edf1e9] text-lg text-[#5b775c]">◇</span>
    <strong className="text-sm text-[#536256]">{title}</strong>
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
    <section className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#e3e3d9] bg-[#fbfaf5] p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-[#304137]">{title}</h2>
        <button className="grid size-8 shrink-0 place-items-center rounded-md bg-[#f0f0e9] text-xl text-[#667366] hover:bg-[#e8e9df]" onClick={onClose} aria-label="Close">×</button>
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
    : status === "processing" ? "bg-[#e8eee8] text-[#465e51]"
      : status === "completed" || status === "approved" ? "bg-[#eaf1e9] text-[#496544]"
        : status === "cancelled" || status === "rejected" ? "bg-[#f5e8e3] text-[#9c4e3e]"
          : "bg-[#eff0e9] text-[#6d786c]";
  return <span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-[10px] font-bold ${palette}`}>{children}</span>;
}
