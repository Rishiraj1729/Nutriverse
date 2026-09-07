const { json, readBody, orderId, validCustomer, pricedCart } = require("../lib/orders");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return json(res, 400, { error: "Online pay is not enabled yet. Use Cash on Delivery, or add Razorpay keys in Vercel." });
  }

  try {
    const body = await readBody(req);
    const customerError = validCustomer(body.customer);
    if (customerError) return json(res, 400, { error: customerError });
    const priced = pricedCart(body.items);
    if (priced.error) return json(res, 400, { error: priced.error });

    const receipt = orderId();
    const amount = priced.totals.total * 100;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt,
        notes: {
          name: body.customer.name,
          phone: body.customer.phone
        }
      })
    });
    const data = await rzp.json();
    if (!rzp.ok) {
      return json(res, 502, { error: data.error && data.error.description ? data.error.description : "Razorpay could not start." });
    }

    return json(res, 200, {
      keyId,
      receipt,
      razorpayOrderId: data.id,
      amount,
      totals: priced.totals,
      customer: body.customer
    });
  } catch (err) {
    return json(res, 500, { error: "Could not start online payment." });
  }
};
