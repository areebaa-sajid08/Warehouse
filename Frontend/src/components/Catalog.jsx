import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { confirmAction, showError, showSuccess } from "../lib/alerts.js";
import { uploadProductImage, validateProductImage } from "../lib/imageUpload.js";
import { useLoad } from "../lib/useLoad.js";
import { formatCurrency } from "../lib/format.js";
import { Button, EmptyState, Field, LoadingState, Modal, PageHeader, Panel, SelectField } from "./UI.jsx";

const config = {
  products: { title: "Products", eyebrow: "CATALOG", description: "Manage the products and pricing in your inventory.", endpoint: "/products", createRoles: ["admin", "warehouseManager"] },
  warehouses: { title: "Warehouses", eyebrow: "LOCATIONS", description: "View and manage your warehouse locations.", endpoint: "/warehouses", createRoles: ["admin"] },
  users: { title: "Team", eyebrow: "PEOPLE & ACCESS", description: "Manage workspace accounts and their roles.", endpoint: "/users", createRoles: ["admin"] },
};

const roles = [
  { value: "admin", label: "Administrator" },
  { value: "warehouseManager", label: "Warehouse manager" },
  { value: "supplier", label: "Supplier" },
  { value: "salesRepresentative", label: "Sales representative" },
];

export default function Catalog({ type, token, user }) {
  const definition = config[type];
  const [dialog, setDialog] = useState(false);
  const [formError, setFormError] = useState("");
  const [imageError, setImageError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    const result = await apiRequest(definition.endpoint, { token });
    return result[type] || [];
  }, [definition.endpoint, token, type]);
  const { data = [], loading, error, reload } = useLoad(load);
  const canCreate = definition.createRoles.includes(user.role);
  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((item) => {
      const values = type === "products"
        ? [item.name, item.sku, item.category, item.description, item.supplier?.name]
        : type === "warehouses"
          ? [item.name, item.location, item.manager?.name]
          : [item.name, item.email, item.role];
      return values.some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [data, search, type]);
  const change = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const previewUrl = useMemo(() => form.imageFile ? URL.createObjectURL(form.imageFile) : "", [form.imageFile]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const openNew = () => { setForm({}); setFormError(""); setImageError(""); setDialog(true); };
  const closeDialog = () => { setDialog(false); setForm({}); setImageError(""); };

  const submit = async (event) => {
    event.preventDefault();
    if (imageError) {
      setFormError(imageError);
      await showError(imageError);
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      let body;
      if (type === "products") {
        const { imageFile, ...fields } = form;
        body = { ...fields, price: Number(form.price), lowStockLimit: Number(form.lowStockLimit) };
        if (imageFile) Object.assign(body, await uploadProductImage(imageFile, token));
      } else if (type === "warehouses") body = { ...form, capacity: Number(form.capacity) };
      else body = form;
      await apiRequest(definition.endpoint, { token, method: "POST", body });
      closeDialog();
      await reload();
      await showSuccess(`${definition.title.slice(0, -1)} added`);
    } catch (err) {
      setFormError(err.message);
      await showError(err.message);
    } finally { setBusy(false); }
  };

  const chooseImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateProductImage(file);
    if (validationError) {
      setFormError(validationError);
      setImageError(validationError);
      setForm((value) => ({ ...value, imageFile: null }));
      event.target.value = "";
      showError(validationError);
      return;
    }
    setFormError("");
    setImageError("");
    setForm((value) => ({ ...value, imageFile: file }));
  };

  const remove = async (item) => {
    const label = item.name || item.email || "this record";
    const confirmation = await confirmAction({ title: `Delete ${label}?`, text: "This action cannot be undone.", confirmText: "Delete", icon: "warning" });
    if (!confirmation.isConfirmed) return;
    try {
      await apiRequest(`${definition.endpoint}/${item._id}`, { token, method: "DELETE" });
      await reload();
      await showSuccess("Record deleted");
    } catch (err) { await showError(err.message); }
  };

  return <>
    <PageHeader eyebrow={definition.eyebrow} title={definition.title} description={definition.description} action={canCreate && <Button onClick={openNew}>＋ {type === "products" ? "Add product" : type === "warehouses" ? "Add warehouse" : "Add team member"}</Button>} />
    {error && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-4 py-3 text-xs text-[#9d5144]">{error}</div>}
    {loading ? <LoadingState /> : <Panel title={`All ${definition.title.toLowerCase()}`} subtitle={`${filteredData.length} of ${data.length} records`} action={<label className="flex w-full items-center gap-2 rounded-md border border-[#dfe1d6] bg-[#fffefa] px-3 text-[#78866a] focus-within:ring-4 focus-within:ring-[#9ab75c]/15 sm:w-64"><span className="text-base">⌕</span><input className="h-9 w-full min-w-0 bg-transparent text-xs text-[#344132] outline-none placeholder:text-[#939b8e]" type="search" placeholder={`Search ${definition.title.toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} /></label>}>
      {!filteredData.length ? <EmptyState title={data.length ? "No matching records" : `No ${definition.title.toLowerCase()} yet`}>{data.length ? "Try a different search term." : canCreate ? "Add your first record to get started." : "Records will appear here when available."}</EmptyState> : <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
        {type === "products" ? <>
          <thead className="bg-[#f0f0e8] text-[10px] uppercase tracking-wider text-[#667261]"><tr>{["Product", "SKU", "Category", "Price", "Reorder point", "Supplier", ...(canCreate ? [""] : [])].map((item, index) => <th className="whitespace-nowrap border-b border-[#e1e2d7] px-4 py-3 font-bold" key={`${item}-${index}`}>{item}</th>)}</tr></thead>
          <tbody>{filteredData.map((item) => <tr className="border-b border-[#e9e9e0] text-xs text-[#68756a] last:border-0 hover:bg-[#f7f7f0]" key={item._id}>
            <td className="px-4 py-3"><div className="flex min-w-40 items-center gap-3">{item.imageUrl ? <img className="size-9 shrink-0 rounded-md bg-[#edf1e9] object-cover" src={item.imageUrl} alt="" /> : <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#edf1e9] text-xs font-bold uppercase text-[#31432d]">{item.name?.slice(0, 1)}</span>}<span className="min-w-0"><strong className="block truncate font-semibold text-[#3d4c41]">{item.name}</strong><small className="mt-1 block max-w-48 truncate text-[10px] text-[#929b90]">{item.description || "No description"}</small></span></div></td>
            <td className="px-4 py-3 font-mono">{item.sku}</td><td className="px-4 py-3">{item.category || "—"}</td><td className="px-4 py-3 font-bold text-[#34443a]">{formatCurrency(item.price)}</td><td className="px-4 py-3">{item.lowStockLimit}</td><td className="px-4 py-3">{item.supplier?.name || "—"}</td>
            {canCreate && <td className="px-4 py-3"><button className="text-[10px] font-bold text-[#b96050] hover:underline" onClick={() => remove(item)} title="Delete product">Delete</button></td>}
          </tr>)}</tbody>
        </> : type === "warehouses" ? <>
          <thead className="bg-[#f0f0e8] text-[10px] uppercase tracking-wider text-[#667261]"><tr>{["Warehouse", "Location", "Manager", "Capacity", ...(user.role === "admin" ? [""] : [])].map((item, index) => <th className="whitespace-nowrap border-b border-[#e1e2d7] px-4 py-3 font-bold" key={`${item}-${index}`}>{item}</th>)}</tr></thead>
          <tbody>{filteredData.map((item) => <tr className="border-b border-[#e9e9e0] text-xs text-[#68756a] last:border-0 hover:bg-[#f7f7f0]" key={item._id}><td className="px-4 py-3"><div className="flex min-w-40 items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-[#edf1e9] text-sm text-[#557357]">▤</span><strong className="font-semibold text-[#3d4c41]">{item.name}</strong></div></td><td className="px-4 py-3">{item.location}</td><td className="px-4 py-3">{item.manager?.name || "Unassigned"}</td><td className="px-4 py-3">{Number(item.capacity).toLocaleString()} units</td>{user.role === "admin" && <td className="px-4 py-3"><button className="text-[10px] font-bold text-[#b96050] hover:underline" onClick={() => remove(item)}>Delete</button></td>}</tr>)}</tbody>
        </> : <>
          <thead className="bg-[#f0f0e8] text-[10px] uppercase tracking-wider text-[#667261]"><tr>{["Member", "Email", "Role", "Warehouses", "Joined", ""].map((item, index) => <th className="whitespace-nowrap border-b border-[#e1e2d7] px-4 py-3 font-bold" key={`${item}-${index}`}>{item}</th>)}</tr></thead>
          <tbody>{filteredData.map((item) => {
            const isCurrentUser = String(item._id) === String(user._id || user.id);
            return <tr className="border-b border-[#e9e9e0] text-xs text-[#68756a] last:border-0 hover:bg-[#f7f7f0]" key={item._id}><td className="px-4 py-3"><div className="flex min-w-36 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#d9e3d6] text-xs font-bold text-[#203d32]">{(item.name || item.email).slice(0, 1).toUpperCase()}</span><strong className="font-semibold text-[#3d4c41]">{item.name}{isCurrentUser && <span className="ml-2 rounded bg-[#edf2e3] px-1.5 py-1 text-[9px] font-semibold text-[#3e5736]">You</span>}</strong></div></td><td className="px-4 py-3">{item.email}</td><td className="px-4 py-3"><span className="rounded bg-[#edf2e3] px-2 py-1 text-[10px] text-[#3e5736]">{roleLabel(item.role)}</span></td><td className="px-4 py-3">{item.assignedWarehouses?.length || "—"}</td><td className="px-4 py-3">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}</td><td className="px-4 py-3">{isCurrentUser ? <span className="text-[10px] text-[#929b90]" title="You cannot delete your own account">Current account</span> : <button className="text-[10px] font-bold text-[#b96050] hover:underline" onClick={() => remove(item)}>Delete</button>}</td></tr>;
          })}</tbody>
        </>}
      </table></div>}
    </Panel>}
    {dialog && <Modal title={type === "products" ? "Add a product" : type === "warehouses" ? "Add a warehouse" : "Add a team member"} onClose={closeDialog}>
      {formError && <div className="mb-4 rounded-md border border-[#eed2c9] bg-[#f8ebe6] px-3 py-2.5 text-xs text-[#9d5144]">{formError}</div>}
      <form className="grid gap-4" onSubmit={submit}>
        {type === "products" ? <>
          <Field label="Product name" value={form.name || ""} onChange={change("name")} required />
          <div className="grid gap-3 sm:grid-cols-2"><Field label="SKU" value={form.sku || ""} onChange={change("sku")} required /><Field label="Category" value={form.category || ""} onChange={change("category")} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Price" type="number" min="0" step="0.01" value={form.price || ""} onChange={change("price")} required /><Field label="Reorder point" type="number" min="0" step="1" value={form.lowStockLimit || ""} onChange={change("lowStockLimit")} required /></div>
          <Field label="Description" value={form.description || ""} onChange={change("description")} />
          <label className="grid gap-1.5 text-xs font-semibold text-[#455141]"><span>Product image <small className="ml-1 font-normal text-[#999f94]">Optional</small></span><input className="w-full rounded-md border border-[#d8dacf] bg-[#fffefa] p-2 text-xs" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} /><small className="text-[10px] font-normal text-[#92998e]">JPEG, PNG, or WEBP · max 5 MB · requires backend ImageKit credentials.</small></label>
          {previewUrl && <div className="flex items-center gap-3 rounded-md border border-[#e3e3d9] bg-[#faf9f3] p-2"><img className="size-11 rounded object-cover" src={previewUrl} alt="Product preview" /><span className="min-w-0 flex-1 truncate text-xs text-[#707d71]">{form.imageFile.name}</span><button type="button" className="text-[10px] font-bold text-[#b96050]" onClick={() => setForm((value) => ({ ...value, imageFile: null }))}>Remove</button></div>}
        </> : type === "warehouses" ? <>
          <Field label="Warehouse name" value={form.name || ""} onChange={change("name")} required /><Field label="Location" value={form.location || ""} onChange={change("location")} required /><Field label="Capacity (units)" type="number" min="0" value={form.capacity || ""} onChange={change("capacity")} required />
        </> : <>
          <Field label="Full name" value={form.name || ""} onChange={change("name")} required /><Field label="Email address" type="email" value={form.email || ""} onChange={change("email")} required /><Field label="Temporary password" type="password" minLength="8" value={form.password || ""} onChange={change("password")} required /><SelectField label="Role" value={form.role || ""} onChange={change("role")} options={roles} required />
        </>}
        <div className="mt-1 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : "Save record"}</Button></div>
      </form>
    </Modal>}
  </>;
}

function roleLabel(role) {
  return ({ admin: "Admin", warehouseManager: "Warehouse manager", supplier: "Supplier", salesRepresentative: "Sales" })[role] || role;
}
