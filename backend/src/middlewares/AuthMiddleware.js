import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { findUserByIdInMemory } from "../services/dbFallback.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Auth middleware - checking authorization header");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("No valid Bearer token found");
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    console.log("Token found, verifying...");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token verified, userId:", decoded.userId);

    let user = await User.findById(decoded.userId).select("-password");

    if (!user && process.env.NODE_ENV === "development") {
      const memoryUser = findUserByIdInMemory(decoded.userId);
      if (memoryUser) {
        user = memoryUser;
        console.log(`User found in-memory (middleware): ${user.phone}`);
      }
    }

    if (!user) {
      console.error("User not found for userId:", decoded.userId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User authenticated:", user._id);
    req.user = user;
    next();
  } catch (error) {
    console.error("Error in auth middleware:", error.message);

    // Handle JWT-specific errors
    if (error.name === "TokenExpiredError") {
      console.error("Token expired");
      return res
        .status(401)
        .json({ message: "Token expired. Please login again." });
    }

    if (error.name === "JsonWebTokenError") {
      console.error("Invalid token");
      return res
        .status(401)
        .json({ message: "Invalid token. Please login again." });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
};
