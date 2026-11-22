import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
  category: { type: String, default: "" },
  price: { type: Number, required: true, min: 0 },
  lowStockLimit: { type: Number, required: true, min: 0 },
  imageUrl: { type: String, default: "" },
  imageFileId: { type: String, default: "" },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  archivedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

productSchema.index({ archivedAt: 1, createdAt: -1 });

export default mongoose.model("Product", productSchema);
