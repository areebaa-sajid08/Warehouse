import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import apiRoutes from "./routes/api.routes.js";

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    const localOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || "");
    const allowedOrigins = [process.env.FRONTEND_URL, "https://warehouse-d6el.vercel.app"];
    const configuredOrigin = allowedOrigins.includes(origin);
    cb(null, !origin || localOrigin || configuredOrigin);
  },
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.status || 500).json({ message: error.message || "Internal server error" });
});

export default app;