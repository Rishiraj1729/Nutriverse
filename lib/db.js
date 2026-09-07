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
  const value = String(email || "").toLowerCase();
  return value === ADMIN_EMAIL || value === "admin_nutriverse@thenutriverse.in";
}

function isAdminUser(user) {
  if (!user) return false;
  const role = user.app_metadata && user.app_metadata.role;
  if (String(role || "").toLowerCase() === "admin") return true;
  return isAdminEmail(user.email);
}

async function listAllOrders(accessToken) {
  const { url } = supabaseConfig();
  const user = await getUser(accessToken);
  if (!user) return { error: "Please log in.", status: 401 };
  if (!isAdminUser(user)) return { error: "Admin only.", status: 403 };
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
  if (!isAdminUser(user)) return { error: "Admin only.", status: 403 };
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

function bustCatalogCache() {
  try {
    require("./catalog").bustCatalogCache();
  } catch (err) {
    /* ignore circular load */
  }
}

async function requireAdmin(accessToken) {
  const user = await getUser(accessToken);
  if (!user) return { error: "Please log in.", status: 401 };
  if (!isAdminUser(user)) return { error: "Admin only.", status: 403 };
  return { user };
}

const CATEGORIES = ["makhana", "cookies", "raw", "maknova"];

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function safeImage(s) {
  const v = String(s || "").trim();
  if (!v) return "assets/product.png";
  if (v.startsWith("assets/") && !v.includes("..") && !v.includes("\\")) return v;
  try {
    const u = new URL(v);
    if (u.protocol === "http:" || u.protocol === "https:") return v;
  } catch (err) {
    /* ignore */
  }
  return "";
}

function normalizeProduct(body, forInsert) {
  const name = String(body.name || "").trim();
  if (name.length < 2) return { error: "Enter a product name.", status: 400 };
  const id = String(body.id || slugify(name)).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) return { error: "SKU id should be a short slug, like peri-punch.", status: 400 };
  const category = String(body.category || "makhana").toLowerCase();
  if (!CATEGORIES.includes(category)) return { error: "Pick a category.", status: 400 };
  const price = Number(body.price);
  if (!Number.isInteger(price) || price < 1 || price > 99999) return { error: "Price must be a whole rupee amount.", status: 400 };
  const image = safeImage(body.image);
  if (body.image && !image) return { error: "Image must be an assets/ path or an https URL.", status: 400 };
  const row = {
    id,
    name,
    category,
    price,
    unit: String(body.unit || "pack").trim().slice(0, 24) || "pack",
    image: image || "assets/product.png",
    blurb: String(body.blurb || "").trim().slice(0, 180),
    active: body.active !== false && body.active !== "false",
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100,
    updated_at: new Date().toISOString()
  };
  if (!forInsert) delete row.id;
  return { row, id };
}

async function listAdminProducts(accessToken) {
  const admin = await requireAdmin(accessToken);
  if (admin.error) return admin;
  const { url } = supabaseConfig();
  const [prodRes, setRes] = await Promise.all([
    fetch(`${url}/rest/v1/products?select=*&order=sort_order.asc`, { headers: restHeaders(accessToken) }),
    fetch(`${url}/rest/v1/store_settings?id=eq.1&select=*`, { headers: restHeaders(accessToken) })
  ]);
  if (!prodRes.ok) return { error: "Could not load SKUs.", status: 500 };
  const products = await prodRes.json();
  const settingsRows = setRes.ok ? await setRes.json() : [];
  const s = settingsRows[0] || { shipping_flat: 49, free_above: 499 };
  return {
    products,
    settings: { shipping_flat: s.shipping_flat, free_above: s.free_above }
  };
}

async function saveAdminProduct(accessToken, body, isInsert) {
  const admin = await requireAdmin(accessToken);
  if (admin.error) return admin;
  const parsed = normalizeProduct(body, isInsert);
  if (parsed.error) return parsed;
  const { url } = supabaseConfig();
  let res;
  if (isInsert) {
    res = await fetch(`${url}/rest/v1/products`, {
      method: "POST",
      headers: { ...restHeaders(accessToken), Prefer: "return=representation" },
      body: JSON.stringify(parsed.row)
    });
    if (res.status === 409) return { error: "That SKU id already exists.", status: 400 };
  } else {
    const id = String(body.id || parsed.id || "").trim();
    if (!id) return { error: "Missing SKU id.", status: 400 };
    res = await fetch(`${url}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...restHeaders(accessToken), Prefer: "return=representation" },
      body: JSON.stringify(parsed.row)
    });
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: err.message || err.hint || "Could not save SKU.", status: 500 };
  }
  bustCatalogCache();
  const rows = await res.json();
  const product = Array.isArray(rows) ? rows[0] : rows;
  if (!product) return { error: "SKU was not saved.", status: 400 };
  return { ok: true, product };
}

async function deleteAdminProduct(accessToken, id) {
  const admin = await requireAdmin(accessToken);
  if (admin.error) return admin;
  if (!id) return { error: "Missing SKU id.", status: 400 };
  const { url } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: restHeaders(accessToken)
  });
  if (!res.ok) return { error: "Could not delete SKU.", status: 500 };
  bustCatalogCache();
  return { ok: true };
}

async function saveStoreSettings(accessToken, settings) {
  const admin = await requireAdmin(accessToken);
  if (admin.error) return admin;
  const shipping_flat = Number(settings.shipping_flat);
  const free_above = Number(settings.free_above);
  if (!Number.isInteger(shipping_flat) || shipping_flat < 0 || shipping_flat > 9999) {
    return { error: "Shipping must be a whole rupee amount.", status: 400 };
  }
  if (!Number.isInteger(free_above) || free_above < 0 || free_above > 99999) {
    return { error: "Free-shipping threshold must be a whole rupee amount.", status: 400 };
  }
  const { url } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/store_settings?id=eq.1`, {
    method: "PATCH",
    headers: { ...restHeaders(accessToken), Prefer: "return=representation" },
    body: JSON.stringify({ shipping_flat, free_above, updated_at: new Date().toISOString() })
  });
  if (!res.ok) return { error: "Could not save shipping.", status: 500 };
  bustCatalogCache();
  const rows = await res.json();
  return { ok: true, settings: rows[0] };
}

function couponCodeFromAmount(amount) {
  return `RD${amount}`;
}

function normalizeCouponInput(body) {
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 99999) {
    return { error: "Discount must be a whole rupee amount.", status: 400 };
  }
  let code = String(body.code || couponCodeFromAmount(amount)).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 3 || code.length > 20) return { error: "Coupon code should be 3–20 letters or numbers.", status: 400 };
  let expires_at = body.expires_at ? String(body.expires_at).trim() : "";
  if (expires_at && !/^\d{4}-\d{2}-\d{2}/.test(expires_at)) {
    return { error: "Enter a valid end date.", status: 400 };
  }
  if (expires_at && expires_at.length === 10) expires_at = expires_at + "T23:59:59+05:30";
  const max_redemptions = body.max_redemptions == null || body.max_redemptions === ""
    ? 50
    : Number(body.max_redemptions);
  if (!Number.isInteger(max_redemptions) || max_redemptions < 1 || max_redemptions > 100000) {
    return { error: "Max customers must be a whole number.", status: 400 };
  }
  return {
    row: {
      code,
      amount,
      active: body.active !== false && body.active !== "false",
      expires_at: expires_at || null,
      max_redemptions,
      once_per_user: body.once_per_user !== false && body.once_per_user !== "false"
    }
  };
}

async function listAdminCoupons(accessToken) {
  const admin = await requireAdmin(accessToken);
  if (admin.error) return admin;
  const { url } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/coupons?select=*&order=created_at.desc`, {
    headers: restHeaders(accessToken)
  });
  if (!res.ok) return { error: "Could not load coupons.", status: 500 };
  const coupons = await res.json();
  const usedRes = await fetch(`${url}/rest/v1/coupon_redemptions?select=code`, {
    headers: restHeaders(accessToken)
  });
  const usedRows = usedRes.ok ? await usedRes.json() : [];
  const usedMap = {};
  for (const row of usedRows) usedMap[row.code] = (usedMap[row.code] || 0) + 1;
  return {
    coupons: coupons.map((c) => Object.assign({}, c, { used: usedMap[c.code] || 0 }))
  };
}

async function saveAdminCoupon(accessToken, body) {
  const admin = await requireAdmin(accessToken);
  if (admin.error) return admin;
  const parsed = normalizeCouponInput(body || {});
  if (parsed.error) return parsed;
  const { url } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/coupons?on_conflict=code`, {
    method: "POST",
    headers: {
      ...restHeaders(accessToken),
      Prefer: "return=representation,resolution=merge-duplicates"
    },
    body: JSON.stringify(parsed.row)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: err.message || err.hint || "Could not save coupon.", status: 500 };
  }
  const rows = await res.json();
  return { ok: true, coupon: Array.isArray(rows) ? rows[0] : rows };
}

async function patchAdminCoupon(accessToken, body) {
  const admin = await requireAdmin(accessToken);
  if (admin.error) return admin;
  const code = String(body.code || "").trim().toUpperCase();
  if (!code) return { error: "Missing coupon code.", status: 400 };
  const patch = {};
  if (body.amount != null) {
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount < 1) return { error: "Discount must be a whole rupee amount.", status: 400 };
    patch.amount = amount;
  }
  if (body.active != null) patch.active = body.active !== false && body.active !== "false";
  if (!Object.keys(patch).length) return { error: "Nothing to update.", status: 400 };
  const { url } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/coupons?code=eq.${encodeURIComponent(code)}`, {
    method: "PATCH",
    headers: { ...restHeaders(accessToken), Prefer: "return=representation" },
    body: JSON.stringify(patch)
  });
  if (!res.ok) return { error: "Could not update coupon.", status: 500 };
  return { ok: true };
}

async function deleteAdminCoupon(accessToken, code) {
  const admin = await requireAdmin(accessToken);
  if (admin.error) return admin;
  const id = String(code || "").trim().toUpperCase();
  if (!id) return { error: "Missing coupon code.", status: 400 };
  const { url } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/coupons?code=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: restHeaders(accessToken)
  });
  if (!res.ok) return { error: "Could not delete coupon.", status: 500 };
  return { ok: true };
}

module.exports = {
  ADMIN_EMAIL,
  supabaseConfig,
  restHeaders,
  getUser,
  bearer,
  saveOrder,
  listMyOrders,
  listAllOrders,
  updateOrderStatus,
  isAdminEmail,
  isAdminUser,
  signAdmin,
  checkAdminCookie,
  listAdminProducts,
  saveAdminProduct,
  deleteAdminProduct,
  saveStoreSettings,
  listAdminCoupons,
  saveAdminCoupon,
  patchAdminCoupon,
  deleteAdminCoupon
};
