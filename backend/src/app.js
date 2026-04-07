import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import creditRouter from "./routes/credit.js";
import loanRouter from "./routes/loan.js";
import adminRouter from "./routes/admin.js";
import borrowerProfileRouter from "./routes/borrowerProfile.js";
import chatRouter from "./routes/chatRoutes.js";
import { getModelReadiness } from "./services/mlService.js";

const app = express();

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow any localhost origin (for development)
    if (
      !origin ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1")
    ) {
      callback(null, true);
    } else if (process.env.ALLOWED_ORIGINS) {
      const allowed = process.env.ALLOWED_ORIGINS.split(",");
      if (allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    } else {
      // Default allowed origins
      const defaultAllowed = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
      ];
      if (defaultAllowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

app.use(
  express.json({
    limit: "16kb", //form ke data ke liye
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "16kb", //url ke data ke liye
  })
);
app.use(express.static("public")); // Serve static files from the 'public' directory

app.use(cookieParser());

app.use("/api/auth", (await import("./routes/auth.js")).default);
app.use("/api/user", (await import("./routes/user.js")).default);
app.use("/api/credit", creditRouter);
app.use("/api/loan", loanRouter);
app.use("/api/admin", adminRouter);
app.use("/api/profile", borrowerProfileRouter);
app.use("/api", chatRouter);

app.get("/api/health", async (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const model = await getModelReadiness();

  return res.status(200).json({
    service: "credit-backend",
    status: "ok",
    timestamp: new Date().toISOString(),
    checks: {
      database: dbReady ? "up" : "down",
      model: model.ready ? "up" : "down",
    },
  });
});

app.get("/api/health/ready", async (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const model = await getModelReadiness();
  const ready = dbReady && model.ready;

  return res.status(ready ? 200 : 503).json({
    ready,
    timestamp: new Date().toISOString(),
    database: {
      ready: dbReady,
      state: mongoose.connection.readyState,
    },
    model,
  });
});

app.get("/", (req, res) => {
  res.json({ message: "CREDIT running" });
});

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global Error:", err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

export { app };

console.log("App loaded with CORS:", corsOptions.origin);
// Trigger restart
