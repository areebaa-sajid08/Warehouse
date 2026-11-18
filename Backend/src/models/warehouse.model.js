import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  capacity: { type: Number, required: true, min: 0 }
}, { timestamps: true });

export default mongoose.model("Warehouse", schema);
