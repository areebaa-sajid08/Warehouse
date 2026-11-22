import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import authRoutes from "./routes/auth.routes.js";
import apiRoutes from "./routes/api.routes.js";
import connectDB from "./db/db.js";

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || "").split(","),
].filter((origin) => typeof origin === "string").map((origin) => origin.trim()).filter(Boolean);
function isTrustedOrigin(origin) {
  return !origin
    || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
    || allowedOrigins.includes(origin);
}
app.use(cors({
  origin: (origin, cb) => cb(null, isTrustedOrigin(origin)),
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !isTrustedOrigin(req.get("origin"))) {
    return res.status(403).json({ message: "Untrusted request origin" });
  }
  return next();
});
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Try again later." },
});
app.use("/api/auth/login", authRateLimit);
app.use("/api/auth/register", authRateLimit);
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(503).json({ message: "Database unavailable. Check the backend MongoDB configuration and network access." });
  }
});
app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  if (status >= 500) console.error("Unhandled API error:", error.message);
  res.status(status).json({ message: status >= 500 ? "Internal server error" : error.message });
});

export default app;