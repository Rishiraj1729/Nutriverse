module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const enabled = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  res.end(JSON.stringify({
    enabled,
    keyId: enabled ? process.env.RAZORPAY_KEY_ID : ""
  }));
};
