import jwt from "jsonwebtoken";
import User from "../models/users.model.js";

export async function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  const token = (header?.startsWith("Bearer ") && header.slice(7)) || req.cookies?.token;
  if (!token) return res.status(401).json({ message: "Authentication required" });

  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired session" });
  }

  try {
    const user = await User.findById(claims.id).select("role");
    if (!user) return res.status(401).json({ message: "Invalid or expired session" });
    req.user = { id: user._id.toString(), role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
