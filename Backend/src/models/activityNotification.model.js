import mongoose from "mongoose";

const activityNotificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: ["account", "catalog", "inventory", "order", "supply", "warehouse"] },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  visibleToRoles: [{ type: String, enum: ["admin", "warehouseManager", "supplier", "salesRepresentative"] }],
  recipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  dedupeKey: { type: String, unique: true, sparse: true },
}, { timestamps: true });

activityNotificationSchema.index({ createdAt: -1 });
activityNotificationSchema.index({ visibleToRoles: 1, createdAt: -1 });
activityNotificationSchema.index({ recipientIds: 1, createdAt: -1 });

export default mongoose.model("ActivityNotification", activityNotificationSchema);
