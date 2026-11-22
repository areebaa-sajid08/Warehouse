import express from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import User from "../models/users.model.js";
import Product from "../models/products.model.js";
import Warehouse from "../models/warehouse.model.js";
import Stock from "../models/stock.model.js";
import StockTransaction from "../models/stockTransaction.model.js";
import Order from "../models/order.model.js";
import SupplyRequest from "../models/supplyRequest.model.js";
import ActivityNotification from "../models/activityNotification.model.js";
import { authenticateToken, authorize } from "../middlewares/auth.middleware.js";
import { publishActivityNotification } from "../services/activityNotifications.js";
import { withWarehouseMutation } from "../services/warehouseCapacity.js";
import { canManageWarehouse } from "../services/warehouseAccess.js";
import { stockIn, stockOut } from "../controllers/stock.controller.js";

const router = express.Router();
router.use(authenticateToken);

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function getPagination(query) {
  const requestedPage = Number(query.page);
  const requestedLimit = Number(query.limit);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  return { page, limit, skip: (page - 1) * limit };
}

async function findPage(Model, filter, query, options = {}) {
  const requested = getPagination(query);
  const total = await Model.countDocuments(filter);
  const pages = Math.ceil(total / requested.limit);
  const page = pages ? Math.min(requested.page, pages) : 1;
  let findQuery = Model.find(filter)
    .sort(options.sort || { createdAt: -1 })
    .skip((page - 1) * requested.limit)
    .limit(requested.limit);
  if (options.select) findQuery = findQuery.select(options.select);
  if (options.populate) findQuery = findQuery.populate(options.populate);
  const data = await findQuery;
  return { data, pagination: { page, limit: requested.limit, total, pages } };
}

function lowStockPipeline(filter) {
  return [
    { $match: filter },
    { $lookup: { from: Product.collection.name, localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: { "product.archivedAt": null, $expr: { $lte: ["$quantity", "$product.lowStockLimit"] } } },
  ];
}

async function countLowStock(filter) {
  const [result] = await Stock.aggregate([...lowStockPipeline(filter), { $count: "total" }]);
  return result?.total || 0;
}

async function applyStockSearch(filter, value) {
  if (typeof value !== "string" || !value.trim()) return;
  const search = escapeRegex(value.trim());
  const [products, warehouses] = await Promise.all([
    Product.find({
      archivedAt: null,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ],
    }).distinct("_id"),
    Warehouse.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ],
    }).distinct("_id"),
  ]);
  filter.$or = [{ product: { $in: products } }, { warehouse: { $in: warehouses } }];
}

function validateImagePayload(body) {
  if (body.imageUrl === undefined && body.imageFileId === undefined) return null;
  if (!body.imageUrl || !body.imageFileId) return "Image URL and ImageKit file ID must be provided together";
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (endpoint && !body.imageUrl.startsWith(endpoint)) return "Image URL must come from the configured ImageKit account";
  return null;
}

function validateUserImage(body) {
  if (body.image === undefined && body.imageFileId === undefined) return null;
  if (!body.image || !body.imageFileId) return "Profile image URL and ImageKit file ID must be provided together";
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (endpoint && !body.image.startsWith(endpoint)) return "Profile image URL must come from the configured ImageKit account";
  return null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseQueryObjectId(value, label) {
  if (value === undefined || value === "") return null;
  if (!mongoose.isValidObjectId(value)) throw httpError(400, `${label} must be a valid ID`);
  return new mongoose.Types.ObjectId(value);
}

router.post("/users", authorize("admin"), async (req, res) => {
  const imageError = validateUserImage(req.body);
  if (imageError) return res.status(400).json({ message: imageError });
  try {
    const { name, email, password, phone = "", role, assignedWarehouses = [], image = "", imageFileId = "" } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (typeof name !== "string" || !name.trim() || !normalizedEmail || typeof password !== "string" || !role) {
      return res.status(400).json({ message: "Name, email, password and role are required" });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (!["admin", "warehouseManager", "supplier", "salesRepresentative"].includes(role)) return res.status(400).json({ message: "Invalid role" });
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: "Email already registered" });
    const user = await User.create({ username: normalizedEmail, name, email: normalizedEmail, password: await bcrypt.hash(password, 12), phone, role, assignedWarehouses, image, imageFileId });
    await publishActivityNotification({ actorId: req.user.id, title: "Team member added", message: `${name} was added as ${role}.`, category: "account" });
    res.status(201).json({ user: await User.findById(user._id).populate("assignedWarehouses") });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(409).json({ message: field === "email" ? "Email already registered" : "Account identifier already in use" });
    }
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    console.error("User creation failed:", error.message);
    res.status(500).json({ message: "Unable to create the account right now" });
  }
});
router.put("/users/me", async (req, res) => {
  const imageError = validateUserImage(req.body);
  if (imageError) return res.status(400).json({ message: imageError });
  const allowed = {};
  for (const key of ["name", "phone", "image", "imageFileId"]) {
    if (req.body[key] !== undefined) allowed[key] = req.body[key];
  }
  const user = await User.findByIdAndUpdate(req.user.id, allowed, { new: true, runValidators: true }).populate("assignedWarehouses");
  if (!user) return res.status(404).json({ message: "User not found" });
  await publishActivityNotification({ actorId: req.user.id, title: "Profile updated", message: `${user.name} updated their profile.`, category: "account" });
  res.json({ user });
});
router.get("/users", authorize("admin"), async (req, res) => {
  const filter = {};
  if (typeof req.query.role === "string" && ["admin", "warehouseManager", "supplier", "salesRepresentative"].includes(req.query.role)) {
    filter.role = req.query.role;
  }
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = escapeRegex(req.query.search.trim());
    filter.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
  }
  const result = await findPage(User, filter, req.query, {
    sort: { createdAt: -1 },
    populate: "assignedWarehouses",
    select: "-password",
  });
  res.json({ users: result.data, pagination: result.pagination });
});
router.get("/suppliers", authorize("admin", "warehouseManager"), async (req, res) => {
  const result = await findPage(User, { role: "supplier" }, req.query, { sort: { name: 1 }, select: "name email" });
  res.json({ suppliers: result.data, pagination: result.pagination });
});
router.get("/notifications", async (req, res) => {
  const visibility = { $or: [{ visibleToRoles: req.user.role }, { recipientIds: req.user.id }] };
  const [result, unreadCount] = await Promise.all([
    findPage(ActivityNotification, visibility, req.query, {
      sort: { createdAt: -1 },
      populate: { path: "actor", select: "name role" },
    }),
    ActivityNotification.countDocuments({ ...visibility, readBy: { $ne: req.user.id } }),
  ]);
  const userId = String(req.user.id);
  const items = result.data.map((notification) => {
    const item = notification.toObject();
    const read = notification.readBy.some((readerId) => String(readerId) === userId);
    delete item.readBy;
    delete item.recipientIds;
    delete item.visibleToRoles;
    delete item.dedupeKey;
    return { ...item, read };
  });
  res.json({ notifications: items, pagination: result.pagination, unreadCount });
});
router.patch("/notifications/read", async (req, res) => {
  const visibility = { $or: [{ visibleToRoles: req.user.role }, { recipientIds: req.user.id }] };
  await ActivityNotification.updateMany(visibility, { $addToSet: { readBy: req.user.id } });
  res.json({ message: "Notifications marked as read" });
});
router.put("/users/:id", authorize("admin"), async (req, res) => {
  const imageError = validateUserImage(req.body);
  if (imageError) return res.status(400).json({ message: imageError });
  try {
    const updates = { ...req.body };
    delete updates.password;
    if (req.body.password) {
      if (typeof req.body.password !== "string" || req.body.password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      updates.password = await bcrypt.hash(req.body.password, 12);
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate("assignedWarehouses");
    if (!user) return res.status(404).json({ message: "User not found" });
    await publishActivityNotification({ actorId: req.user.id, title: "Team member updated", message: `Account details for ${user.name} were updated.`, category: "account" });
    res.json({ user });
  } catch (error) { res.status(400).json({ message: error.message }); }
});
router.delete("/users/:id", authorize("admin"), async (req, res) => {
  if (req.params.id.toLowerCase() === String(req.user.id).toLowerCase()) {
    return res.status(403).json({ message: "You cannot delete your own account" });
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  await publishActivityNotification({ actorId: req.user.id, title: "Team member removed", message: `${user.name}'s account was removed.`, category: "account" });
  res.json({ message: "User deleted" });
});

router.post("/products", authorize("admin", "warehouseManager"), async (req, res) => {
  const imageError = validateImagePayload(req.body);
  if (imageError) return res.status(400).json({ message: imageError });
  try {
    if (req.body.supplier && (!mongoose.isValidObjectId(req.body.supplier) || !await User.exists({ _id: req.body.supplier, role: "supplier" }))) {
      return res.status(400).json({ message: "Select a valid supplier" });
    }
    const fields = {};
    for (const key of ["name", "description", "sku", "category", "price", "lowStockLimit", "imageUrl", "imageFileId", "supplier"]) {
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }
    const product = await Product.create({ ...fields, createdBy: req.user.id });
    await publishActivityNotification({
      actorId: req.user.id,
      title: "Product added",
      message: `${product.name} was added to the catalog.`,
      category: "catalog",
      recipientIds: product.supplier ? [product.supplier] : [],
    });
    res.status(201).json({ product });
  }
  catch (error) { res.status(400).json({ message: error.message }); }
});
router.get("/products", async (req, res) => {
  const visibilityFilter = {};
  if (req.user.role !== "admin" || req.query.includeArchived !== "true") visibilityFilter.archivedAt = null;
  if (req.user.role === "supplier") visibilityFilter.supplier = req.user.id;
  const filter = { ...visibilityFilter };
  if (typeof req.query.category === "string" && req.query.category) filter.category = req.query.category;
  if (req.user.role !== "supplier" && typeof req.query.supplier === "string" && req.query.supplier) filter.supplier = req.query.supplier;
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = escapeRegex(req.query.search.trim());
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }
  const result = await findPage(Product, filter, req.query, {
    sort: { createdAt: -1 },
    populate: { path: "supplier createdBy", select: "name email role" },
  });
  const categories = await Product.distinct("category", visibilityFilter);
  res.json({
    products: result.data,
    pagination: result.pagination,
    categories: categories.filter(Boolean).sort(),
  });
});
router.get("/products/:id", async (req, res) => {
  const product = await Product.findById(req.params.id).populate("supplier createdBy", "name email role");
  if (!product) return res.status(404).json({ message: "Product not found" });
  if (product.archivedAt && req.user.role !== "admin") return res.status(404).json({ message: "Product not found" });
  if (req.user.role === "supplier" && String(product.supplier?._id) !== req.user.id) return res.status(403).json({ message: "Forbidden" });
  res.json({ product });
});
router.put("/products/:id", authorize("admin", "warehouseManager"), async (req, res) => {
  const imageError = validateImagePayload(req.body);
  if (imageError) return res.status(400).json({ message: imageError });
  if (req.body.supplier && (!mongoose.isValidObjectId(req.body.supplier) || !await User.exists({ _id: req.body.supplier, role: "supplier" }))) {
    return res.status(400).json({ message: "Select a valid supplier" });
  }
  const updates = {};
  for (const key of ["name", "description", "sku", "category", "price", "lowStockLimit", "imageUrl", "imageFileId", "supplier"]) {
    if (req.body[key] !== undefined) updates[key] = req.body[key] || (key === "supplier" ? null : req.body[key]);
  }
  const product = await Product.findOneAndUpdate({ _id: req.params.id, archivedAt: null }, updates, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ message: "Product not found" });
  await publishActivityNotification({
    actorId: req.user.id,
    title: "Product updated",
    message: `${product.name} was updated.`,
    category: "catalog",
    recipientIds: product.supplier ? [product.supplier] : [],
  });
  res.json({ product });
});
router.delete("/products/:id", authorize("admin"), async (req, res) => {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, archivedAt: null },
    { $set: { archivedAt: new Date() } },
    { new: true },
  );
  if (!product) return res.status(404).json({ message: "Product not found" });
  await publishActivityNotification({
    actorId: req.user.id,
    title: "Product removed",
    message: `${product.name} was archived.`,
    category: "catalog",
    recipientIds: product.supplier ? [product.supplier] : [],
  });
  res.json({ message: "Product archived", product });
});
router.post("/products/:id/restore", authorize("admin"), async (req, res) => {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, archivedAt: { $ne: null } },
    { $set: { archivedAt: null } },
    { new: true },
  );
  if (!product) return res.status(404).json({ message: "Archived product not found" });
  await publishActivityNotification({
    actorId: req.user.id,
    title: "Product restored",
    message: `${product.name} was restored to the catalog.`,
    category: "catalog",
    recipientIds: product.supplier ? [product.supplier] : [],
  });
  res.json({ product });
});

router.post("/warehouses", authorize("admin"), async (req, res) => {
  try {
    if (req.body.manager && (!mongoose.isValidObjectId(req.body.manager) || !await User.exists({ _id: req.body.manager, role: "warehouseManager" }))) {
      return res.status(400).json({ message: "Select a valid warehouse manager" });
    }
    const warehouse = await Warehouse.create(req.body);
    if (warehouse.manager) await User.findByIdAndUpdate(warehouse.manager, { $addToSet: { assignedWarehouses: warehouse._id } });
    await publishActivityNotification({
      actorId: req.user.id,
      title: "Warehouse added",
      message: `${warehouse.name} was added.`,
      category: "warehouse",
      recipientIds: warehouse.manager ? [warehouse.manager] : [],
    });
    res.status(201).json({ warehouse });
  } catch (error) { res.status(400).json({ message: error.message }); }
});
router.get("/warehouses", async (req, res) => {
  const filter = {};
  if (req.user.role === "warehouseManager") {
    const user = await User.findById(req.user.id).select("assignedWarehouses");
    filter._id = { $in: user?.assignedWarehouses || [] };
  }
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = escapeRegex(req.query.search.trim());
    filter.$or = [{ name: { $regex: search, $options: "i" } }, { location: { $regex: search, $options: "i" } }];
  }
  const result = await findPage(Warehouse, filter, req.query, {
    sort: { name: 1 },
    populate: { path: "manager", select: "name email" },
  });
  const warehouseIds = result.data.map((warehouse) => warehouse._id);
  const [stockTotals, processingTotals] = warehouseIds.length ? await Promise.all([
    Stock.aggregate([
      { $match: { warehouse: { $in: warehouseIds } } },
      { $group: { _id: "$warehouse", units: { $sum: "$quantity" } } },
    ]),
    Order.aggregate([
      { $match: { warehouse: { $in: warehouseIds }, status: "Processing" } },
      { $unwind: "$products" },
      { $group: { _id: "$warehouse", units: { $sum: "$products.quantity" } } },
    ]),
  ]) : [[], []];
  const usageByWarehouse = new Map();
  for (const row of stockTotals) usageByWarehouse.set(String(row._id), row.units);
  for (const row of processingTotals) usageByWarehouse.set(
    String(row._id),
    (usageByWarehouse.get(String(row._id)) || 0) + row.units,
  );
  const warehouses = result.data.map((warehouse) => ({
    ...warehouse.toObject(),
    usedCapacity: usageByWarehouse.get(String(warehouse._id)) || 0,
  }));
  res.json({ warehouses, pagination: result.pagination });
});
router.put("/warehouses/:id", authorize("admin"), async (req, res) => {
  const updates = {};
  for (const key of ["name", "location", "capacity", "manager"]) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.capacity !== undefined && (!Number.isInteger(Number(updates.capacity)) || Number(updates.capacity) < 0)) {
    return res.status(400).json({ message: "Capacity must be a non-negative whole number of units" });
  }
  if (updates.manager !== undefined) {
    if (updates.manager && (!mongoose.isValidObjectId(updates.manager) || !await User.exists({ _id: updates.manager, role: "warehouseManager" }))) {
      return res.status(400).json({ message: "Select a valid warehouse manager" });
    }
    if (!updates.manager) updates.manager = null;
  }
  const warehouse = await withWarehouseMutation(req.params.id, async ({ session, warehouse: current }) => {
    const previousManagerId = current.manager?.toString();
    Object.assign(current, updates);
    await current.save({ session });
    if (updates.manager !== undefined && previousManagerId !== current.manager?.toString()) {
      if (previousManagerId) await User.findByIdAndUpdate(previousManagerId, { $pull: { assignedWarehouses: current._id } }, { session });
      if (current.manager) await User.findByIdAndUpdate(current.manager, { $addToSet: { assignedWarehouses: current._id } }, { session });
    }
    return current;
  });
  await warehouse.populate("manager", "name email");
  await publishActivityNotification({
    actorId: req.user.id,
    title: "Warehouse updated",
    message: `${warehouse.name} was updated.`,
    category: "warehouse",
    recipientIds: warehouse.manager ? [warehouse.manager] : [],
  });
  res.json({ warehouse });
});
router.delete("/warehouses/:id", authorize("admin"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse ID" });
  const session = await mongoose.startSession();
  let warehouse;
  try {
    await session.withTransaction(async () => {
      warehouse = await Warehouse.findByIdAndUpdate(
        req.params.id,
        { $inc: { capacityRevision: 1 } },
        { new: true, session },
      );
      if (!warehouse) throw httpError(404, "Warehouse not found");
      const hasStock = await Stock.exists({ warehouse: warehouse._id }).session(session);
      const hasOrders = await Order.exists({ warehouse: warehouse._id }).session(session);
      const hasSupplyRequests = await SupplyRequest.exists({ warehouse: warehouse._id }).session(session);
      const hasTransactions = await StockTransaction.exists({ warehouse: warehouse._id }).session(session);
      if (hasStock || hasOrders || hasSupplyRequests || hasTransactions) {
        throw httpError(409, "Warehouse has inventory or history and cannot be deleted");
      }
      await Warehouse.deleteOne({ _id: warehouse._id }, { session });
      if (warehouse.manager) {
        await User.updateOne(
          { _id: warehouse.manager },
          { $pull: { assignedWarehouses: warehouse._id } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }
  await publishActivityNotification({
    actorId: req.user.id,
    title: "Warehouse removed",
    message: `${warehouse.name} was removed.`,
    category: "warehouse",
    recipientIds: warehouse.manager ? [warehouse.manager] : [],
  });
  res.json({ message: "Warehouse deleted" });
});

router.post("/stock/in", authorize("admin", "warehouseManager"), stockIn);
router.post("/stock/out", authorize("admin", "warehouseManager"), stockOut);
router.get("/stock", authorize("admin", "warehouseManager"), async (req, res) => {
  const filter = {};
  const requestedWarehouse = parseQueryObjectId(req.query.warehouse, "Warehouse");
  const requestedProduct = parseQueryObjectId(req.query.product, "Product");
  if (requestedWarehouse) filter.warehouse = requestedWarehouse;
  if (requestedProduct) filter.product = requestedProduct;
  if (req.user.role === "warehouseManager") {
    const user = await User.findById(req.user.id).select("assignedWarehouses");
    const assigned = user?.assignedWarehouses || [];
    filter.warehouse = requestedWarehouse
      ? { $in: assigned.filter((id) => id.equals(requestedWarehouse)) }
      : { $in: assigned };
  }
  await applyStockSearch(filter, req.query.search);
  const [result, unitsResult, lowStock] = await Promise.all([
    findPage(Stock, filter, req.query, {
      sort: { updatedAt: -1 },
      populate: "product warehouse",
    }),
    Stock.aggregate([{ $match: filter }, { $group: { _id: null, units: { $sum: "$quantity" } } }]),
    countLowStock(filter),
  ]);
  res.json({
    stock: result.data,
    pagination: result.pagination,
    summary: { totalUnits: unitsResult[0]?.units || 0, lowStock },
  });
});
router.get("/stock/low", authorize("admin", "warehouseManager"), async (req, res) => {
  const filter = {};
  const requestedWarehouse = parseQueryObjectId(req.query.warehouse, "Warehouse");
  const requestedProduct = parseQueryObjectId(req.query.product, "Product");
  if (requestedWarehouse) filter.warehouse = requestedWarehouse;
  if (requestedProduct) filter.product = requestedProduct;
  if (req.user.role === "warehouseManager") {
    const user = await User.findById(req.user.id).select("assignedWarehouses");
    const assigned = user?.assignedWarehouses || [];
    filter.warehouse = requestedWarehouse
      ? { $in: assigned.filter((id) => id.equals(requestedWarehouse)) }
      : { $in: assigned };
  }
  await applyStockSearch(filter, req.query.search);
  const requested = getPagination(req.query);
  const [countResult, stockTotals, trackedItems] = await Promise.all([
    Stock.aggregate([...lowStockPipeline(filter), { $count: "total" }]),
    Stock.aggregate([{ $match: filter }, { $group: { _id: null, units: { $sum: "$quantity" } } }]),
    Stock.countDocuments(filter),
  ]);
  const total = countResult[0]?.total || 0;
  const pages = Math.ceil(total / requested.limit);
  const page = pages ? Math.min(requested.page, pages) : 1;
  const lowStock = await Stock.aggregate([
    ...lowStockPipeline(filter),
    { $lookup: { from: Warehouse.collection.name, localField: "warehouse", foreignField: "_id", as: "warehouse" } },
    { $unwind: { path: "$warehouse", preserveNullAndEmptyArrays: true } },
    { $sort: { updatedAt: -1, _id: -1 } },
    { $skip: (page - 1) * requested.limit },
    { $limit: requested.limit },
  ]);
  res.json({
    lowStock,
    pagination: { page, limit: requested.limit, total, pages },
    summary: { trackedItems, totalUnits: stockTotals[0]?.units || 0, lowStock: total },
  });
});
router.get("/transactions", authorize("admin", "warehouseManager"), async (req, res) => {
  const filter = {};
  const requestedWarehouse = parseQueryObjectId(req.query.warehouse, "Warehouse");
  if (requestedWarehouse) filter.warehouse = requestedWarehouse;
  if (["stock-in", "stock-out"].includes(req.query.type)) filter.transactionType = req.query.type;
  if (req.query.from || req.query.to) {
    filter.date = {};
    for (const [key, operator] of [["from", "$gte"], ["to", "$lt"]]) {
      if (!req.query[key]) continue;
      const date = new Date(`${req.query[key]}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) return res.status(400).json({ message: `Invalid ${key} date` });
      if (key === "to") date.setUTCDate(date.getUTCDate() + 1);
      filter.date[operator] = date;
    }
  }
  if (req.user.role === "warehouseManager") {
    const user = await User.findById(req.user.id).select("assignedWarehouses");
    const assigned = user?.assignedWarehouses || [];
    filter.warehouse = requestedWarehouse
      ? { $in: assigned.filter((id) => id.equals(requestedWarehouse)) }
      : { $in: assigned };
  }
  const requested = getPagination(req.query);
  const pipeline = [
    { $match: filter },
    { $lookup: { from: Product.collection.name, localField: "product", foreignField: "_id", as: "product" } },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: Warehouse.collection.name, localField: "warehouse", foreignField: "_id", as: "warehouse" } },
    { $unwind: { path: "$warehouse", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: User.collection.name, localField: "performedBy", foreignField: "_id", as: "performedBy" } },
    { $unwind: { path: "$performedBy", preserveNullAndEmptyArrays: true } },
  ];
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = escapeRegex(req.query.search.trim());
    pipeline.push({
      $match: {
        $or: [
          { note: { $regex: search, $options: "i" } },
          { "product.name": { $regex: search, $options: "i" } },
          { "product.sku": { $regex: search, $options: "i" } },
          { "warehouse.name": { $regex: search, $options: "i" } },
          { "performedBy.name": { $regex: search, $options: "i" } },
          { transactionType: { $regex: search, $options: "i" } },
        ],
      },
    });
  }
  const sortDirection = req.query.sort === "oldest" ? 1 : -1;
  const fetchPage = (skip) => StockTransaction.aggregate([
    ...pipeline,
    {
      $facet: {
        transactions: [{ $sort: { date: sortDirection, _id: sortDirection } }, { $skip: skip }, { $limit: requested.limit }],
        total: [{ $count: "count" }],
      },
    },
  ]);
  let page = requested.page;
  let [result] = await fetchPage((page - 1) * requested.limit);
  const total = result.total[0]?.count || 0;
  const pages = Math.ceil(total / requested.limit);
  page = pages ? Math.min(page, pages) : 1;
  if (page !== requested.page) [result] = await fetchPage((page - 1) * requested.limit);
  res.json({
    transactions: result.transactions,
    pagination: { page, limit: requested.limit, total, pages },
  });
});

router.post("/orders", authorize("salesRepresentative"), async (req, res) => {
  try {
    const { customerName, customerPhone, warehouse, products } = req.body || {};
    if (!customerName || !customerPhone || !mongoose.isValidObjectId(warehouse) || !Array.isArray(products) || !products.length) {
      return res.status(400).json({ message: "Customer, warehouse and at least one product are required" });
    }
    const quantities = new Map();
    for (const line of products) {
      if (!line || typeof line !== "object" || !mongoose.isValidObjectId(line.product)) {
        return res.status(400).json({ message: "Every order line must include a valid product" });
      }
      const quantity = Number(line.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 1) return res.status(400).json({ message: "Order quantities must be positive integers" });
      const productId = String(line.product);
      const combinedQuantity = (quantities.get(productId) || 0) + quantity;
      if (!Number.isSafeInteger(combinedQuantity)) return res.status(400).json({ message: "Combined product quantities are too large" });
      quantities.set(productId, combinedQuantity);
    }
    const order = await withWarehouseMutation(warehouse, async ({ session }) => {
      const lines = [];
      let totalAmount = 0;
      for (const [productId, quantity] of quantities) {
        const product = await Product.findOne({ _id: productId, archivedAt: null }).session(session);
        if (!product) throw httpError(404, "Product not found");
        const stock = await Stock.findOne({ product: product._id, warehouse }).session(session);
        if (!stock || stock.quantity < quantity) throw httpError(400, `Insufficient stock for ${product.name}`);
        lines.push({ product: product._id, quantity, price: product.price });
        totalAmount += product.price * quantity;
      }
      const [createdOrder] = await Order.create([{
        orderNumber: `ORD-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
        customerName, customerPhone, warehouse, products: lines, totalAmount, createdBy: req.user.id
      }], { session });
      return createdOrder;
    });
    const warehouseRecord = await Warehouse.findById(warehouse).select("manager");
    await publishActivityNotification({
      actorId: req.user.id,
      title: "Order created",
      message: `Order ${order.orderNumber} was created.`,
      category: "order",
      recipientIds: [order.createdBy, warehouseRecord?.manager].filter(Boolean),
    });
    res.status(201).json({ order });
  } catch (error) {
    const status = error.status || (error.name === "ValidationError" ? 400 : 500);
    const message = (error.status || status === 400) ? error.message : "Unable to create order";
    res.status(status).json({ message });
  }
});
router.get("/orders", authorize("admin", "warehouseManager", "salesRepresentative"), async (req, res) => {
  const baseFilter = {};
  if (req.user.role === "salesRepresentative") baseFilter.createdBy = req.user.id;
  if (req.user.role === "warehouseManager") {
    const user = await User.findById(req.user.id).select("assignedWarehouses");
    baseFilter.warehouse = { $in: user?.assignedWarehouses || [] };
  }
  const filter = { ...baseFilter };
  if (["Pending", "Processing", "Completed", "Cancelled"].includes(req.query.status)) filter.status = req.query.status;
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = escapeRegex(req.query.search.trim());
    filter.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { customerName: { $regex: search, $options: "i" } },
      { customerPhone: { $regex: search, $options: "i" } },
    ];
  }
  const [result, statusCounts] = await Promise.all([
    findPage(Order, filter, req.query, {
      sort: { createdAt: -1 },
      populate: { path: "products.product warehouse createdBy", select: "name sku location email role" },
    }),
    Order.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$status", count: { $sum: 1 }, value: { $sum: "$totalAmount" } } },
    ]),
  ]);
  res.json({
    orders: result.data,
    pagination: result.pagination,
    statusSummary: Object.fromEntries(statusCounts.map((entry) => [entry._id, { count: entry.count, value: entry.value }])),
  });
});
router.get("/orders/:id", authorize("admin", "warehouseManager", "salesRepresentative"), async (req, res) => {
  const order = await Order.findById(req.params.id).populate("products.product warehouse createdBy", "name sku price location email role");
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (req.user.role === "salesRepresentative" && order.createdBy?._id?.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
  if (req.user.role === "warehouseManager" && (!order.warehouse?._id || !await canManageWarehouse(req.user, order.warehouse._id))) {
    return res.status(403).json({ message: "Warehouse is not assigned to you" });
  }
  res.json({ order });
});
router.put("/orders/:id/status", authorize("admin", "warehouseManager"), async (req, res) => {
  const { status } = req.body;
  if (!["Processing", "Completed"].includes(status)) return res.status(400).json({ message: "Use the cancel endpoint to cancel an order" });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (!await canManageWarehouse(req.user, order.warehouse)) return res.status(403).json({ message: "Warehouse is not assigned to you" });
  let updatedOrder;
  if (status === "Processing" && order.status === "Pending") {
    updatedOrder = await withWarehouseMutation(order.warehouse, async ({ session }) => {
      const processingOrder = await Order.findOneAndUpdate(
        { _id: order._id, status: "Pending" },
        { $set: { status: "Processing" } },
        { new: true, session },
      );
      if (!processingOrder) throw httpError(409, "Order is no longer pending");
      for (const line of processingOrder.products) {
        const stock = await Stock.findOneAndUpdate(
          { product: line.product, warehouse: processingOrder.warehouse, quantity: { $gte: line.quantity } },
          { $inc: { quantity: -line.quantity } },
          { new: true, session },
        );
        if (!stock) throw httpError(400, "Insufficient stock while processing order");
        await StockTransaction.create([{
          product: line.product,
          warehouse: processingOrder.warehouse,
          transactionType: "stock-out",
          quantity: line.quantity,
          note: `Order ${processingOrder.orderNumber}`,
          performedBy: req.user.id,
        }], { session });
      }
      return processingOrder;
    });
  } else if (status === "Completed" && order.status === "Processing") {
    updatedOrder = await withWarehouseMutation(order.warehouse, async ({ session }) => {
      const completedOrder = await Order.findOneAndUpdate(
        { _id: order._id, status: "Processing" },
        { $set: { status: "Completed" } },
        { new: true, session },
      );
      if (!completedOrder) throw httpError(409, "Order is no longer processing");
      return completedOrder;
    });
  } else {
    return res.status(409).json({ message: status === "Completed" ? "Order must be processing before completion" : "Only pending orders can be processed" });
  }

  const warehouse = await Warehouse.findById(order.warehouse).select("manager");
  await publishActivityNotification({
    actorId: req.user.id,
    title: "Order status changed",
    message: `Order ${updatedOrder.orderNumber} is now ${status.toLowerCase()}.`,
    category: "order",
    recipientIds: [updatedOrder.createdBy, warehouse?.manager].filter(Boolean),
  });
  res.json({ order: updatedOrder });
});
router.put("/orders/:id/cancel", authorize("salesRepresentative", "warehouseManager", "admin"), async (req, res) => {
  const currentOrder = await Order.findById(req.params.id);
  if (!currentOrder) return res.status(404).json({ message: "Order not found" });
  if (req.user.role === "salesRepresentative" && currentOrder.createdBy.toString() !== req.user.id) {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (req.user.role === "warehouseManager" && !await canManageWarehouse(req.user, currentOrder.warehouse)) {
    return res.status(403).json({ message: "Warehouse is not assigned to you" });
  }
  let cancelledOrder;
  if (currentOrder.status === "Pending") {
    cancelledOrder = await Order.findOneAndUpdate(
      { _id: currentOrder._id, status: "Pending" },
      { $set: { status: "Cancelled" } },
      { new: true },
    );
    if (!cancelledOrder) return res.status(409).json({ message: "Order status changed; refresh and try again" });
  } else if (currentOrder.status === "Processing") {
    cancelledOrder = await withWarehouseMutation(currentOrder.warehouse, async ({ session }) => {
      const updated = await Order.findOneAndUpdate(
        { _id: currentOrder._id, status: "Processing" },
        { $set: { status: "Cancelled" } },
        { new: true, session },
      );
      if (!updated) throw httpError(409, "Order status changed; refresh and try again");
      for (const line of updated.products) {
        await Stock.findOneAndUpdate(
          { product: line.product, warehouse: updated.warehouse },
          { $inc: { quantity: line.quantity } },
          { new: true, upsert: true, setDefaultsOnInsert: true, session },
        );
        await StockTransaction.create([{
          product: line.product,
          warehouse: updated.warehouse,
          transactionType: "stock-in",
          quantity: line.quantity,
          note: `Stock returned after cancelling order ${updated.orderNumber}`,
          performedBy: req.user.id,
        }], { session });
      }
      return updated;
    });
  } else {
    return res.status(409).json({ message: "Only pending or processing orders can be cancelled" });
  }

  const warehouse = await Warehouse.findById(cancelledOrder.warehouse).select("manager");
  await publishActivityNotification({
    actorId: req.user.id,
    title: "Order cancelled",
    message: `Order ${cancelledOrder.orderNumber} was cancelled.`,
    category: "order",
    recipientIds: [cancelledOrder.createdBy, warehouse?.manager].filter(Boolean),
  });
  res.json({ order: cancelledOrder });
});

router.post("/supply-requests", authorize("supplier"), async (req, res) => {
  const { product, warehouse, quantity } = req.body || {};
  const requestedQuantity = Number(quantity);
  if (!mongoose.isValidObjectId(product) || !mongoose.isValidObjectId(warehouse) || !Number.isSafeInteger(requestedQuantity) || requestedQuantity < 1) {
    return res.status(400).json({ message: "Select a valid product and warehouse and enter a positive whole-number quantity" });
  }
  const supplierProduct = await Product.findOne({ _id: product, supplier: req.user.id, archivedAt: null });
  if (!supplierProduct) return res.status(403).json({ message: "You can only request supply for your active products" });
  const request = await withWarehouseMutation(warehouse, async ({ session }) => {
    const [createdRequest] = await SupplyRequest.create([{
      product, warehouse, quantity: requestedQuantity, supplier: req.user.id,
    }], { session });
    return createdRequest;
  });
  const warehouseRecord = await Warehouse.findById(request.warehouse).select("manager");
  await publishActivityNotification({
    actorId: req.user.id,
    title: "Supply request submitted",
    message: `A request for ${request.quantity} units was submitted.`,
    category: "supply",
    recipientIds: [request.supplier, warehouseRecord?.manager].filter(Boolean),
  });
  res.status(201).json({ request });
});
router.get("/supply-requests", authorize("admin", "warehouseManager", "supplier"), async (req, res) => {
  const baseFilter = {};
  if (req.user.role === "supplier") baseFilter.supplier = req.user.id;
  if (req.user.role === "warehouseManager") {
    const user = await User.findById(req.user.id).select("assignedWarehouses");
    baseFilter.warehouse = { $in: user?.assignedWarehouses || [] };
  }
  const filter = { ...baseFilter };
  if (["Pending", "Approved", "Rejected"].includes(req.query.status)) filter.status = req.query.status;
  const [result, statusCounts] = await Promise.all([
    findPage(SupplyRequest, filter, req.query, {
      sort: { createdAt: -1 },
      populate: { path: "supplier product warehouse reviewedBy", select: "name email sku location" },
    }),
    SupplyRequest.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  res.json({
    requests: result.data,
    pagination: result.pagination,
    statusCounts: Object.fromEntries(statusCounts.map((entry) => [entry._id, entry.count])),
  });
});
router.put("/supply-requests/:id/status", authorize("admin", "warehouseManager"), async (req, res) => {
  if (!["Approved", "Rejected"].includes(req.body.status)) return res.status(400).json({ message: "Status must be Approved or Rejected" });
  const request = await SupplyRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Supply request not found" });
  if (!await canManageWarehouse(req.user, request.warehouse)) return res.status(403).json({ message: "Warehouse is not assigned to you" });
  let updatedRequest;
  if (req.body.status === "Approved") {
    updatedRequest = await withWarehouseMutation(request.warehouse, async ({ session }) => {
      const approved = await SupplyRequest.findOneAndUpdate(
        { _id: request._id, status: "Pending" },
        { $set: { status: "Approved", reviewedBy: req.user.id } },
        { new: true, session },
      );
      if (!approved) throw httpError(409, "Request has already been reviewed");
      const product = await Product.findById(approved.product).session(session);
      if (!product || product.archivedAt) throw httpError(409, "The requested product is no longer active");
      await Stock.findOneAndUpdate(
        { product: approved.product, warehouse: approved.warehouse },
        { $inc: { quantity: approved.quantity } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session },
      );
      await StockTransaction.create([{
        product: approved.product,
        warehouse: approved.warehouse,
        transactionType: "stock-in",
        quantity: approved.quantity,
        note: "Approved supply request",
        performedBy: req.user.id,
      }], { session });
      return approved;
    });
  } else {
    updatedRequest = await SupplyRequest.findOneAndUpdate(
      { _id: request._id, status: "Pending" },
      { $set: { status: "Rejected", reviewedBy: req.user.id } },
      { new: true },
    );
    if (!updatedRequest) return res.status(409).json({ message: "Request has already been reviewed" });
  }
  await publishActivityNotification({
    actorId: req.user.id,
    title: "Supply request reviewed",
    message: `A supply request was ${updatedRequest.status.toLowerCase()}.`,
    category: "supply",
    recipientIds: [updatedRequest.supplier, updatedRequest.reviewedBy].filter(Boolean),
  });
  res.json({ request: updatedRequest });
});

router.get("/dashboard/stats", authorize("admin"), async (req, res) => {
  const [users, products, warehouses, orders, suppliers, lowStockProducts] = await Promise.all([
    User.countDocuments(), Product.countDocuments({ archivedAt: null }), Warehouse.countDocuments(), Order.countDocuments(),
    User.countDocuments({ role: "supplier" }), countLowStock({})
  ]);
  res.json({
    users, products, warehouses, orders, suppliers,
    lowStockProducts
  });
});
router.get("/upload/auth", authorize("admin", "warehouseManager"), async (req, res) => {
  if (!process.env.IMAGEKIT_PRIVATE_KEY) return res.status(503).json({ message: "ImageKit private key is not configured" });
  const expire = Math.floor(Date.now() / 1000) + 1800;
  const token = crypto.randomUUID();
  const signature = crypto.createHmac("sha1", process.env.IMAGEKIT_PRIVATE_KEY).update(`${token}${expire}`).digest("hex");
  res.json({ token, expire, signature, publicKey: process.env.IMAGEKIT_PUBLIC_KEY, urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT });
});

export default router;
