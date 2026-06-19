import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  ShoppingBasket,
  Store,
  Truck
} from "lucide-react";
import { api, ApiError, setAccessToken } from "./lib/api.js";
import "./styles.css";

const tabs = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["products", "Stock", Package],
  ["sales", "Sales", ShoppingBasket],
  ["suppliers", "Suppliers", Truck],
  ["compliance", "Compliance", ClipboardCheck],
  ["orders", "Orders", MessageCircle]
];

const adminTab = ["admin", "Admin", Store];

function App() {
  const [auth, setAuth] = useState({ loading: true, user: null });
  const [token, setToken] = useState("");

  useEffect(() => {
    api("/api/auth/refresh", { method: "POST" })
      .then((data) => {
        setAccessToken(data.accessToken);
        setToken(data.accessToken);
        setAuth({ loading: false, user: data.user });
      })
      .catch(() => setAuth({ loading: false, user: null }));
  }, []);

  if (auth.loading) return <Splash />;
  if (!auth.user) return <Login onAuth={(data) => {
    setAccessToken(data.accessToken);
    setToken(data.accessToken);
    setAuth({ loading: false, user: data.user });
  }} />;

  return <Shell user={auth.user} token={token} onLogout={async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    setAccessToken("");
    setToken("");
    setAuth({ loading: false, user: null });
  }} />;
}

function Splash() {
  return <main className="splash"><div className="mark">K</div><p>Opening shop book</p></main>;
}

function Login({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "login"
      ? { email: form.get("email"), password: form.get("password") }
      : {
          shopName: form.get("shopName"),
          ownerName: form.get("ownerName"),
          email: form.get("email"),
          password: form.get("password"),
          phone: form.get("phone"),
          language: form.get("language"),
          termsAccepted: form.get("termsAccepted") === "on"
        };
    try {
      onAuth(await api(path, { method: "POST", body }));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-copy">
        <div className="brand-row"><span className="mark">K</span><strong>KasiStock</strong></div>
        <div>
          <p className="launch-pill">30 days free · then R99/month</p>
          <h1>The simple shop book for spaza owners.</h1>
          <p>Know what sold, what is running out, what is expiring, and what to reorder from one phone.</p>
          <div className="hero-actions">
            <button className="light-btn" type="button" onClick={() => setMode("register")}>Start Free Trial</button>
          <a className="ghost-link" href="https://wa.me/?text=Hi%2C%20I%20want%20setup%20help%20for%20KasiStock." target="_blank" rel="noreferrer">Get Setup Help</a>
          </div>
        </div>
        <div className="proof-grid">
          <span>Stock + sales ledger</span>
          <span>Expiry + reorder alerts</span>
          <span>WhatsApp order text</span>
        </div>
        <div className="pricing-strip">
          <strong>R99/month</strong>
          <span>R299 assisted setup</span>
          <small>No payment needed for the trial.</small>
        </div>
      </section>
      <form className="auth-panel" onSubmit={submit}>
        <p className="panel-note">{mode === "login" ? "Use the demo login or open your shop." : "Create a trial shop. First 30 days are free."}</p>
        <div className="switcher">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create shop</button>
        </div>
        {mode === "register" && (
          <>
            <label>Shop name<input name="shopName" required /></label>
            <label>Owner name<input name="ownerName" required /></label>
            <label>Phone<input name="phone" inputMode="tel" defaultValue="+27 " /></label>
            <label>Language<select name="language"><option value="en">English</option><option value="zu">isiZulu</option><option value="xh">isiXhosa</option><option value="af">Afrikaans</option><option value="st">Sesotho</option></select></label>
            <label className="consent-row"><input name="termsAccepted" type="checkbox" required /> I agree to the Terms and Privacy Policy.</label>
          </>
        )}
        <label>Email<input name="email" type="email" required defaultValue={mode === "login" ? "owner@spaza.local" : ""} /></label>
        <label>Password<input name="password" type="password" required defaultValue={mode === "login" ? "spaza12345" : ""} /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-btn" disabled={busy}>{busy ? "Working" : mode === "login" ? "Open Shop" : "Create Shop"}</button>
        <div className="legal-links">
          <a href="/privacy.html" target="_blank">Privacy</a>
          <a href="/terms.html" target="_blank">Terms</a>
        </div>
      </form>
    </main>
  );
}

function Shell({ user, onLogout }) {
  const [active, setActive] = useState("dashboard");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const [summary, products, sales, suppliers, compliance, orders] = await Promise.all([
        api("/api/summary"),
        api("/api/products"),
        api("/api/sales"),
        api("/api/suppliers"),
        api("/api/compliance"),
        api("/api/orders")
      ]);
      setData({ summary, products: products.data, sales: sales.data, suppliers: suppliers.data, compliance: compliance.data, orders: orders.data });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const content = useMemo(() => {
    if (busy && !data) return <LoadingState />;
    if (error) return <ErrorState error={error} onRetry={refresh} />;
    if (!data) return null;
    const props = { data, refresh };
    if (active === "admin") return <Admin />;
    if (active === "dashboard") return <Dashboard {...props} />;
    if (active === "products") return <Products {...props} />;
    if (active === "sales") return <Sales {...props} />;
    if (active === "suppliers") return <Suppliers {...props} />;
    if (active === "compliance") return <Compliance {...props} />;
    return <Orders {...props} shopName={user.shopName} />;
  }, [active, busy, data, error]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row"><span className="mark">K</span><div><strong>KasiStock</strong><small>{user.shopName}</small></div></div>
        <div className="plan-card">
          <strong>{user.planName === "trial" ? "Free trial" : user.planName}</strong>
          <small>{user.trialEndsAt ? `Trial ends ${user.trialEndsAt}` : "R99/month main plan"}</small>
        </div>
        <nav>
          {[...tabs, ...(user.role === "admin" ? [adminTab] : [])].map(([id, label, Icon]) => <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><Icon size={18} />{label}</button>)}
        </nav>
        <button className="logout" onClick={onLogout}><LogOut size={18} />Sign out</button>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">Shop command center</p><h2>{tabs.find(([id]) => id === active)?.[1]}</h2></div>
          <button className="secondary-btn" onClick={refresh}><RefreshCw size={17} />Refresh</button>
        </header>
        {content}
      </main>
    </div>
  );
}

function Admin() {
  const [shops, setShops] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      setShops((await api("/api/admin/shops")).data);
    } catch (err) {
      setError(messageFor(err));
    }
  }

  async function updateShop(shop, patch) {
    await api(`/api/admin/shops/${shop.id}`, {
      method: "PATCH",
      body: { planName: patch.planName || shop.planName, paymentStatus: patch.paymentStatus || shop.paymentStatus }
    });
    load();
  }

  useEffect(() => { load(); }, []);

  return (
    <Panel title="Master Account" eyebrow="Shops and payments">
      {error && <p className="form-error">{error}</p>}
      <List empty="No shops yet">
        {shops.map((shop) => (
          <div className="admin-row" key={shop.id}>
            <div>
              <strong>{shop.shopName}</strong>
              <small>{shop.ownerName} · {shop.email} · {shop.phone || "no phone"}</small>
              <small>{shop.productCount} products · {shop.saleCount} sales · {money(shop.revenueTotal)} total · last sale {shop.lastSaleAt || "none"}</small>
            </div>
            <select value={shop.planName} onChange={(event) => updateShop(shop, { planName: event.target.value })}>
              <option value="trial">trial</option>
              <option value="lite">lite</option>
              <option value="pro">pro</option>
              <option value="plus">plus</option>
              <option value="cancelled">cancelled</option>
            </select>
            <select value={shop.paymentStatus} onChange={(event) => updateShop(shop, { paymentStatus: event.target.value })}>
              <option value="trial">trial</option>
              <option value="paid">paid</option>
              <option value="overdue">overdue</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>
        ))}
      </List>
    </Panel>
  );
}

function Dashboard({ data }) {
  const m = data.summary.metrics;
  return (
    <>
      <section className="metrics-grid">
        <Metric label="Revenue today" value={money(m.revenueToday)} note={`${m.salesCount} recent entries`} />
        <Metric label="Low stock" value={m.lowStockCount} note="At or below reorder level" />
        <Metric label="Expiry risk" value={m.expiryRiskCount} note="Expires within 14 days" />
        <Metric label="Compliance" value={`${m.complianceScore}%`} note={`Inventory value ${money(m.inventoryValue)}`} />
      </section>
      <section className="content-grid">
        <Panel title="Action Queue" eyebrow="Do this next">
          <List empty="No urgent work right now">
            {data.summary.alerts.map((item, index) => <AlertRow key={index} item={item} />)}
          </List>
        </Panel>
        <Panel title="Recent Sales" eyebrow="Ledger">
          <List empty="No sales yet">
            {data.summary.recentSales.map((sale) => <Row key={sale.id} title={`${sale.productName} x ${sale.quantity}`} note={`${sale.paymentMethod} · ${new Date(sale.createdAt).toLocaleString()}`} badge={money(sale.total)} />)}
          </List>
        </Panel>
      </section>
    </>
  );
}

function Products({ data, refresh }) {
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/products", { method: "POST", body: formObject(form, ["quantity", "reorderLevel", "costPrice", "sellPrice"]) });
    event.currentTarget.reset();
    refresh();
  }
  return (
    <section className="content-grid">
      <Panel title="Add Stock Item" eyebrow="Inventory">
        <DataForm onSubmit={submit}>
          <label>Item name<input name="name" required /></label>
          <label>Category<input name="category" required defaultValue="General" /></label>
          <div className="two-col"><label>Quantity<input name="quantity" type="number" min="0" required /></label><label>Reorder level<input name="reorderLevel" type="number" min="0" required /></label></div>
          <div className="two-col"><label>Cost price<input name="costPrice" type="number" min="0" step="0.01" required /></label><label>Sell price<input name="sellPrice" type="number" min="0" step="0.01" required /></label></div>
          <label>Expiry date<input name="expiryDate" type="date" /></label>
          <label>Supplier<input name="supplier" /></label>
          <button className="primary-btn"><Plus size={17} />Save Item</button>
        </DataForm>
      </Panel>
      <Panel title="Stock Book" eyebrow="Live products">
        <List empty="No products yet">
          {data.products.map((p) => <Row key={p.id} title={p.name} note={`${p.category} · ${p.quantity} units · margin ${money(p.sellPrice - p.costPrice)}${p.expiryDate ? ` · exp ${p.expiryDate}` : ""}`} badge={p.quantity <= p.reorderLevel ? "Reorder" : money(p.sellPrice)} danger={p.quantity <= p.reorderLevel} />)}
        </List>
      </Panel>
    </section>
  );
}

function Sales({ data, refresh }) {
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/sales", { method: "POST", body: formObject(form, ["quantity"]) });
    event.currentTarget.reset();
    refresh();
  }
  return (
    <section className="content-grid">
      <Panel title="Record Sale" eyebrow="Deduct stock">
        <DataForm onSubmit={submit}>
          <label>Product<select name="productId" required>{data.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.sellPrice)} · {p.quantity} left</option>)}</select></label>
          <div className="two-col"><label>Quantity<input name="quantity" type="number" min="1" defaultValue="1" required /></label><label>Payment<select name="paymentMethod"><option>Cash</option><option>Card</option><option>Bank transfer</option><option>Account</option><option>Other</option></select></label></div>
          <label>Customer name<input name="customerName" /></label>
          <button className="primary-btn"><Plus size={17} />Add Sale</button>
        </DataForm>
      </Panel>
      <Panel title="Sales Ledger" eyebrow="Latest first">
        <List empty="No sales yet">
          {data.sales.map((sale) => <Row key={sale.id} title={`${sale.productName} x ${sale.quantity}`} note={`${sale.paymentMethod} · ${new Date(sale.createdAt).toLocaleString()}`} badge={money(sale.total)} />)}
        </List>
      </Panel>
    </section>
  );
}

function Suppliers({ data, refresh }) {
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/api/suppliers", { method: "POST", body: formObject(form, ["unitCost", "minimumOrder"]) });
    event.currentTarget.reset();
    refresh();
  }
  return (
    <section className="content-grid">
      <Panel title="Add Supplier Price" eyebrow="Wholesale board">
        <DataForm onSubmit={submit}>
          <label>Supplier<input name="supplierName" required /></label>
          <label>Item<input name="itemName" required /></label>
          <div className="two-col"><label>Unit cost<input name="unitCost" type="number" min="0" step="0.01" required /></label><label>Minimum order<input name="minimumOrder" type="number" min="1" defaultValue="1" required /></label></div>
          <label>Phone<input name="phone" /></label>
          <label>Notes<textarea name="notes" rows="3" /></label>
          <button className="primary-btn"><Plus size={17} />Save Price</button>
        </DataForm>
      </Panel>
      <Panel title="Supplier Comparison" eyebrow="Cheapest first">
        <List empty="No supplier prices yet">
          {data.suppliers.map((s) => <Row key={s.id} title={s.itemName} note={`${s.supplierName} · min ${s.minimumOrder}${s.phone ? ` · ${s.phone}` : ""}`} badge={money(s.unitCost)} />)}
        </List>
      </Panel>
    </section>
  );
}

function Compliance({ data, refresh }) {
  async function toggle(task) {
    await api(`/api/compliance/${task.id}`, { method: "PATCH", body: { done: !task.done } });
    refresh();
  }
  return (
    <Panel title="Compliance Checklist" eyebrow="Permit and food safety">
      <div className="checklist">
        {data.compliance.map((task) => (
          <button className={`check-row ${task.done ? "done" : ""}`} key={task.id} onClick={() => toggle(task)}>
            <span>{task.done ? "Done" : "Open"}</span>
            <strong>{task.label}</strong>
            <small>{task.dueDate ? `Due ${task.dueDate}` : "No due date"}</small>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function Orders({ data, refresh }) {
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const created = await api("/api/orders", { method: "POST", body: formObject(form, ["totalEstimate"]) });
    setMessage(created.data.whatsappText);
    event.currentTarget.reset();
    refresh();
  }
  return (
    <section className="content-grid">
      <Panel title="Create WhatsApp Order" eyebrow="Customer message">
        <DataForm onSubmit={submit}>
          <label>Customer name<input name="customerName" required /></label>
          <label>Phone<input name="phone" inputMode="tel" defaultValue="+27 " required /></label>
          <label>Order notes<textarea name="notes" rows="4" required /></label>
          <label>Total estimate<input name="totalEstimate" type="number" min="0" step="0.01" defaultValue="0" /></label>
          <button className="primary-btn"><MessageCircle size={17} />Generate Message</button>
        </DataForm>
      </Panel>
      <Panel title="Message and History" eyebrow="Ready to send">
        <textarea className="message-box" rows="8" readOnly value={message} />
        <button className="secondary-btn" onClick={() => navigator.clipboard.writeText(message)}><MessageCircle size={17} />Copy Message</button>
        <List empty="No orders yet">
          {data.orders.map((order) => <Row key={order.id} title={order.customerName} note={`${order.phone} · ${new Date(order.createdAt).toLocaleString()}`} badge={order.status} />)}
        </List>
      </Panel>
    </section>
  );
}

function Metric({ label, value, note }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function Panel({ title, eyebrow, children }) {
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div></div>{children}</section>;
}

function List({ children, empty }) {
  return <div className="item-list">{React.Children.count(children) ? children : <div className="empty">{empty}</div>}</div>;
}

function Row({ title, note, badge, danger }) {
  return <div className="row"><div><strong>{title}</strong><small>{note}</small></div>{badge && <span className={`badge ${danger ? "danger" : ""}`}>{badge}</span>}</div>;
}

function AlertRow({ item }) {
  return <div className="row alert"><AlertTriangle size={18} /><div><strong>{item.title}</strong><small>{item.detail}</small></div><span className={`badge ${item.severity === "danger" ? "danger" : "warn"}`}>{item.type}</span></div>;
}

function DataForm({ onSubmit, children }) {
  const [error, setError] = useState("");
  return <form onSubmit={async (event) => { try { setError(""); await onSubmit(event); } catch (err) { setError(messageFor(err)); } }}>{children}{error && <p className="form-error">{error}</p>}</form>;
}

function LoadingState() {
  return <div className="state"><div className="skeleton" /><div className="skeleton short" /><p>Loading shop data</p></div>;
}

function ErrorState({ error, onRetry }) {
  return <div className="state"><AlertTriangle /><p>{error}</p><button className="primary-btn" onClick={onRetry}>Try Again</button></div>;
}

function money(value) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(value || 0));
}

function formObject(form, numbers = []) {
  const body = Object.fromEntries(form.entries());
  for (const key of numbers) body[key] = Number(body[key] || 0);
  return body;
}

function messageFor(err) {
  if (err instanceof ApiError) return err.body?.detail || "Request failed";
  return "Cannot reach the Spaza Shop OS server";
}

createRoot(document.getElementById("root")).render(<App />);
