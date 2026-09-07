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

function validCustomer(c = {}) {
  const name = String(c.name || "").trim();
  const phone = String(c.phone || "").replace(/\D/g, "");
  const email = String(c.email || "").trim();
  const address = String(c.address || "").trim();
  const pincode = String(c.pincode || "").replace(/\D/g, "");
  const city = String(c.city || "").trim();
  const state = String(c.state || "").trim();
  if (name.length < 2) return "Enter your name.";
  if (phone.length !== 10) return "Enter a 10-digit Indian mobile number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email.";
  if (address.length < 8) return "Enter a full delivery address.";
  if (pincode.length !== 6) return "Enter a 6-digit pincode.";
  if (!city || !state) return "Enter city and state.";
  return null;
}

function pricedCart(items) {
  const totals = catalog.totalsFromItems(items || []);
  if (!totals.lines.length) return { error: "Your cart is empty." };
  return { totals };
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
    `Shipping: ${catalog.rupees(order.totals.shipping)}`,
    `Total: ${catalog.rupees(order.totals.total)}`,
    "",
    `${c.name}`,
    `${c.phone} · ${c.email}`,
    `${c.address}`,
    `${c.city}, ${c.state} ${c.pincode}`
  ].join("\n");
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
  pricedCart,
  formatOrder,
  whatsappUrl,
  notify
};
