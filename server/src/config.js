import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function env(name, fallback) {
  const value = process.env[name] ?? (process.env.NODE_ENV === "production" ? undefined : fallback);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT || 4100),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173,https://kasistock.vercel.app,https://spaza-osclient-production.up.railway.app")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: env("JWT_SECRET", "dev-only-spaza-access-secret-change-me"),
  refreshSecret: env("REFRESH_SECRET", "dev-only-spaza-refresh-secret-change-me"),
  databasePath: path.resolve(root, process.env.DATABASE_PATH || "./data/spaza-os.sqlite")
};
