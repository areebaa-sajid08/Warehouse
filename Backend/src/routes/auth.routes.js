import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/users.model.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";

const router = express.Router();
const publicRoles = ["warehouseManager", "supplier", "salesRepresentative"];

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone = "", role = "salesRepresentative" } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });
    if (!publicRoles.includes(role)) return res.status(403).json({ message: "Public registration cannot create this role" });
    if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ message: "Email already registered" });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), phone, role });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ message: "Registered successfully", token, user: await User.findById(user._id) });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() }).select("+password");
    if (!user || !(await bcrypt.compare(password || "", user.password))) return res.status(401).json({ message: "Invalid email or password" });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    user.password = undefined;
    res.json({ message: "Login successful", token, user });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

router.get("/me", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).populate("assignedWarehouses");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});

export default router;