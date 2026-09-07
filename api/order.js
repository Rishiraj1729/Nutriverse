const { json, readBody, orderId, validCustomer, pricedCart, notify } = require("../lib/orders");
const { bearer, saveOrder } = require("../lib/db");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const body = await readBody(req);
    const customerError = validCustomer(body.customer);
    if (customerError) return json(res, 400, { error: customerError });
    const priced = pricedCart(body.items);
    if (priced.error) return json(res, 400, { error: priced.error });

    const order = {
      id: orderId(),
      payment: "Cash on Delivery",
      status: "pending",
      customer: body.customer,
      totals: priced.totals,
      createdAt: new Date().toISOString()
    };
    const saved = await saveOrder(order, bearer(req));
    const note = await notify(order);
    return json(res, 200, { order, saved: Boolean(saved.saved), ...note });
  } catch (err) {
    return json(res, 500, { error: "Could not place the order. Try again." });
  }
};
