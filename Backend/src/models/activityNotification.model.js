import mongoose from "mongoose";

const activityNotificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: ["account", "catalog", "inventory", "order", "supply", "warehouse"] },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

activityNotificationSchema.index({ createdAt: -1 });

export default mongoose.model("ActivityNotification", activityNotificationSchema);
