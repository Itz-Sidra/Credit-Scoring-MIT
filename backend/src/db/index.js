import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

export const connectDB = async () => {
  try {
    const mongoUri = (process.env.MONGO_URI || "").trim();

    if (!mongoUri) {
      throw new Error("MONGO_URI is not set");
    }

    const uriWithoutProtocol = mongoUri.split("://")[1] || "";
    const pathPart = uriWithoutProtocol.split("/").slice(1).join("/");
    const hasDatabaseInUri = pathPart.length > 0 && !pathPart.startsWith("?");

    const finalMongoUri = hasDatabaseInUri
      ? mongoUri
      : `${mongoUri.replace(/\/$/, "")}/${DB_NAME}`;

    try {
      const connectionInstance = await mongoose.connect(finalMongoUri, {
        serverSelectionTimeoutMS: 5000, // 5 second timeout
      });
      console.log(
        `✓ Connected to MongoDB successfully. DB Host: ${connectionInstance.connection.host}`
      );
    } catch (mongoError) {
      // In development, don't crash if MongoDB is unavailable
      if (process.env.NODE_ENV === "development") {
        console.warn("⚠ MongoDB connection failed, running in offline mode");
        console.warn("  Error:", mongoError.message);
        console.warn(
          "  Note: Auth endpoints will work but data will not persist"
        );
        return; // Don't exit, let the server continue
      } else {
        throw mongoError;
      }
    }
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);

    // In development, don't crash the server
    if (process.env.NODE_ENV !== "development") {
      process.exit(1);
    }
  }
};

export default connectDB;
