import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { db } from "./db.js";
import { config } from "./config.js";
import { UnauthorizedError } from "./errors.js";

const accessTtl = "15m";
const refreshDays = 30;

export function createAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, shopName: user.shop_name }, config.jwtSecret, { expiresIn: accessTtl });
}

export function createRefreshToken(userId) {
  const tokenId = nanoid();
  const expiresAt = new Date(Date.now() + refreshDays * 86400000).toISOString();
  db.prepare("INSERT INTO refresh_sessions (id, user_id, token_id, expires_at) VALUES (?, ?, ?, ?)")
    .run(nanoid(), userId, tokenId, expiresAt);
  return jwt.sign({ sub: userId, jti: tokenId }, config.refreshSecret, { expiresIn: `${refreshDays}d` });
}

export function setRefreshCookie(res, token) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: refreshDays * 86400000
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie("refresh_token");
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next(new UnauthorizedError());
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare("SELECT id, shop_name, owner_name, email, phone, language, plan_name, payment_status, trial_ends_at FROM users WHERE id = ?").get(payload.sub);
    if (!user) throw new UnauthorizedError();
    req.user = user;
    next();
  } catch {
    next(new UnauthorizedError());
  }
}

export function verifyRefreshToken(token) {
  if (!token) throw new UnauthorizedError("Session expired");
  const payload = jwt.verify(token, config.refreshSecret);
  const session = db.prepare("SELECT * FROM refresh_sessions WHERE token_id = ? AND user_id = ?").get(payload.jti, payload.sub);
  if (!session || new Date(session.expires_at) < new Date()) throw new UnauthorizedError("Session expired");
  const user = db.prepare("SELECT id, shop_name, owner_name, email, phone, language, plan_name, payment_status, trial_ends_at FROM users WHERE id = ?").get(payload.sub);
  if (!user) throw new UnauthorizedError("Session expired");
  return { user, tokenId: payload.jti };
}
