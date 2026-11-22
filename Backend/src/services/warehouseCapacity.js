import mongoose from "mongoose";
import Warehouse from "../models/warehouse.model.js";
import Stock from "../models/stock.model.js";
import Order from "../models/order.model.js";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getWarehouseUsage(warehouseId, session) {
  const objectId = new mongoose.Types.ObjectId(warehouseId);
  const stockTotals = await Stock.aggregate([
    { $match: { warehouse: objectId } },
    { $group: { _id: null, units: { $sum: "$quantity" } } },
  ]).session(session);
  const processingTotals = await Order.aggregate([
    { $match: { warehouse: objectId, status: "Processing" } },
    { $unwind: "$products" },
    { $group: { _id: null, units: { $sum: "$products.quantity" } } },
  ]).session(session);
  const onHand = stockTotals[0]?.units || 0;
  const reservedForProcessing = processingTotals[0]?.units || 0;
  return onHand + reservedForProcessing;
}

export async function withWarehouseMutation(warehouseId, work) {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const warehouse = await Warehouse.findByIdAndUpdate(
        warehouseId,
        { $inc: { capacityRevision: 1 } },
        { new: true, session },
      );
      if (!warehouse) throw httpError(404, "Warehouse not found");

      const initialUsage = await getWarehouseUsage(warehouseId, session);
      result = await work({ session, warehouse });

      const currentWarehouse = await Warehouse.findById(warehouseId).session(session);
      if (!currentWarehouse) throw httpError(404, "Warehouse not found");
      const occupied = await getWarehouseUsage(warehouseId, session);

      const capacityChanged = currentWarehouse.capacity !== warehouse.capacity;
      if (occupied > currentWarehouse.capacity && (occupied > initialUsage || capacityChanged)) {
        throw httpError(409, `Warehouse capacity exceeded (${occupied}/${currentWarehouse.capacity} units)`);
      }
    });
  } finally {
    await session.endSession();
  }

  return result;
}
