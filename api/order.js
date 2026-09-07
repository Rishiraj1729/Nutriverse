const { json } = require("../lib/orders");

module.exports = async (req, res) => {
  json(res, 410, { error: "Cash on Delivery is no longer available. Pay online with Razorpay." });
};
