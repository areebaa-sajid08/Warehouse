import { useEffect } from "react";

export function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-heading">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
    {action && <div className="heading-action">{action}</div>}
  </div>;
}

export function Panel({ title, subtitle, action, children, className = "" }) {
  return <section className={`panel ${className}`}>
    {(title || action) && <div className="panel-heading"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{action}</div>}
    {children}
  </section>;
}

export function Button({ children, variant = "primary", ...props }) {
  return <button className={`button button-${variant}`} {...props}>{children}</button>;
}

export function Field({ label, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}

export function SelectField({ label, options, ...props }) {
  return <label className="field"><span>{label}</span><select {...props}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

export function Notice({ message, type = "error", onClose }) {
  if (!message) return null;
  return <div className={`notice notice-${type}`} role="status">{message}{onClose && <button onClick={onClose} aria-label="Dismiss">×</button>}</div>;
}

export function EmptyState({ title = "Nothing here yet", children }) {
  return <div className="empty-state"><span className="empty-icon">◇</span><strong>{title}</strong><span>{children}</span></div>;
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div>
      {children}
    </section>
  </div>;
}

export function LoadingState({ label = "Loading data" }) {
  return <div className="loading-state" role="status" aria-live="polite" aria-label={label}>
    <span className="brand-mark loading-logo" aria-hidden="true">W</span>
  </div>;
}

export function StatusBadge({ children }) {
  return <span className={`status-badge status-${String(children).toLowerCase().replace(/\s+/g, "-")}`}>{children}</span>;
}
