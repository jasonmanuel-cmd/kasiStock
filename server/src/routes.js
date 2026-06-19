import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db, transaction } from "./db.js";
import { clearRefreshCookie, createAccessToken, createRefreshToken, requireAuth, setRefreshCookie, verifyRefreshToken } from "./auth.js";
import { AppError, NotFoundError, UnauthorizedError, ValidationError } from "./errors.js";

const productSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2).default("General"),
  sku: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(0),
  reorderLevel: z.coerce.number().int().min(0),
  costPrice: z.coerce.number().min(0),
  sellPrice: z.coerce.number().min(0),
  expiryDate: z.string().optional().nullable(),
  supplier: z.string().optional().nullable()
}).refine((data) => data.sellPrice >= data.costPrice, { message: "Selling price cannot be below cost price", path: ["sellPrice"] });

const saleSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  paymentMethod: z.enum(["Cash", "Card", "Bank transfer", "Account", "Other"]).default("Cash"),
  customerName: z.string().optional().nullable()
});

const supplierSchema = z.object({
  supplierName: z.string().min(2),
  itemName: z.string().min(2),
  unitCost: z.coerce.number().min(0),
  minimumOrder: z.coerce.number().int().min(1),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

const orderSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().min(6),
  notes: z.string().min(2),
  totalEstimate: z.coerce.number().min(0).default(0)
});

function validate(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError(result.error.flatten());
  return result.data;
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    sku: row.sku,
    quantity: row.quantity,
    reorderLevel: row.reorder_level,
    costPrice: row.cost_price,
    sellPrice: row.sell_price,
    expiryDate: row.expiry_date,
    supplier: row.supplier,
    updatedAt: row.updated_at
  };
}

function mapSupplier(row) {
  return {
    id: row.id,
    supplierName: row.supplier_name,
    itemName: row.item_name,
    unitCost: row.unit_cost,
    minimumOrder: row.minimum_order,
    phone: row.phone,
    notes: row.notes,
    updatedAt: row.updated_at
  };
}

export function registerRoutes(app) {
  app.post("/api/auth/register", (req, res, next) => {
    try {
      const body = validate(z.object({
        shopName: z.string().min(2),
        ownerName: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        phone: z.string().optional().nullable(),
        language: z.string().default("en"),
        termsAccepted: z.literal(true)
      }), req.body);
      const id = nanoid();
      const passwordHash = bcrypt.hashSync(body.password, 12);
      db.prepare(`
        INSERT INTO users (id, shop_name, owner_name, email, password_hash, phone, language, trial_ends_at, terms_accepted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(id, body.shopName, body.ownerName, body.email.toLowerCase(), passwordHash, body.phone || null, body.language, trialEndDate());
      seedCompliance(id);
      const user = db.prepare("SELECT id, shop_name, owner_name, email, phone, language, role, plan_name, payment_status, trial_ends_at FROM users WHERE id = ?").get(id);
      const accessToken = createAccessToken(user);
      setRefreshCookie(res, createRefreshToken(user.id));
      res.status(201).json({ user: mapUser(user), accessToken });
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) return next(new AppError("Email is already registered", "EMAIL_EXISTS", 409));
      next(error);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    try {
      const body = validate(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body);
      const userWithPassword = db.prepare("SELECT * FROM users WHERE email = ?").get(body.email.toLowerCase());
      if (!userWithPassword || !bcrypt.compareSync(body.password, userWithPassword.password_hash)) throw new UnauthorizedError("Invalid email or password");
      const user = db.prepare("SELECT id, shop_name, owner_name, email, phone, language, role, plan_name, payment_status, trial_ends_at FROM users WHERE id = ?").get(userWithPassword.id);
      const accessToken = createAccessToken(user);
      setRefreshCookie(res, createRefreshToken(user.id));
      res.json({ user: mapUser(user), accessToken });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/refresh", (req, res, next) => {
    try {
      const { user } = verifyRefreshToken(req.cookies.refresh_token);
      res.json({ user: mapUser(user), accessToken: createAccessToken(user) });
    } catch (error) {
      clearRefreshCookie(res);
      next(error);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    clearRefreshCookie(res);
    res.status(204).send();
  });

  app.get("/api/me", requireAuth, (req, res) => {
    res.json({ user: mapUser(req.user) });
  });

  app.get("/api/summary", requireAuth, (req, res) => {
    const products = db.prepare("SELECT * FROM products WHERE user_id = ?").all(req.user.id).map(mapProduct);
    const sales = db.prepare("SELECT * FROM sales WHERE user_id = ? ORDER BY created_at DESC LIMIT 25").all(req.user.id);
    const compliance = db.prepare("SELECT * FROM compliance_tasks WHERE user_id = ?").all(req.user.id);
    const today = new Date().toISOString().slice(0, 10);
    const revenueToday = sales.filter((sale) => sale.created_at.slice(0, 10) === today).reduce((sum, sale) => sum + sale.total, 0);
    const lowStock = products.filter((item) => item.quantity <= item.reorderLevel);
    const expiryRisk = products.filter((item) => item.expiryDate && daysUntil(item.expiryDate) <= 14);
    const complianceScore = compliance.length ? Math.round((compliance.filter((item) => item.done).length / compliance.length) * 100) : 0;
    const alerts = [
      ...lowStock.map((item) => ({ type: "stock", severity: item.quantity === 0 ? "danger" : "warn", title: `Reorder ${item.name}`, detail: `${item.quantity} left. Reorder level is ${item.reorderLevel}.` })),
      ...expiryRisk.map((item) => ({ type: "expiry", severity: daysUntil(item.expiryDate) <= 3 ? "danger" : "warn", title: `Expiry risk: ${item.name}`, detail: `Expires ${item.expiryDate}.` })),
      ...compliance.filter((item) => !item.done).slice(0, 4).map((item) => ({ type: "compliance", severity: "warn", title: "Compliance task", detail: item.label }))
    ];
    res.json({
      metrics: {
        revenueToday,
        lowStockCount: lowStock.length,
        expiryRiskCount: expiryRisk.length,
        complianceScore,
        salesCount: sales.length,
        inventoryValue: products.reduce((sum, item) => sum + item.quantity * item.costPrice, 0)
      },
      alerts,
      recentSales: sales.map(mapSale)
    });
  });

  app.get("/api/products", requireAuth, (req, res) => {
    const rows = db.prepare("SELECT * FROM products WHERE user_id = ? ORDER BY name").all(req.user.id);
    res.json({ data: rows.map(mapProduct) });
  });

  app.post("/api/products", requireAuth, (req, res, next) => {
    try {
      const product = validate(productSchema, req.body);
      const id = nanoid();
      db.prepare(`
        INSERT INTO products (id, user_id, name, category, sku, quantity, reorder_level, cost_price, sell_price, expiry_date, supplier)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.id, product.name, product.category, product.sku || null, product.quantity, product.reorderLevel, product.costPrice, product.sellPrice, product.expiryDate || null, product.supplier || null);
      res.status(201).json({ data: mapProduct(db.prepare("SELECT * FROM products WHERE id = ?").get(id)) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/products/:id", requireAuth, (req, res, next) => {
    try {
      const product = validate(productSchema.partial(), req.body);
      const existing = db.prepare("SELECT * FROM products WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
      if (!existing) throw new NotFoundError("Product");
      const merged = { ...mapProduct(existing), ...product };
      if (merged.sellPrice < merged.costPrice) throw new ValidationError({ fieldErrors: { sellPrice: ["Selling price cannot be below cost price"] } });
      db.prepare(`
        UPDATE products SET name = ?, category = ?, sku = ?, quantity = ?, reorder_level = ?, cost_price = ?, sell_price = ?, expiry_date = ?, supplier = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(merged.name, merged.category, merged.sku || null, merged.quantity, merged.reorderLevel, merged.costPrice, merged.sellPrice, merged.expiryDate || null, merged.supplier || null, req.params.id, req.user.id);
      res.json({ data: mapProduct(db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id)) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/products/:id", requireAuth, (req, res) => {
    db.prepare("DELETE FROM products WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.status(204).send();
  });

  app.get("/api/sales", requireAuth, (req, res) => {
    const rows = db.prepare("SELECT * FROM sales WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(req.user.id);
    res.json({ data: rows.map(mapSale) });
  });

  app.post("/api/sales", requireAuth, (req, res, next) => {
    try {
      const sale = validate(saleSchema, req.body);
      const result = transaction(() => {
        const product = db.prepare("SELECT * FROM products WHERE id = ? AND user_id = ?").get(sale.productId, req.user.id);
        if (!product) throw new NotFoundError("Product");
        if (product.quantity < sale.quantity) throw new AppError("Not enough stock for this sale", "INSUFFICIENT_STOCK", 409);
        const id = nanoid();
        const total = Number((product.sell_price * sale.quantity).toFixed(2));
        db.prepare("UPDATE products SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(sale.quantity, product.id);
        db.prepare(`
          INSERT INTO sales (id, user_id, product_id, product_name, quantity, unit_price, total, payment_method, customer_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.user.id, product.id, product.name, sale.quantity, product.sell_price, total, sale.paymentMethod, sale.customerName || null);
        return db.prepare("SELECT * FROM sales WHERE id = ?").get(id);
      });
      res.status(201).json({ data: mapSale(result) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/suppliers", requireAuth, (req, res) => {
    const rows = db.prepare("SELECT * FROM suppliers WHERE user_id = ? ORDER BY unit_cost ASC").all(req.user.id);
    res.json({ data: rows.map(mapSupplier) });
  });

  app.post("/api/suppliers", requireAuth, (req, res, next) => {
    try {
      const supplier = validate(supplierSchema, req.body);
      const id = nanoid();
      db.prepare(`
        INSERT INTO suppliers (id, user_id, supplier_name, item_name, unit_cost, minimum_order, phone, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.id, supplier.supplierName, supplier.itemName, supplier.unitCost, supplier.minimumOrder, supplier.phone || null, supplier.notes || null);
      res.status(201).json({ data: mapSupplier(db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id)) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/suppliers/:id", requireAuth, (req, res) => {
    db.prepare("DELETE FROM suppliers WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.status(204).send();
  });

  app.get("/api/compliance", requireAuth, (req, res) => {
    const rows = db.prepare("SELECT * FROM compliance_tasks WHERE user_id = ? ORDER BY due_date").all(req.user.id);
    res.json({ data: rows.map(mapTask) });
  });

  app.patch("/api/compliance/:id", requireAuth, (req, res, next) => {
    try {
      const body = validate(z.object({ done: z.boolean() }), req.body);
      db.prepare("UPDATE compliance_tasks SET done = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?").run(body.done ? 1 : 0, req.params.id, req.user.id);
      const row = db.prepare("SELECT * FROM compliance_tasks WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
      if (!row) throw new NotFoundError("Compliance task");
      res.json({ data: mapTask(row) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/orders", requireAuth, (req, res) => {
    const rows = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(req.user.id);
    res.json({ data: rows.map(mapOrder) });
  });

  app.post("/api/orders", requireAuth, (req, res, next) => {
    try {
      const order = validate(orderSchema, req.body);
      const id = nanoid();
      const whatsappText = [
        `Hi ${order.customerName}, this is ${req.user.shop_name}.`,
        "",
        "Your order request:",
        order.notes,
        order.totalEstimate ? `Estimated total: R${order.totalEstimate.toFixed(2)}` : "",
        "",
        "Please reply YES to confirm. We will send collection or delivery timing."
      ].filter(Boolean).join("\n");
      db.prepare(`
        INSERT INTO orders (id, user_id, customer_name, phone, notes, total_estimate, whatsapp_text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, req.user.id, order.customerName, order.phone, order.notes, order.totalEstimate, whatsappText);
      res.status(201).json({ data: mapOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(id)) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/shops", requireAuth, requireAdmin, (_req, res) => {
    const rows = db.prepare(`
      SELECT
        u.id, u.shop_name, u.owner_name, u.email, u.phone, u.plan_name, u.payment_status, u.trial_ends_at, u.created_at,
        COUNT(DISTINCT p.id) AS product_count,
        COUNT(DISTINCT s.id) AS sale_count,
        COALESCE(SUM(s.total), 0) AS revenue_total,
        MAX(s.created_at) AS last_sale_at
      FROM users u
      LEFT JOIN products p ON p.user_id = u.id
      LEFT JOIN sales s ON s.user_id = u.id
      WHERE u.role != 'admin'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();
    res.json({ data: rows.map(mapAdminShop) });
  });

  app.get("/api/admin/shops/:id", requireAuth, requireAdmin, (req, res, next) => {
    try {
      const shop = db.prepare("SELECT * FROM users WHERE id = ? AND role != 'admin'").get(req.params.id);
      if (!shop) throw new NotFoundError("Shop");
      res.json({
        shop: mapAdminShop({ ...shop, product_count: 0, sale_count: 0, revenue_total: 0, last_sale_at: null }),
        products: db.prepare("SELECT * FROM products WHERE user_id = ? ORDER BY name").all(req.params.id).map(mapProduct),
        sales: db.prepare("SELECT * FROM sales WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(req.params.id).map(mapSale),
        suppliers: db.prepare("SELECT * FROM suppliers WHERE user_id = ? ORDER BY supplier_name").all(req.params.id).map(mapSupplier),
        orders: db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(req.params.id).map(mapOrder)
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/shops/:id", requireAuth, requireAdmin, (req, res, next) => {
    try {
      const body = validate(z.object({
        planName: z.enum(["trial", "lite", "pro", "plus", "cancelled"]),
        paymentStatus: z.enum(["trial", "paid", "overdue", "cancelled"])
      }), req.body);
      db.prepare("UPDATE users SET plan_name = ?, payment_status = ? WHERE id = ? AND role != 'admin'")
        .run(body.planName, body.paymentStatus, req.params.id);
      const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
      if (!row) throw new NotFoundError("Shop");
      res.json({ data: mapUser(row) });
    } catch (error) {
      next(error);
    }
  });
}

function mapUser(row) {
  return {
    id: row.id,
    shopName: row.shop_name,
    ownerName: row.owner_name,
    email: row.email,
    phone: row.phone,
    language: row.language,
    role: row.role,
    planName: row.plan_name,
    paymentStatus: row.payment_status,
    trialEndsAt: row.trial_ends_at
  };
}

function requireAdmin(req, _res, next) {
  if (req.user.role === "admin") return next();
  next(new UnauthorizedError("Admin access required"));
}

function mapAdminShop(row) {
  return {
    id: row.id,
    shopName: row.shop_name,
    ownerName: row.owner_name,
    email: row.email,
    phone: row.phone,
    planName: row.plan_name,
    paymentStatus: row.payment_status,
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    productCount: row.product_count,
    saleCount: row.sale_count,
    revenueTotal: row.revenue_total,
    lastSaleAt: row.last_sale_at
  };
}

function mapSale(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    total: row.total,
    paymentMethod: row.payment_method,
    customerName: row.customer_name,
    createdAt: row.created_at
  };
}

function mapTask(row) {
  return { id: row.id, label: row.label, dueDate: row.due_date, done: Boolean(row.done), updatedAt: row.updated_at };
}

function mapOrder(row) {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    notes: row.notes,
    status: row.status,
    totalEstimate: row.total_estimate,
    whatsappText: row.whatsapp_text,
    createdAt: row.created_at
  };
}

function daysUntil(dateText) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateText) - today) / 86400000);
}

function seedCompliance(userId) {
  const tasks = [
    "Municipal trading permit available in shop",
    "Food and cleaning chemicals stored separately",
    "Expired items removed from shelves every morning",
    "Pest-control log checked this month",
    "Shelf prices visible and match till prices",
    "Supplier invoices kept for traceability"
  ];
  const stmt = db.prepare("INSERT INTO compliance_tasks (id, user_id, label) VALUES (?, ?, ?)");
  for (const task of tasks) stmt.run(nanoid(), userId, task);
}

function trialEndDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}
