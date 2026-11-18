import { useState } from "react";
import { API_URL, apiRequest } from "../lib/api.js";
import { Button, Field, Notice, SelectField } from "./UI.jsx";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "salesRepresentative" });
  const update = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest(`/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: mode === "login"
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password, role: form.role },
      });
      onAuthenticated({ token: result.token, user: result.user });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return <main className="auth-page">
    <div className="auth-decoration"><div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" /><div className="auth-decoration-copy"><span className="auth-kicker">OPERATIONS, IN SYNC</span><h2>Know your stock.<br />Move with confidence.</h2><p>One calm, connected workspace for your inventory and warehouse operations.</p><div className="auth-mini-card"><span className="mini-chart"><i /><i /><i /><i /><i /><i /><i /></span><span><b>Inventory health</b><small>Everything in its right place</small></span><strong>↗</strong></div></div></div>
    <div className="auth-main">
      <a className="brand auth-brand" href="#"><span className="brand-mark">W</span><span className="brand-copy"><strong>Wareflow</strong><small>INVENTORY PLATFORM</small></span></a>
      <div className="auth-form-wrap">
        <div className="eyebrow">WELCOME TO WAREFLOW</div>
        <h1>{mode === "login" ? "Good to see you." : "Create your account."}</h1>
        <p className="auth-subtitle">{mode === "login" ? "Enter your details to access your workspace." : "Join your team and get your workspace set up."}</p>
        <Notice message={error} />
        <form className="form-stack" onSubmit={submit}>
          {mode === "register" && <>
            <Field label="Full name" autoComplete="name" value={form.name} onChange={update("name")} required />
            <SelectField label="Your role" value={form.role} onChange={update("role")} options={[
              { value: "salesRepresentative", label: "Sales representative" },
              { value: "warehouseManager", label: "Warehouse manager" },
              { value: "supplier", label: "Supplier" },
            ]} />
          </>}
          <Field label="Email address" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={update("email")} required />
          <Field label="Password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Enter your password" minLength="8" value={form.password} onChange={update("password")} required />
          <Button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in to workspace" : "Create account"} <span>→</span></Button>
        </form>
        <div className="auth-toggle">{mode === "login" ? "New to Wareflow?" : "Already have an account?"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</button></div>
      </div>
      <div className="auth-footnote"><span><i /> Secure connection</span><span>Connected to {new URL(API_URL).hostname}</span></div>
    </div>
  </main>;
}
