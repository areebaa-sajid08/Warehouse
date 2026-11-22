import User from "../models/users.model.js";

export async function canManageWarehouse(user, warehouseId) {
  if (user.role === "admin") return true;
  if (user.role !== "warehouseManager") return false;
  const record = await User.findById(user.id).select("assignedWarehouses");
  return record?.assignedWarehouses.some((id) => id.toString() === warehouseId.toString()) || false;
}
