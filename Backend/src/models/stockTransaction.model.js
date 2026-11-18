import mongoose from "mongoose";

const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
  transactionType: { type: String, enum: ["stock-in", "stock-out"], required: true },
  quantity: { type: Number, required: true, min: 1 },
  note: { type: String, default: "" },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, default: Date.now }
});

export default mongoose.model("StockTransaction", schema);
