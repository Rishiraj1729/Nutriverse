(() => {
  const form = document.getElementById("checkout-form");
  const errorEl = document.getElementById("form-error");
  const summary = document.getElementById("summary-box");
  const submitBtn = document.getElementById("place-order");
  const upiNote = document.getElementById("upi-note");
  let payReady = false;

  function customerFromForm() {
    const data = new FormData(form);
    const line1 = String(data.get("line1") || "").trim();
    const line2 = String(data.get("line2") || "").trim();
    const line3 = String(data.get("line3") || "").trim();
    const district = String(data.get("district") || "").trim();
    return {
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").replace(/\D/g, ""),
      email: String(data.get("email") || "").trim(),
      line1,
      line2,
      line3,
      district,
      city: district,
      state: String(data.get("state") || "").trim(),
      pincode: String(data.get("pincode") || "").replace(/\D/g, ""),
      address: [line1, line2, line3].filter(Boolean).join(", ")
    };
  }

  function payload() {
    const coupon = window.NVCart && NVCart.readCoupon ? NVCart.readCoupon() : null;
    return {
      customer: customerFromForm(),
      items: window.NVCart ? NVCart.readCart() : [],
      coupon: coupon ? coupon.code : ""
    };
  }

  function renderSummary() {
    if (!window.NV || !summary) return;
    const coupon = window.NVCart && NVCart.readCoupon ? NVCart.readCoupon() : null;
    const totals = NV.totalsFromItems(NVCart.readCart(), coupon);
    if (!totals.lines.length) {
      summary.innerHTML = `<h2>Order</h2><p class="subcopy">Your cart is empty.</p><a class="btn btn-outline" href="products.html">Shop</a>`;
      return;
    }
    const discountRow = totals.discount
      ? `<p>Coupon ${totals.couponCode} <strong style="float:right">−${NV.rupees(totals.discount)}</strong></p>`
      : "";
    summary.innerHTML = `
      <h2>Order</h2>
      ${totals.lines.map((l) => `<p>${l.name} × ${l.qty} <strong style="float:right">${NV.rupees(l.lineTotal)}</strong></p>`).join("")}
      <hr style="margin:16px 0;border:0;border-top:1px solid var(--line)">
      <p>Subtotal <strong style="float:right">${NV.rupees(totals.subtotal)}</strong></p>
      ${discountRow}
      <p>Shipping <strong style="float:right">${totals.shipping ? NV.rupees(totals.shipping) : "Free"}</strong></p>
      <p style="margin-top:10px;font-size:20px">Total <strong style="float:right">${NV.rupees(totals.total)}</strong></p>
    `;
  }

  function finish(result) {
    sessionStorage.setItem("nv_last_order", JSON.stringify(result));
    localStorage.removeItem("nv_cart");
    localStorage.removeItem("nv_coupon");
    window.location.href = "order.html";
  }

  async function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (window.NVAuth) {
      const token = await NVAuth.accessToken();
      if (token) headers.Authorization = "Bearer " + token;
    }
    return headers;
  }

  async function placeOnline() {
    if (!payReady) throw new Error("Razorpay is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel.");
    if (!window.Razorpay) throw new Error("Razorpay failed to load. Refresh and try again.");
    const start = await fetch("/api/razorpay-order", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload())
    });
    const started = await start.json();
    if (!start.ok) throw new Error(started.error || "Could not start payment.");

    const customer = payload().customer;
    await new Promise((resolve, reject) => {
      const rzp = new Razorpay({
        key: started.keyId,
        amount: started.amount,
        currency: "INR",
        name: "Nutriverse",
        description: "Roasted in olive oil",
        order_id: started.razorpayOrderId,
        prefill: { name: customer.name, email: customer.email, contact: customer.phone },
        theme: { color: "#145c38" },
        handler: async (response) => {
          try {
            const verify = await fetch("/api/razorpay-verify", {
              method: "POST",
              headers: await authHeaders(),
              body: JSON.stringify({
                ...payload(),
                receipt: started.receipt,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verified = await verify.json();
            if (!verify.ok) throw new Error(verified.error || "Payment could not be verified.");
            finish(verified);
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      });
      rzp.on("payment.failed", () => reject(new Error("Payment failed or was cancelled.")));
      rzp.open();
      submitBtn.disabled = false;
      submitBtn.textContent = "Pay now";
    });
  }

  fetch("/api/pay-config")
    .then((r) => r.json())
    .then((cfg) => {
      payReady = Boolean(cfg.enabled);
      if (payReady) {
        upiNote.textContent = "UPI, cards, netbanking via Razorpay.";
        submitBtn.disabled = false;
      } else {
        upiNote.textContent = "Add Razorpay keys in Vercel to take payments.";
        submitBtn.disabled = true;
      }
    })
    .catch(() => {
      payReady = false;
      upiNote.textContent = "Payment is unavailable right now. Try again shortly.";
      submitBtn.disabled = true;
    });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    if (!NVCart.readCart().length) {
      errorEl.textContent = "Your cart is empty.";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Opening Razorpay…";
    try {
      await placeOnline();
    } catch (err) {
      errorEl.textContent = err.message || "Something went wrong.";
      submitBtn.disabled = !payReady;
      submitBtn.textContent = "Pay now";
    }
  });

  renderSummary();
  document.addEventListener("nv-catalog", renderSummary);

  const stateEl = document.getElementById("state");
  const districtEl = document.getElementById("district");
  if (window.NVPlaces && stateEl && districtEl) {
    stateEl.innerHTML = `<option value="">Select state</option>` + NVPlaces.STATES.map((s) => `<option value="${s}">${s}</option>`).join("");
    stateEl.addEventListener("change", () => {
      const list = NVPlaces.districtsFor(stateEl.value);
      districtEl.disabled = !list.length;
      districtEl.innerHTML = list.length
        ? `<option value="">Select district</option>` + list.map((d) => `<option value="${d}">${d}</option>`).join("")
        : `<option value="">Select state first</option>`;
    });
  }

  ["phone", "pincode"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      el.value = el.value.replace(/\D/g, "").slice(0, id === "phone" ? 10 : 6);
    });
  });

  const formCoupon = document.getElementById("form-coupon");
  const couponStatus = document.getElementById("coupon-status");
  const stored = window.NVCart && NVCart.readCoupon ? NVCart.readCoupon() : null;
  if (formCoupon && stored) formCoupon.value = stored.code;

  function applyCouponFromForm() {
    const code = formCoupon ? String(formCoupon.value || "").trim() : "";
    const phone = String(document.getElementById("phone").value || "").replace(/\D/g, "");
    if (!code) {
      localStorage.removeItem("nv_coupon");
      if (couponStatus) couponStatus.textContent = "";
      renderSummary();
      return;
    }
    const qs = "/api/coupon?code=" + encodeURIComponent(code) + (phone ? "&phone=" + encodeURIComponent(phone) : "");
    fetch(qs)
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) {
          localStorage.removeItem("nv_coupon");
          if (couponStatus) couponStatus.textContent = body.error || "That coupon is not valid.";
          renderSummary();
          return;
        }
        localStorage.setItem("nv_coupon", JSON.stringify(body.coupon));
        const left = body.coupon.max_redemptions - (body.coupon.used || 0);
        if (couponStatus) {
          couponStatus.textContent = body.coupon.code + " applied · ₹" + body.coupon.amount + " off"
            + (body.coupon.once_per_user ? " · once per customer" : "")
            + (left <= 10 ? " · " + left + " uses left" : "");
        }
        renderSummary();
      })
      .catch(() => {
        if (couponStatus) couponStatus.textContent = "Could not check the coupon.";
      });
  }

  document.getElementById("form-apply-coupon").addEventListener("click", (e) => {
    e.preventDefault();
    applyCouponFromForm();
  });
})();
