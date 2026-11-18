import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { uploadProductImage, validateProductImage } from "../lib/imageUpload.js";
import { Button, EmptyState, Field, LoadingState, Modal, Notice, PageHeader, Panel, SelectField } from "./UI.jsx";
import { useLoad } from "../lib/useLoad.js";
import { formatCurrency } from "../lib/format.js";

const config = {
  products: { title: "Products", eyebrow: "CATALOG", description: "Manage the products and pricing in your inventory.", endpoint: "/products", createRoles: ["admin", "warehouseManager"] },
  warehouses: { title: "Warehouses", eyebrow: "LOCATIONS", description: "View and manage your warehouse locations.", endpoint: "/warehouses", createRoles: ["admin"] },
  users: { title: "Team", eyebrow: "PEOPLE & ACCESS", description: "Manage workspace accounts and their roles.", endpoint: "/users", createRoles: ["admin"] },
};

export default function Catalog({ type, token, user }) {
  const definition = config[type];
  const [dialog, setDialog] = useState(false);
  const [formError, setFormError] = useState("");
  const [imageError, setImageError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  const load = useCallback(async () => {
    const result = await apiRequest(definition.endpoint, { token });
    const key = type === "users" ? "users" : type;
    return result[key] || [];
  }, [definition.endpoint, token, type]);
  const { data = [], loading, error, reload } = useLoad(load);
  const canCreate = definition.createRoles.includes(user.role);
  const change = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const previewUrl = useMemo(() => form.imageFile ? URL.createObjectURL(form.imageFile) : "", [form.imageFile]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  const openNew = () => { setForm({}); setFormError(""); setImageError(""); setDialog(true); };
  const closeDialog = () => { setDialog(false); setForm({}); setImageError(""); };

  const submit = async (event) => {
    event.preventDefault();
    if (imageError) {
      setFormError(imageError);
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
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
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
      return;
    }
    setFormError("");
    setImageError("");
    setForm((value) => ({ ...value, imageFile: file }));
  };

  const remove = async (item) => {
    const label = item.name || item.email || "this record";
    if (!window.confirm(`Delete ${label}? This action cannot be undone.`)) return;
    try {
      await apiRequest(`${definition.endpoint}/${item._id}`, { token, method: "DELETE" });
      await reload();
    } catch (err) { window.alert(err.message); }
  };

  return <>
    <PageHeader eyebrow={definition.eyebrow} title={definition.title} description={definition.description} action={canCreate && <Button onClick={openNew}>＋ {type === "products" ? "Add product" : type === "warehouses" ? "Add warehouse" : "Add team member"}</Button>} />
    <Notice message={error} />
    {loading ? <LoadingState /> : <Panel className="table-panel" title={`All ${definition.title.toLowerCase()}`} subtitle={`${data.length} records`}>
      {!data.length ? <EmptyState title={`No ${definition.title.toLowerCase()} yet`}>{canCreate ? "Add your first record to get started." : "Records will appear here when available."}</EmptyState> : <div className="table-wrap"><table>
        {type === "products" ? <>
          <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Reorder point</th><th>Supplier</th>{canCreate && <th />}</tr></thead>
          <tbody>{data.map((item) => <tr key={item._id}>
            <td><div className="table-product">{item.imageUrl ? <img className="product-thumbnail" src={item.imageUrl} alt="" /> : <span className="product-placeholder">{item.name?.slice(0, 1)}</span>}<span><strong>{item.name}</strong><small>{item.description || "No description"}</small></span></div></td>
            <td className="mono">{item.sku}</td><td>{item.category || "—"}</td><td className="table-number">{formatCurrency(item.price)}</td><td>{item.lowStockLimit}</td><td>{item.supplier?.name || "—"}</td>
            {canCreate && <td><button className="row-action danger-text" onClick={() => remove(item)} title="Delete product">Delete</button></td>}
          </tr>)}</tbody>
        </> : type === "warehouses" ? <>
          <thead><tr><th>Warehouse</th><th>Location</th><th>Manager</th><th>Capacity</th>{user.role === "admin" && <th />}</tr></thead>
          <tbody>{data.map((item) => <tr key={item._id}><td><div className="table-product"><span className="warehouse-symbol">▤</span><strong>{item.name}</strong></div></td><td>{item.location}</td><td>{item.manager?.name || "Unassigned"}</td><td>{Number(item.capacity).toLocaleString()} units</td>{user.role === "admin" && <td><button className="row-action danger-text" onClick={() => remove(item)}>Delete</button></td>}</tr>)}</tbody>
        </> : <>
          <thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Warehouses</th><th>Joined</th><th /></tr></thead>
          <tbody>{data.map((item) => <tr key={item._id}><td><div className="table-product"><span className="avatar avatar-small">{(item.name || item.email).slice(0, 1).toUpperCase()}</span><strong>{item.name}</strong></div></td><td>{item.email}</td><td><span className="role-pill">{roleLabel(item.role)}</span></td><td>{item.assignedWarehouses?.length || "—"}</td><td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}</td><td><button className="row-action danger-text" onClick={() => remove(item)}>Delete</button></td></tr>)}</tbody>
        </>}
      </table></div>}
    </Panel>}
    {dialog && <Modal title={type === "products" ? "Add a product" : type === "warehouses" ? "Add a warehouse" : "Add a team member"} onClose={closeDialog}>
      <Notice message={formError} />
      <form className="form-stack" onSubmit={submit}>
        {type === "products" ? <>
          <Field label="Product name" value={form.name || ""} onChange={change("name")} required />
          <div className="form-grid"><Field label="SKU" value={form.sku || ""} onChange={change("sku")} required /><Field label="Category" value={form.category || ""} onChange={change("category")} /></div>
          <div className="form-grid"><Field label="Price" type="number" min="0" step="0.01" value={form.price || ""} onChange={change("price")} required /><Field label="Reorder point" type="number" min="0" step="1" value={form.lowStockLimit || ""} onChange={change("lowStockLimit")} required /></div>
          <Field label="Description" value={form.description || ""} onChange={change("description")} />
          <label className="field">
            <span>Product image <small className="optional-label">Optional</small></span>
            <input className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} />
            <small className="upload-hint">JPEG, PNG, or WEBP · max 5 MB · stored in ImageKit. Backend ImageKit credentials are required.</small>
          </label>
          {previewUrl && <div className="image-preview"><img src={previewUrl} alt="Product preview" /><span>{form.imageFile.name}</span><button type="button" className="row-action danger-text" onClick={() => setForm((value) => ({ ...value, imageFile: null }))}>Remove</button></div>}
        </> : type === "warehouses" ? <>
          <Field label="Warehouse name" value={form.name || ""} onChange={change("name")} required />
          <Field label="Location" value={form.location || ""} onChange={change("location")} required />
          <Field label="Capacity (units)" type="number" min="0" value={form.capacity || ""} onChange={change("capacity")} required />
        </> : <>
          <Field label="Full name" value={form.name || ""} onChange={change("name")} required />
          <Field label="Email address" type="email" value={form.email || ""} onChange={change("email")} required />
          <Field label="Temporary password" type="password" minLength="8" value={form.password || ""} onChange={change("password")} required />
          <SelectField label="Role" value={form.role || ""} onChange={change("role")} options={[
            { value: "admin", label: "Administrator" },
            { value: "warehouseManager", label: "Warehouse manager" },
            { value: "supplier", label: "Supplier" },
            { value: "salesRepresentative", label: "Sales representative" },
          ]} required />
        </>}
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : "Save record"}</Button></div>
      </form>
    </Modal>}
  </>;
}

function roleLabel(role) {
  return ({ admin: "Admin", warehouseManager: "Warehouse manager", supplier: "Supplier", salesRepresentative: "Sales" })[role] || role;
}
