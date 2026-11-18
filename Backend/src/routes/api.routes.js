import express from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import User from "../models/users.model.js";
import Product from "../models/products.model.js";
import Warehouse from "../models/warehouse.model.js";
import Stock from "../models/stock.model.js";
import StockTransaction from "../models/stockTransaction.model.js";
import Order from "../models/order.model.js";
import SupplyRequest from "../models/supplyRequest.model.js";
import { authenticateToken, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.use(authenticateToken);

async function canManageWarehouse(req, warehouseId) {
  if (req.user.role === "admin") return true;
  if (req.user.role !== "warehouseManager") return false;
  const user = await User.findById(req.user.id).select("assignedWarehouses");
  return user?.assignedWarehouses.some((id) => id.toString() === warehouseId.toString());
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

router.post("/users", authorize("admin"), async (req, res) => {
  const imageError = validateUserImage(req.body);
  if (imageError) return res.status(400).json({ message: imageError });
  try {
    const { name, email, password, phone = "", role, assignedWarehouses = [], image = "", imageFileId = "" } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ message: "Name, email, password and role are required" });
    if (!["admin", "warehouseManager", "supplier", "salesRepresentative"].includes(role)) return res.status(400).json({ message: "Invalid role" });
    if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ message: "Email already registered" });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), phone, role, assignedWarehouses, image, imageFileId });
    res.status(201).json({ user: await User.findById(user._id).populate("assignedWarehouses") });
  } catch (error) { res.status(400).json({ message: error.message }); }
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
  res.json({ user });
});
router.get("/users", authorize("admin"), async (req, res) => res.json({ users: await User.find().populate("assignedWarehouses").select("-password") }));
router.put("/users/:id", authorize("admin"), async (req, res) => {
  const imageError = validateUserImage(req.body);
  if (imageError) return res.status(400).json({ message: imageError });
  try {
    const updates = { ...req.body };
    delete updates.password;
    if (req.body.password) updates.password = await bcrypt.hash(req.body.password, 12);
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate("assignedWarehouses");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (error) { res.status(400).json({ message: error.message }); }
});
router.delete("/users/:id", authorize("admin"), async (req, res) => {
  if (!await User.findByIdAndDelete(req.params.id)) return res.status(404).json({ message: "User not found" });
  res.json({ message: "User deleted" });
});

router.post("/products", authorize("admin", "warehouseManager"), async (req, res) => {
  const imageError = validateImagePayload(req.body);
  if (imageError) return res.status(400).json({ message: imageError });
  try { res.status(201).json({ product: await Product.create({ ...req.body, createdBy: req.user.id }) }); }
  catch (error) { res.status(400).json({ message: error.message }); }
});
router.get("/products", async (req, res) => {
  const filter = {};
  if (req.user.role === "supplier") filter.supplier = req.user.id;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.supplier) filter.supplier = req.query.supplier;
  if (req.query.search) filter.name = { $regex: req.query.search, $options: "i" };
  res.json({ products: await Product.find(filter).populate("supplier createdBy", "name email role") });
});
router.get("/products/:id", async (req, res) => {
  const product = await Product.findById(req.params.id).populate("supplier createdBy", "name email role");
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json({ product });
});
router.put("/products/:id", authorize("admin", "warehouseManager"), async (req, res) => {
  const imageError = validateImagePayload(req.body);
  if (imageError) return res.status(400).json({ message: imageError });
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json({ product });
});
router.delete("/products/:id", authorize("admin"), async (req, res) => {
  if (await Stock.exists({ product: req.params.id })) return res.status(409).json({ message: "Product has stock and cannot be deleted" });
  if (!await Product.findByIdAndDelete(req.params.id)) return res.status(404).json({ message: "Product not found" });
  res.json({ message: "Product deleted" });
});

router.post("/warehouses", authorize("admin"), async (req, res) => {
  try {
    const warehouse = await Warehouse.create(req.body);
    if (warehouse.manager) await User.findByIdAndUpdate(warehouse.manager, { $addToSet: { assignedWarehouses: warehouse._id } });
    res.status(201).json({ warehouse });
  } catch (error) { res.status(400).json({ message: error.message }); }
});
router.get("/warehouses", async (req, res) => {
  let filter = {};
  if (req.user.role === "warehouseManager") {
    const user = await User.findById(req.user.id).select("assignedWarehouses");
    filter = { _id: { $in: user?.assignedWarehouses || [] } };
  }
  res.json({ warehouses: await Warehouse.find(filter).populate("manager", "name email") });
});
router.put("/warehouses/:id", authorize("admin"), async (req, res) => {
  const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!warehouse) return res.status(404).json({ message: "Warehouse not found" });
  res.json({ warehouse });
});
router.delete("/warehouses/:id", authorize("admin"), async (req, res) => {
  if (await Stock.exists({ warehouse: req.params.id })) return res.status(409).json({ message: "Warehouse has inventory" });
  if (!await Warehouse.findByIdAndDelete(req.params.id)) return res.status(404).json({ message: "Warehouse not found" });
  res.json({ message: "Warehouse deleted" });
});

router.post("/stock/in", authorize("admin", "warehouseManager"), async (req, res) => {
  const { product, warehouse, quantity, note = "" } = req.body;
  const qty = Number(quantity);
  if (!product || !warehouse || !Number.isInteger(qty) || qty < 1) return res.status(400).json({ message: "Valid product, warehouse and positive quantity are required" });
  if (!await canManageWarehouse(req, warehouse)) return res.status(403).json({ message: "Warehouse is not assigned to you" });
  const stock = await Stock.findOneAndUpdate({ product, warehouse }, { $inc: { quantity: qty } }, { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true });
  await StockTransaction.create({ product, warehouse, transactionType: "stock-in", quantity: qty, note, performedBy: req.user.id });
  res.status(201).json({ stock });
});
router.post("/stock/out", authorize("admin", "warehouseManager"), async (req, res) => {
  const { product, warehouse, quantity, note = "" } = req.body;
  const qty = Number(quantity);
  if (!product || !warehouse || !Number.isInteger(qty) || qty < 1) return res.status(400).json({ message: "Valid product, warehouse and positive quantity are required" });
  if (!await canManageWarehouse(req, warehouse)) return res.status(403).json({ message: "Warehouse is not assigned to you" });
  const stock = await Stock.findOneAndUpdate({ product, warehouse, quantity: { $gte: qty } }, { $inc: { quantity: -qty } }, { new: true });
  if (!stock) return res.status(400).json({ message: "Insufficient stock" });
  await StockTransaction.create({ product, warehouse, transactionType: "stock-out", quantity: qty, note, performedBy: req.user.id });
  res.json({ stock });
});
router.get("/stock", async (req, res) => {
  const filter = {};
  if (req.query.warehouse) filter.warehouse = req.query.warehouse;
  if (req.query.product) filter.product = req.query.product;
  if (req.user.role === "warehouseManager") {
    const user = await User.findById(req.user.id).select("assignedWarehouses");
    filter.warehouse = { $in: user?.assignedWarehouses || [] };
  }
  res.json({ stock: await Stock.find(filter).populate("product warehouse") });
});
router.get("/stock/low", async (req, res) => {
  const filter = {};
  if (req.user.role === "warehouseManager") {
    const user = await User.findById(req.user.id).select("assignedWarehouses");
    filter.warehouse = { $in: user?.assignedWarehouses || [] };
  }
  const stocks = await Stock.find(filter).populate("product warehouse");
  res.json({ lowStock: stocks.filter((item) => item.product && item.quantity <= item.product.lowStockLimit) });
});
router.get("/transactions", async (req, res) => {
  const filter = {};
  if (req.query.warehouse) filter.warehouse = req.query.warehouse;
  if (req.user.role === "warehouseManager") {
    const user = await User.findById(req.user.id).select("assignedWarehouses");
    filter.warehouse = { $in: user?.assignedWarehouses || [] };
  }
  res.json({ transactions: await StockTransaction.find(filter).populate("product warehouse performedBy", "name email role") });
});

router.post("/orders", authorize("salesRepresentative"), async (req, res) => {
  try {
    const { customerName, customerPhone, warehouse, products } = req.body;
    if (!customerName || !customerPhone || !warehouse || !Array.isArray(products) || !products.length) return res.status(400).json({ message: "Customer, warehouse and at least one product are required" });
    const lines = [];
    let totalAmount = 0;
    for (const line of products) {
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ message: "Order quantities must be positive integers" });
      const product = await Product.findById(line.product);
      if (!product) return res.status(404).json({ message: "Product not found" });
      const stock = await Stock.findOne({ product: product._id, warehouse });
      if (!stock || stock.quantity < quantity) return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      lines.push({ product: product._id, quantity, price: product.price });
      totalAmount += product.price * quantity;
    }
    const order = await Order.create({
      orderNumber: `ORD-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      customerName, customerPhone, warehouse, products: lines, totalAmount, createdBy: req.user.id
    });
    res.status(201).json({ order });
  } catch (error) { res.status(400).json({ message: error.message }); }
});
router.get("/orders", async (req, res) => {
  const filter = req.user.role === "salesRepresentative" ? { createdBy: req.user.id } : {};
  res.json({ orders: await Order.find(filter).populate("products.product warehouse createdBy", "name sku location email role") });
});
router.get("/orders/:id", async (req, res) => {
  const order = await Order.findById(req.params.id).populate("products.product warehouse createdBy", "name sku price location email role");
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (req.user.role === "salesRepresentative" && order.createdBy._id.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
  res.json({ order });
});
router.put("/orders/:id/status", authorize("admin", "warehouseManager"), async (req, res) => {
  const { status } = req.body;
  if (!["Pending", "Processing", "Completed", "Cancelled"].includes(status)) return res.status(400).json({ message: "Invalid status" });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (!await canManageWarehouse(req, order.warehouse)) return res.status(403).json({ message: "Warehouse is not assigned to you" });
  if (["Completed", "Cancelled"].includes(order.status)) return res.status(409).json({ message: "Finalized orders cannot be changed" });
  if (status === "Completed" && order.status !== "Processing") return res.status(409).json({ message: "Order must be processing before completion" });
  if (status === "Pending") return res.status(409).json({ message: "Order cannot return to Pending" });
  if (status === "Cancelled") return res.status(400).json({ message: "Use the cancel endpoint" });
  if (status === "Processing" && order.status === "Pending") {
    const decrements = [];
    for (const line of order.products) {
      const stock = await Stock.findOneAndUpdate({ product: line.product, warehouse: order.warehouse, quantity: { $gte: line.quantity } }, { $inc: { quantity: -line.quantity } }, { new: true });
      if (!stock) {
        for (const done of decrements) await Stock.updateOne({ product: done.product, warehouse: order.warehouse }, { $inc: { quantity: done.quantity } });
        return res.status(400).json({ message: "Insufficient stock while processing order" });
      }
      decrements.push({ product: line.product, quantity: line.quantity });
      await StockTransaction.create({ product: line.product, warehouse: order.warehouse, transactionType: "stock-out", quantity: line.quantity, note: `Order ${order.orderNumber}`, performedBy: req.user.id });
    }
  }
  if (status === "Processing" && order.status === "Processing") return res.status(409).json({ message: "Order is already processing" });
  order.status = status;
  await order.save();
  res.json({ order });
});
router.put("/orders/:id/cancel", authorize("salesRepresentative", "admin"), async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (req.user.role === "salesRepresentative" && order.createdBy.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
  if (order.status !== "Pending") return res.status(409).json({ message: "Only pending orders can be cancelled" });
  order.status = "Cancelled";
  await order.save();
  res.json({ order });
});

router.post("/supply-requests", authorize("supplier"), async (req, res) => {
  const request = await SupplyRequest.create({ ...req.body, supplier: req.user.id, status: "Pending" });
  res.status(201).json({ request });
});
router.get("/supply-requests", async (req, res) => {
  const filter = req.user.role === "supplier" ? { supplier: req.user.id } : {};
  res.json({ requests: await SupplyRequest.find(filter).populate("supplier product warehouse reviewedBy", "name email sku location") });
});
router.put("/supply-requests/:id/status", authorize("admin", "warehouseManager"), async (req, res) => {
  if (!["Approved", "Rejected"].includes(req.body.status)) return res.status(400).json({ message: "Status must be Approved or Rejected" });
  const request = await SupplyRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Supply request not found" });
  if (!await canManageWarehouse(req, request.warehouse)) return res.status(403).json({ message: "Warehouse is not assigned to you" });
  if (request.status !== "Pending") return res.status(409).json({ message: "Request already reviewed" });
  request.status = req.body.status;
  request.reviewedBy = req.user.id;
  await request.save();
  if (req.body.status === "Approved") {
    await Stock.findOneAndUpdate({ product: request.product, warehouse: request.warehouse }, { $inc: { quantity: request.quantity } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    await StockTransaction.create({ product: request.product, warehouse: request.warehouse, transactionType: "stock-in", quantity: request.quantity, note: "Approved supply request", performedBy: req.user.id });
  }
  res.json({ request });
});

router.get("/dashboard/stats", authorize("admin"), async (req, res) => {
  const [users, products, warehouses, orders, suppliers, stocks] = await Promise.all([
    User.countDocuments(), Product.countDocuments(), Warehouse.countDocuments(), Order.countDocuments(),
    User.countDocuments({ role: "supplier" }), Stock.find().populate("product")
  ]);
  res.json({
    users, products, warehouses, orders, suppliers,
    lowStockProducts: stocks.filter((item) => item.product && item.quantity <= item.product.lowStockLimit).length
  });
});
router.get("/upload/auth", async (req, res) => {
  if (!process.env.IMAGEKIT_PRIVATE_KEY) return res.status(503).json({ message: "ImageKit private key is not configured" });
  const expire = Math.floor(Date.now() / 1000) + 1800;
  const token = crypto.randomUUID();
  const signature = crypto.createHmac("sha1", process.env.IMAGEKIT_PRIVATE_KEY).update(`${token}${expire}`).digest("hex");
  res.json({ token, expire, signature, publicKey: process.env.IMAGEKIT_PUBLIC_KEY, urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT });
});

export default router;
