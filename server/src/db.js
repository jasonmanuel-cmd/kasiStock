import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new DatabaseSync(config.databasePath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      shop_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT,
      language TEXT NOT NULL DEFAULT 'en',
      plan_name TEXT NOT NULL DEFAULT 'trial',
      payment_status TEXT NOT NULL DEFAULT 'trial',
      trial_ends_at TEXT,
      terms_accepted_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_id TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      sku TEXT,
      quantity INTEGER NOT NULL,
      reorder_level INTEGER NOT NULL,
      cost_price REAL NOT NULL,
      sell_price REAL NOT NULL,
      expiry_date TEXT,
      supplier TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      customer_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      supplier_name TEXT NOT NULL,
      item_name TEXT NOT NULL,
      unit_cost REAL NOT NULL,
      minimum_order INTEGER NOT NULL,
      phone TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS compliance_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      due_date TEXT,
      done INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      notes TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total_estimate REAL DEFAULT 0,
      whatsapp_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ensureColumn("users", "plan_name", "TEXT NOT NULL DEFAULT 'trial'");
  ensureColumn("users", "payment_status", "TEXT NOT NULL DEFAULT 'trial'");
  ensureColumn("users", "trial_ends_at", "TEXT");
  ensureColumn("users", "terms_accepted_at", "TEXT");
  db.prepare("UPDATE users SET trial_ends_at = ? WHERE trial_ends_at IS NULL").run(daysFromNow(30));
}

export function seed() {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get("owner@spaza.local");
  if (existing) return existing.id;

  const userId = nanoid();
  const passwordHash = bcrypt.hashSync("spaza12345", 12);
  db.prepare(`
    INSERT INTO users (id, shop_name, owner_name, email, password_hash, phone, language, trial_ends_at, terms_accepted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(userId, "Mthembu Mini Market", "Thando Mthembu", "owner@spaza.local", passwordHash, "+27 82 000 0000", "en", daysFromNow(30));

  const products = [
    ["Bread 700g", "Bakery", "BRD-700", 18, 8, 12.5, 16, daysFromNow(3), "Local Bakery"],
    ["Milk 1L", "Dairy", "MLK-1L", 10, 10, 15, 19.5, daysFromNow(7), "Metro Dairy"],
    ["Maize meal 5kg", "Staples", "MM-5KG", 7, 6, 61, 74.99, daysFromNow(90), "Township Wholesalers"],
    ["Cooking oil 2L", "Staples", "OIL-2L", 5, 8, 47, 58, daysFromNow(120), "Jozi Cash & Carry"],
    ["Airtime voucher R20", "Airtime", "AIR-20", 42, 12, 19, 20, null, "Voucher Network"],
    ["Paraffin 1L", "Household", "PAR-1L", 9, 8, 17, 22, null, "Energy Depot"]
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (id, user_id, name, category, sku, quantity, reorder_level, cost_price, sell_price, expiry_date, supplier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of products) insertProduct.run(nanoid(), userId, ...row);

  const suppliers = [
    ["Jozi Cash & Carry", "Cooking oil 2L", 46.5, 12, "+27 11 000 1111", "Best oil price when buying a case."],
    ["Township Wholesalers", "Maize meal 5kg", 60.5, 10, "+27 11 000 2222", "Ask for delivery when order is over R1,500."],
    ["Metro Dairy", "Milk 1L", 14.75, 24, "+27 11 000 3333", "Delivers Tuesday and Friday."]
  ];
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (id, user_id, supplier_name, item_name, unit_cost, minimum_order, phone, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of suppliers) insertSupplier.run(nanoid(), userId, ...row);

  const tasks = [
    ["Municipal trading permit available in shop", daysFromNow(30), 1],
    ["Food and cleaning chemicals stored separately", daysFromNow(7), 1],
    ["Expired items removed from shelves every morning", daysFromNow(1), 0],
    ["Pest-control log checked this month", daysFromNow(14), 0],
    ["Shelf prices visible and match till prices", daysFromNow(5), 1],
    ["Supplier invoices kept for traceability", daysFromNow(10), 0]
  ];
  const insertTask = db.prepare(`
    INSERT INTO compliance_tasks (id, user_id, label, due_date, done)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const row of tasks) insertTask.run(nanoid(), userId, ...row);

  return userId;
}

export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = fn();
    db.exec("COMMIT;");
    return result;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function ensureColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
