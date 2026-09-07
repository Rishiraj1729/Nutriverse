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

module.exports = { loadPublicCatalog, bustCatalogCache, shape, fetchJson };
