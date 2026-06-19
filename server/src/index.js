import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { migrate, seed } from "./db.js";
import { AppError } from "./errors.js";
import { logger } from "./logger.js";
import { registerRoutes } from "./routes.js";

migrate();
seed();

const app = express();
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDist = path.resolve(serverRoot, "..", "client", "dist");

app.use((req, res, next) => {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
});
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.clientOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/ready", (_req, res) => res.json({ status: "ok", database: "ok" }));

registerRoutes(app);

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|health|ready).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((req, _res, next) => next(new AppError(`Route not found: ${req.method} ${req.path}`, "NOT_FOUND", 404)));

app.use((err, req, res, _next) => {
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      title: err.code,
      status: err.statusCode,
      detail: err.message,
      details: err.details,
      requestId: req.id
    });
  }
  logger.error({ err, requestId: req.id }, "Unexpected server error");
  res.status(500).json({ title: "INTERNAL_ERROR", status: 500, detail: "Something went wrong", requestId: req.id });
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, clientOrigin: config.clientOrigin }, "KasiStock API started");
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received");
  server.close(() => process.exit(0));
});
