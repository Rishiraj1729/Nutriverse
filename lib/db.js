const crypto = require("crypto");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "contact@thenutriverse.in").toLowerCase();

function supabaseConfig() {
  return {
    url: (process.env.SUPABASE_URL || "https://ehixlqplmgymdwhsshzy.supabase.co").replace(/\/$/, ""),
    anonKey: process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaXhscXBsbWd5bWR3aHNzaHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzMzNTEsImV4cCI6MjA5MjEwOTM1MX0.-8v-8VklPDB5AvUsKctFQjIgyiMfA4PBo4q3SSjVhao"
  };
}

function restHeaders(accessToken) {
  const { anonKey } = supabaseConfig();
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken || anonKey}`,
    "Content-Type": "application/json"
  };
  return headers;
}

async function getUser(accessToken) {
  const { url, anonKey } = supabaseConfig();
  if (!url || !anonKey || !accessToken) return null;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!res.ok) return null;
  return res.json();
}

function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

async function saveOrder(order, accessToken) {
  const { url, anonKey } = supabaseConfig();
  if (!url || !anonKey) return { saved: false };
  const user = await getUser(accessToken);
  const row = {
    id: order.id,
    user_id: user ? user.id : null,
    status: order.status === "paid" ? "paid" : "pending",
    payment: order.payment,
    subtotal: order.totals.subtotal,
    shipping: order.totals.shipping,
    total: order.totals.total,
    customer: order.customer,
    items: order.totals.lines
  };
  if (!user) return { saved: false, reason: "login" };
  const res = await fetch(`${url}/rest/v1/orders`, {
    method: "POST",
    headers: { ...restHeaders(accessToken), Prefer: "return=minimal" },
    body: JSON.stringify(row)
  });
  return { saved: res.ok, status: res.status };
}

async function listMyOrders(accessToken) {
  const { url } = supabaseConfig();
  const user = await getUser(accessToken);
  if (!user) return { error: "Please log in.", status: 401 };
  const res = await fetch(
    `${url}/rest/v1/orders?user_id=eq.${user.id}&select=*&order=created_at.desc`,
    { headers: restHeaders(accessToken) }
  );
  if (!res.ok) return { error: "Could not load orders.", status: 500 };
  return { orders: await res.json() };
}

function isAdminEmail(email) {
  return String(email || "").toLowerCase() === ADMIN_EMAIL;
}

async function listAllOrders(accessToken) {
  const { url } = supabaseConfig();
  const user = await getUser(accessToken);
  if (!user) return { error: "Please log in.", status: 401 };
  if (!isAdminEmail(user.email)) return { error: "Admin only.", status: 403 };
  const res = await fetch(`${url}/rest/v1/orders?select=*&order=created_at.desc`, {
    headers: restHeaders(accessToken)
  });
  if (!res.ok) return { error: "Could not load orders.", status: 500 };
  return { orders: await res.json() };
}

async function updateOrderStatus(accessToken, id, status) {
  const { url } = supabaseConfig();
  const user = await getUser(accessToken);
  if (!user) return { error: "Please log in.", status: 401 };
  if (!isAdminEmail(user.email)) return { error: "Admin only.", status: 403 };
  const allowed = ["pending", "paid", "packed", "shipped", "delivered", "cancelled"];
  if (!allowed.includes(status)) return { error: "Invalid status.", status: 400 };
  const res = await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...restHeaders(accessToken), Prefer: "return=minimal" },
    body: JSON.stringify({ status })
  });
  if (!res.ok) return { error: "Could not update order.", status: 500 };
  return { ok: true };
}

function adminCookieSecret() {
  return process.env.ADMIN_PASSWORD || process.env.SUPABASE_ANON_KEY || "nutriverse-admin";
}

function signAdmin() {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const sig = crypto.createHmac("sha256", adminCookieSecret()).update(String(exp)).digest("hex");
  return `${exp}.${sig}`;
}

function checkAdminCookie(req) {
  const raw = String(req.headers.cookie || "")
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("nv_admin="));
  if (!raw) return false;
  const token = raw.slice("nv_admin=".length);
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = crypto.createHmac("sha256", adminCookieSecret()).update(String(exp)).digest("hex");
  return expected === sig;
}

module.exports = {
  ADMIN_EMAIL,
  supabaseConfig,
  getUser,
  bearer,
  saveOrder,
  listMyOrders,
  listAllOrders,
  updateOrderStatus,
  isAdminEmail,
  signAdmin,
  checkAdminCookie
};
