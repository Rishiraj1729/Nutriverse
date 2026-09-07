const crypto = require("crypto");
const { json, readBody, validCustomer, formatCustomer, pricedCart, notify } = require("../lib/orders");
const { bearer, saveOrder } = require("../lib/db");
const { redeemCoupon } = require("../lib/catalog");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return json(res, 400, { error: "Razorpay is not configured." });

  try {
    const body = await readBody(req);
    const customer = formatCustomer(body.customer);
    const customerError = validCustomer(customer);
    if (customerError) return json(res, 400, { error: customerError });
    const priced = await pricedCart(body.items, body.coupon, customer.phone);
    if (priced.error) return json(res, 400, { error: priced.error });
    if (priced.error) return json(res, 400, { error: priced.error });

    const orderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (!orderId || expected !== signature) {
      return json(res, 400, { error: "Payment signature did not match." });
    }

    const order = {
      id: body.receipt || orderId,
      payment: "Paid online (Razorpay)",
      status: "paid",
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      customer,
      totals: priced.totals,
      createdAt: new Date().toISOString()
    };
    if (priced.coupon) {
      await redeemCoupon(priced.coupon.code, customer.phone, customer.email, order.id);
    }
    const note = await notify(order);
    const saved = await saveOrder(order, bearer(req));
    return json(res, 200, { order, saved: Boolean(saved.saved), ...note });
  } catch (err) {
    return json(res, 500, { error: "Could not verify payment." });
  }
};
