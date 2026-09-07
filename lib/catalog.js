const fallback = require("../js/products.js");
const { supabaseConfig, restHeaders } = require("./db");

let cache = { at: 0, catalog: null };

function shape(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    unit: row.unit,
    image: row.image,
    blurb: row.blurb || "",
    active: row.active !== false,
    sort_order: Number(row.sort_order) || 100
  };
}

async function fetchJson(path, accessToken) {
  const { url } = supabaseConfig();
  if (!url) return null;
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: restHeaders(accessToken) });
  if (!res.ok) return null;
  return res.json();
}

function bustCatalogCache() {
  cache = { at: 0, catalog: null };
}

async function loadPublicCatalog() {
  if (cache.catalog && Date.now() - cache.at < 15000) return cache.catalog;
  try {
    const [products, settings] = await Promise.all([
      fetchJson("products?active=eq.true&select=*&order=sort_order.asc"),
      fetchJson("store_settings?id=eq.1&select=*")
    ]);
    if (!Array.isArray(products) || !products.length) return fallback;
    const row = Array.isArray(settings) ? settings[0] : null;
    const shipping = row
      ? { flat: Number(row.shipping_flat), freeAbove: Number(row.free_above), country: "IN" }
      : fallback.SHIPPING;
    const catalog = fallback.makeCatalog(products.map(shape), shipping);
    cache = { at: Date.now(), catalog };
    return catalog;
  } catch (err) {
    return fallback;
  }
}

async function rpc(name, args) {
  const { url } = supabaseConfig();
  if (!url) return null;
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: restHeaders(),
    body: JSON.stringify(args || {})
  });
  try {
    return await res.json();
  } catch (err) {
    return null;
  }
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
}

async function checkCoupon(code, phone) {
  const id = normalizeCode(code);
  if (!id) return { error: "Enter a coupon code." };
  const data = await rpc("check_coupon", { p_code: id, p_phone: String(phone || "").replace(/\D/g, "") });
  if (!data || data.ok !== true) return { error: (data && data.error) || "That coupon is not valid." };
  return {
    coupon: {
      code: data.code,
      amount: Number(data.amount),
      expires_at: data.expires_at,
      max_redemptions: Number(data.max_redemptions) || 50,
      used: Number(data.used) || 0,
      once_per_user: data.once_per_user !== false
    }
  };
}

async function lookupCoupon(code, phone) {
  const result = await checkCoupon(code, phone);
  return result.coupon || null;
}

async function redeemCoupon(code, phone, email, orderId) {
  return rpc("redeem_coupon", {
    p_code: normalizeCode(code),
    p_phone: String(phone || "").replace(/\D/g, ""),
    p_email: String(email || ""),
    p_order_id: String(orderId || ""),
    p_secret: process.env.COUPON_REDEEM_TOKEN || "nv-redeem-2026"
  });
}

module.exports = {
  loadPublicCatalog,
  bustCatalogCache,
  shape,
  fetchJson,
  lookupCoupon,
  checkCoupon,
  redeemCoupon,
  normalizeCode
};
