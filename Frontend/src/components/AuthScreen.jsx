import { useState } from "react";
import { apiRequest } from "../lib/api.js";
import { showError } from "../lib/alerts.js";
import { Button, Field, SelectField } from "./UI.jsx";
import WarehouseScene from "./WarehouseScene.jsx";

export default function AuthScreen({ onAuthenticated, theme, onToggleTheme }) {
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
      onAuthenticated({ user: result.user });
    } catch (err) {
      setError(err.message);
      await showError(err.message);
    } finally { setBusy(false); }
  };

  return <main className="grid min-h-dvh bg-[#fbfaf5] dark:bg-[#111711] lg:grid-cols-[.96fr_1.04fr]">
    <div className="relative flex min-h-0 flex-col overflow-hidden bg-[#171e18] px-4 py-4 text-white sm:px-8 lg:min-h-screen lg:px-12 lg:py-7">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,transparent_95%,#ffffff0a_96%),linear-gradient(90deg,transparent_95%,#ffffff0a_96%)] bg-[size:48px_48px] opacity-40" />
      <a className="relative z-10 mb-3 flex items-center gap-3 lg:mb-0" href="#">
        <span className="grid size-10 place-items-center rounded-md bg-[#c9ef6b] text-lg font-extrabold text-[#172019]">W</span>
        <span className="grid gap-0.5"><strong className="text-base font-bold">Wareflow</strong><small className="text-[8px] font-semibold tracking-[.16em] text-[#a7b09d]">INVENTORY PLATFORM</small></span>
      </a>
      <div className="relative z-10 mx-auto hidden w-full max-w-3xl flex-1 items-center gap-1 sm:grid-cols-[.8fr_1.2fr] lg:my-auto lg:grid">
        <div className="py-2">
          <span className="text-[8px] font-bold tracking-[.18em] text-[#c9ef6b]">WAREHOUSE OPERATIONS, MADE VISIBLE</span>
          <h2 className="my-3 text-3xl font-semibold leading-[1.08] tracking-[-.06em] text-[#f7f8f0] sm:text-4xl">Move goods.<br />Not guesswork.</h2>
          <p className="max-w-xs text-xs leading-relaxed text-[#abb5a7]">From the receiving dock to the final order, keep every item accounted for.</p>
        </div>
        <WarehouseScene />
      </div>
    </div>
    <div className="relative flex min-h-[490px] flex-col justify-center px-4 pb-16 pt-12 sm:px-8 lg:min-h-screen lg:px-16 lg:pt-8 xl:px-28">
      <div className="absolute left-6 right-6 top-5 flex items-center justify-between gap-3 text-[8px] font-bold tracking-[.12em] text-[#798273] sm:left-10 sm:right-10 lg:left-16 lg:right-16 lg:top-8 xl:left-28 xl:right-28">
        <span className="flex items-center gap-2">WAREFLOW <i className="size-1 rounded-full bg-[#a0b56d]" /> INVENTORY PLATFORM</span>
        <div className="flex items-center gap-3"><span className="hidden text-right text-[#a0a797] sm:inline">BUILT FOR REAL-WORLD OPERATIONS</span><button className="grid size-9 place-items-center rounded-md border border-[#dfe1d6] bg-[#fffefa] text-sm text-[#475542] hover:bg-[#f1f2eb] dark:border-[#414b3f] dark:bg-[#202820] dark:text-[#d4decf] dark:hover:bg-[#2c362c]" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{theme === "dark" ? "☀" : "☾"}</button></div>
      </div>
      <div className="mx-auto w-full max-w-md py-8 sm:py-10">
        <div className="mb-2 text-[10px] font-bold tracking-[.18em] text-[#71805f]">{mode === "login" ? "YOUR WORKSPACE IS READY" : "SET UP YOUR ACCESS"}</div>
        <h1 className="text-3xl font-semibold tracking-[-.06em] text-[#20291f] dark:text-[#e3e9de] sm:text-4xl">{mode === "login" ? "Welcome back." : "Join your team."}</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-[#788273] dark:text-[#a0ad9d]">{mode === "login" ? "Enter your details to access your workspace." : "Join your team and get your workspace set up."}</p>
        {error && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-3 py-2.5 text-xs text-[#9d5144] dark:border-[#67473e] dark:bg-[#382a27] dark:text-[#e3a79a]" role="alert">{error}</div>}
        <form className="grid gap-4" onSubmit={submit}>
          {mode === "register" && <>
            <Field label="Full name" autoComplete="name" value={form.name} onChange={update("name")} required />
            <SelectField label="Your role" value={form.role} onChange={update("role")} options={[
              { value: "salesRepresentative", label: "Sales representative" },
              { value: "supplier", label: "Supplier" },
            ]} />
          </>}
          <Field label="Email address" type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={update("email")} required />
          <Field label="Password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Enter your password" minLength="8" value={form.password} onChange={update("password")} required />
          <Button type="submit" disabled={busy} className="w-full justify-between px-4 py-3">{busy ? "Please wait…" : mode === "login" ? "Sign in to workspace" : "Create account"} <span className="text-base text-[#c9ef6b]">→</span></Button>
        </form>
        <div className="mt-5 text-center text-xs text-[#788273] dark:text-[#a0ad9d]">{mode === "login" ? "New to Wareflow?" : "Already have an account?"} <button className="font-bold text-[#526d3e] hover:underline dark:text-[#c4dd9d]" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</button></div>
      </div>
      <div className="absolute bottom-4 left-6 right-6 flex justify-between border-t border-[#e6e6db] pt-3 text-[8px] tracking-wide text-[#8d9587] dark:border-[#303a30] dark:text-[#929f90] sm:left-10 sm:right-10 lg:left-16 lg:right-16 xl:left-28 xl:right-28"><span className="flex items-center gap-2"><i className="size-1.5 rounded-full bg-[#789477]" /> Secure sign-in</span><span>WAREFLOW · INVENTORY OPERATIONS</span></div>
    </div>
  </main>;
}
