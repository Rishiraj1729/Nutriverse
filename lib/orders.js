const catalog = require("../js/products.js");

const WHATSAPP = "918452914697";
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "contact@thenutriverse.in";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function orderId() {
  const n = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NV-${n}`;
}

function formatCustomer(c = {}) {
  const name = String(c.name || "").trim();
  const phone = String(c.phone || "").replace(/\D/g, "");
  const email = String(c.email || "").trim();
  const line1 = String(c.line1 || "").trim();
  const line2 = String(c.line2 || "").trim();
  const line3 = String(c.line3 || "").trim();
  const district = String(c.district || c.city || "").trim();
  const state = String(c.state || "").trim();
  const pincode = String(c.pincode || "").replace(/\D/g, "");
  const address = [line1, line2, line3].filter(Boolean).join(", ") || String(c.address || "").trim();
  return {
    name,
    phone,
    email,
    line1,
    line2,
    line3,
    district,
    city: district,
    state,
    pincode,
    address
  };
}

function validCustomer(c = {}) {
  const customer = formatCustomer(c);
  if (customer.name.length < 2) return "Enter your name.";
  if (!/^[6-9]\d{9}$/.test(customer.phone)) return "Enter a 10-digit Indian mobile number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return "Enter a valid email.";
  if (!customer.state) return "Select your state.";
  if (!customer.district) return "Select your district.";
  if (customer.line1.length < 4) return "Enter address line 1.";
  if (customer.pincode.length !== 6) return "Enter a 6-digit pincode.";
  return null;
}

async function pricedCart(items, couponCode, phone) {
  const { loadPublicCatalog, checkCoupon } = require("./catalog");
  const live = await loadPublicCatalog();
  let coupon = null;
  if (couponCode) {
    const checked = await checkCoupon(couponCode, phone);
    if (checked.error) return { error: checked.error };
    coupon = checked.coupon;
  }
  const totals = live.totalsFromItems(items || [], coupon);
  if (!totals.lines.length) return { error: "Your cart is empty." };
  return { totals, coupon };
}

function formatOrder(order) {
  const lines = order.totals.lines
    .map((l) => `• ${l.name} × ${l.qty} — ${catalog.rupees(l.lineTotal)}`)
    .join("\n");
  const c = order.customer;
  return [
    `Nutriverse order ${order.id}`,
    `Payment: ${order.payment}`,
    "",
    lines,
    "",
    `Subtotal: ${catalog.rupees(order.totals.subtotal)}`,
    order.totals.discount ? `Coupon ${order.totals.couponCode}: -${catalog.rupees(order.totals.discount)}` : null,
    `Shipping: ${catalog.rupees(order.totals.shipping)}`,
    `Total: ${catalog.rupees(order.totals.total)}`,
    "",
    `${c.name}`,
    `${c.phone} · ${c.email}`,
    c.line1 || c.address,
    c.line2 || null,
    c.line3 || null,
    `${c.district || c.city}, ${c.state} ${c.pincode}`
  ].filter((line) => line !== null).join("\n");
}

function whatsappUrl(order) {
  const text = encodeURIComponent(formatOrder(order));
  return `https://wa.me/${WHATSAPP}?text=${text}`;
}

async function notify(order) {
  const text = formatOrder(order);
  const key = process.env.RESEND_API_KEY;
  let emailed = false;
  if (key) {
    const from = process.env.RESEND_FROM || "Nutriverse <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [NOTIFY_EMAIL],
        subject: `New order ${order.id} · ${order.payment} · ${catalog.rupees(order.totals.total)}`,
        text
      })
    });
    emailed = res.ok;
  }
  return { emailed, notifyEmail: NOTIFY_EMAIL, whatsappUrl: whatsappUrl(order) };
}

module.exports = {
  catalog,
  json,
  readBody,
  orderId,
  validCustomer,
  formatCustomer,
  pricedCart,
  formatOrder,
  whatsappUrl,
  notify
};
