import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/users.model.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { publishActivityNotification } from "../services/activityNotifications.js";

const router = express.Router();
const publicRoles = ["supplier", "salesRepresentative"];
const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
};

router.post("/register", async (req, res) => {
  try {
    const body = req.body || {};
    const { name, password, phone = "", role = "salesRepresentative" } = body;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (typeof name !== "string" || !name.trim() || !email || typeof password !== "string") {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (!publicRoles.includes(role)) return res.status(403).json({ message: "Public registration cannot create this role" });
    if (await User.exists({ email })) return res.status(409).json({ message: "Email already registered" });
    if (!process.env.JWT_SECRET) {
      console.error("Registration failed: JWT_SECRET is not configured");
      return res.status(500).json({ message: "Authentication is not configured on the server" });
    }
    const user = await User.create({ username: email, name, email, password: await bcrypt.hash(password, 12), phone, role });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { ...sessionCookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    await publishActivityNotification({ actorId: user._id, title: "New account created", message: `${user.name} joined as ${user.role}.`, category: "account" });
    res.status(201).json({ message: "Registered successfully", user: await User.findById(user._id) });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(409).json({ message: field === "email" ? "Email already registered" : "Account identifier already in use" });
    }
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    console.error("Registration failed:", error.message);
    res.status(500).json({ message: "Unable to create the account right now" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user || typeof password !== "string" || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!process.env.JWT_SECRET) {
      console.error("Login failed: JWT_SECRET is not configured");
      return res.status(500).json({ message: "Authentication is not configured on the server" });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { ...sessionCookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    user.password = undefined;
    await publishActivityNotification({
      actorId: user._id,
      title: "User signed in",
      message: `${user.name} signed in.`,
      category: "account",
      dedupeKey: `login:${user._id}`,
    });
    res.json({ message: "Login successful", user });
  } catch (error) {
    console.error("Login failed:", error.message);
    res.status(500).json({ message: "Unable to sign in right now" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", sessionCookieOptions);
  res.json({ message: "Logged out successfully" });
});

router.get("/me", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).populate("assignedWarehouses");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});

export default router;