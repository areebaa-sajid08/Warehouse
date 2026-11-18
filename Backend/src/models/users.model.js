import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, trim: true, unique: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, default: "" },
  role: {
    type: String,
    required: true,
    enum: ["admin", "warehouseManager", "supplier", "salesRepresentative"]
  },
  assignedWarehouses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Warehouse" }],
  image: { type: String, default: "" },
  imageFileId: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
