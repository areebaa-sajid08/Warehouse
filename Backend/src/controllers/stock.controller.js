import mongoose from "mongoose";
import Product from "../models/products.model.js";
import Warehouse from "../models/warehouse.model.js";
import Stock from "../models/stock.model.js";
import StockTransaction from "../models/stockTransaction.model.js";
import { publishActivityNotification } from "../services/activityNotifications.js";
import { withWarehouseMutation } from "../services/warehouseCapacity.js";
import { canManageWarehouse } from "../services/warehouseAccess.js";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function stockIn(req, res) {
  const { product, warehouse, quantity, note = "" } = req.body;
  const qty = Number(quantity);
  if (!mongoose.isValidObjectId(product) || !mongoose.isValidObjectId(warehouse) || !Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ message: "Valid product, warehouse and positive quantity are required" });
  }
  if (!await canManageWarehouse(req.user, warehouse)) return res.status(403).json({ message: "Warehouse is not assigned to you" });
  const stock = await withWarehouseMutation(warehouse, async ({ session }) => {
    const productRecord = await Product.findById(product).session(session);
    if (!productRecord || productRecord.archivedAt) throw httpError(404, "Active product not found");
    const updatedStock = await Stock.findOneAndUpdate(
      { product, warehouse },
      { $inc: { quantity: qty } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true, session },
    );
    await StockTransaction.create([{
      product, warehouse, transactionType: "stock-in", quantity: qty, note, performedBy: req.user.id,
    }], { session });
    return updatedStock;
  });
  const warehouseRecord = await Warehouse.findById(warehouse).select("manager");
  await publishActivityNotification({
    actorId: req.user.id,
    title: "Stock received",
    message: `${qty} units were added to inventory.`,
    category: "inventory",
    recipientIds: warehouseRecord?.manager ? [warehouseRecord.manager] : [],
  });
  res.status(201).json({ stock });
}

export async function stockOut(req, res) {
  const { product, warehouse, quantity, note = "" } = req.body;
  const qty = Number(quantity);
  if (!mongoose.isValidObjectId(product) || !mongoose.isValidObjectId(warehouse) || !Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ message: "Valid product, warehouse and positive quantity are required" });
  }
  if (!await canManageWarehouse(req.user, warehouse)) return res.status(403).json({ message: "Warehouse is not assigned to you" });
  const stock = await withWarehouseMutation(warehouse, async ({ session }) => {
    const updatedStock = await Stock.findOneAndUpdate(
      { product, warehouse, quantity: { $gte: qty } },
      { $inc: { quantity: -qty } },
      { new: true, session },
    );
    if (!updatedStock) throw httpError(400, "Insufficient stock");
    await StockTransaction.create([{
      product, warehouse, transactionType: "stock-out", quantity: qty, note, performedBy: req.user.id,
    }], { session });
    return updatedStock;
  });
  const warehouseRecord = await Warehouse.findById(warehouse).select("manager");
  await publishActivityNotification({
    actorId: req.user.id,
    title: "Stock dispatched",
    message: `${qty} units were removed from inventory.`,
    category: "inventory",
    recipientIds: warehouseRecord?.manager ? [warehouseRecord.manager] : [],
  });
  res.json({ stock });
}
