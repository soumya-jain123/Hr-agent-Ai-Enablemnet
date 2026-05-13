require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const path = require("path");

const jobRoutes = require("./routes/jobs");
const candidateRoutes = require("./routes/candidates");
const reportRoutes = require("./routes/reports");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security middleware ────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? "https://your-production-domain.com"
    : "http://localhost:5173",
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "x-api-key"],
}));

// Global rate limiter: 60 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
app.use(globalLimiter);

// Stricter limiter for LLM-heavy agent routes
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Agent rate limit reached. Max 10 pipeline runs per minute." },
});

app.use(express.json({ limit: "1mb" }));

// ─── Health check (no auth required) ───────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "HR Agent API",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// ─── Routes ────────────────────────────────────────────────────
app.use("/api/jobs", jobRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/reports", agentLimiter, reportRoutes);

// ─── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
  });
});

// ─── MongoDB connection ────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`🚀 HR Agent server running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
