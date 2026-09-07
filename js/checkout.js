(() => {
  const form = document.getElementById("checkout-form");
  const errorEl = document.getElementById("form-error");
  const summary = document.getElementById("summary-box");
  const submitBtn = document.getElementById("place-order");
  const upiNote = document.getElementById("upi-note");
  const upiOption = document.getElementById("upi-option");
  let payConfig = { enabled: false, keyId: "" };

  function customerFromForm() {
    const data = new FormData(form);
    return {
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").replace(/\D/g, ""),
      email: String(data.get("email") || "").trim(),
      address: String(data.get("address") || "").trim(),
      pincode: String(data.get("pincode") || "").replace(/\D/g, ""),
      city: String(data.get("city") || "").trim(),
      state: String(data.get("state") || "").trim()
    };
  }

  function payload() {
    return {
      customer: customerFromForm(),
      items: window.NVCart ? NVCart.readCart() : []
    };
  }

  function renderSummary() {
    if (!window.NV || !summary) return;
    const totals = NV.totalsFromItems(NVCart.readCart());
    if (!totals.lines.length) {
      summary.innerHTML = `<h2>Order</h2><p class="subcopy">Your cart is empty.</p><a class="btn btn-outline" href="products.html">Shop</a>`;
      return;
    }
    summary.innerHTML = `
      <h2>Order</h2>
      ${totals.lines.map((l) => `<p>${l.name} × ${l.qty} <strong style="float:right">${NV.rupees(l.lineTotal)}</strong></p>`).join("")}
      <hr style="margin:16px 0;border:0;border-top:1px solid var(--line)">
      <p>Subtotal <strong style="float:right">${NV.rupees(totals.subtotal)}</strong></p>
      <p>Shipping <strong style="float:right">${totals.shipping ? NV.rupees(totals.shipping) : "Free"}</strong></p>
      <p style="margin-top:10px;font-size:20px">Total <strong style="float:right">${NV.rupees(totals.total)}</strong></p>
    `;
  }

  function finish(result) {
    sessionStorage.setItem("nv_last_order", JSON.stringify(result));
    localStorage.removeItem("nv_cart");
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

  async function placeCod() {
    const res = await fetch("/api/order", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload())
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not place order.");
    finish(data);
  }

  async function placeOnline() {
    if (!window.Razorpay) throw new Error("Razorpay failed to load. Try Cash on Delivery.");
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
      submitBtn.textContent = "Place order";
    });
  }

  fetch("/api/pay-config")
    .then((r) => r.json())
    .then((cfg) => {
      payConfig = cfg;
      if (cfg.enabled) {
        upiNote.textContent = "UPI, cards, netbanking via Razorpay.";
      } else {
        upiNote.textContent = "Add Razorpay keys in Vercel to enable UPI / cards.";
        const input = upiOption.querySelector("input");
        input.disabled = true;
      }
    })
    .catch(() => {
      upiNote.textContent = "Online pay unavailable right now. Use Cash on Delivery.";
      upiOption.querySelector("input").disabled = true;
    });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    if (!NVCart.readCart().length) {
      errorEl.textContent = "Your cart is empty.";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Placing…";
    try {
      const method = (new FormData(form).get("pay") || "cod");
      if (method === "online") await placeOnline();
      else await placeCod();
    } catch (err) {
      errorEl.textContent = err.message || "Something went wrong.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Place order";
    }
  });

  renderSummary();

  if (window.NVAuth) {
    NVAuth.user().then((u) => {
      const box = document.getElementById("account-hint");
      if (!box) return;
      if (u) {
        box.innerHTML = `Logged in as <strong>${u.email}</strong>. This order will show in <a href="account.html">your account</a>.`;
        const email = document.getElementById("email");
        if (email && !email.value) email.value = u.email;
        const name = document.getElementById("name");
        const metaName = u.user_metadata && u.user_metadata.full_name;
        if (name && !name.value && metaName) name.value = metaName;
      } else {
        box.innerHTML = `<a href="login.html?next=checkout.html">Log in</a> to save this order to your account, or continue as guest.`;
      }
    });
  }
})();
