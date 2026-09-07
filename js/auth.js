(() => {
  let client = null;
  let config = null;

  async function loadConfig() {
    if (config) return config;
    try {
      config = await fetch("/api/public-config").then((r) => r.json());
    } catch (e) {
      config = { authEnabled: false };
    }
    return config;
  }

  async function loadSdk() {
    if (window.supabase && window.supabase.createClient) return window.supabase;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return window.supabase;
  }

  async function getClient() {
    if (client) return client;
    const cfg = await loadConfig();
    if (!cfg.authEnabled || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    const sdk = await loadSdk();
    client = sdk.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    return client;
  }

  async function session() {
    const sb = await getClient();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session || null;
  }

  async function accessToken() {
    const s = await session();
    return s ? s.access_token : "";
  }

  async function user() {
    const s = await session();
    return s ? s.user : null;
  }

  async function signUp(email, password, fullName) {
    const sb = await getClient();
    if (!sb) throw new Error("Accounts are not configured yet.");
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || "" } }
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function signIn(identifier, password) {
    const sb = await getClient();
    if (!sb) throw new Error("Accounts are not configured yet.");
    const email = resolveLogin(identifier);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  }

  async function signOut() {
    const sb = await getClient();
    if (sb) await sb.auth.signOut();
  }

  function resolveLogin(identifier) {
    const value = String(identifier || "").trim();
    if (value.toLowerCase() === "admin_nutriverse") return "admin_nutriverse@thenutriverse.in";
    return value;
  }

  async function isAdmin() {
    const u = await user();
    if (!u) return false;
    if (u.app_metadata && String(u.app_metadata.role || "").toLowerCase() === "admin") return true;
    const email = String(u.email || "").toLowerCase();
    if (email === "admin_nutriverse@thenutriverse.in") return true;
    const cfg = await loadConfig();
    return Boolean(cfg.adminEmail && email === String(cfg.adminEmail).toLowerCase());
  }

  function injectLink(sessionObj, cfg) {
    if (document.querySelector(".account-link")) return;
    const inner = document.querySelector(".header-inner");
    if (!inner) return;
    const a = document.createElement("a");
    a.className = "account-link";
    if (sessionObj && sessionObj.user) {
      a.href = "account.html";
      a.textContent = "Account";
    } else {
      a.href = "login.html";
      a.textContent = "Log in";
    }
    const actions = document.querySelector(".header-actions") || inner;
    const cart = actions.querySelector("[data-open-cart]");
    if (cart) actions.insertBefore(a, cart);
    else actions.appendChild(a);
  }

  window.NVAuth = {
    getClient,
    loadConfig,
    session,
    user,
    accessToken,
    signUp,
    signIn,
    signOut,
    isAdmin
  };

  loadConfig().then(async (cfg) => {
    if (!cfg.authEnabled) return;
    const s = await session();
    injectLink(s, cfg);
  }).catch(() => {});
})();
