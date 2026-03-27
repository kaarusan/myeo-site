;(function (global) {
  const KEY_USERS = "myeo_auth_users_v1";
  const KEY_SESSION = "myeo_auth_session_v1";
  const KEY_2FA_PASSED = "myeo_auth_2fa_passed_v1";

  function safeParse(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function loadUsers() {
    return safeParse(localStorage.getItem(KEY_USERS), []);
  }

  function saveUsers(users) {
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
  }

  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function hashPassword(email, password) {
    return String(hash32(String(email).toLowerCase() + "::" + String(password)));
  }

  function create2faSecret() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function twoFactorCode(secret, nowMs) {
    const step = Math.floor((nowMs || Date.now()) / 30000);
    const v = hash32(secret + ":" + step) % 1000000;
    return String(v).padStart(6, "0");
  }

  function signUp(email, password) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { ok: false, message: "Enter a valid email." };
    }
    if (String(password || "").length < 8) {
      return { ok: false, message: "Password must be at least 8 characters." };
    }
    const users = loadUsers();
    if (users.some(function (u) { return u.email === cleanEmail; })) {
      return { ok: false, message: "Account already exists. Sign in instead." };
    }
    const secret = create2faSecret();
    users.push({
      email: cleanEmail,
      passHash: hashPassword(cleanEmail, password),
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      createdAt: Date.now()
    });
    saveUsers(users);
    return { ok: true, secret: secret };
  }

  function signIn(email, password) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const users = loadUsers();
    const user = users.find(function (u) { return u.email === cleanEmail; });
    if (!user) return { ok: false, message: "No account with that email." };
    const passHash = hashPassword(cleanEmail, password);
    if (passHash !== user.passHash) return { ok: false, message: "Incorrect password." };

    const session = {
      email: cleanEmail,
      createdAt: Date.now(),
      twoFactorRequired: Boolean(user.twoFactorEnabled)
    };
    localStorage.setItem(KEY_SESSION, JSON.stringify(session));
    sessionStorage.removeItem(KEY_2FA_PASSED);
    return { ok: true, twoFactorRequired: session.twoFactorRequired };
  }

  function verifyTwoFactor(code) {
    const session = getSession();
    if (!session) return { ok: false, message: "No active session." };
    const users = loadUsers();
    const user = users.find(function (u) { return u.email === session.email; });
    if (!user || !user.twoFactorEnabled) {
      sessionStorage.setItem(KEY_2FA_PASSED, "1");
      return { ok: true };
    }
    const entered = String(code || "").trim();
    const now = Date.now();
    const valid =
      entered === twoFactorCode(user.twoFactorSecret, now) ||
      entered === twoFactorCode(user.twoFactorSecret, now - 30000) ||
      entered === twoFactorCode(user.twoFactorSecret, now + 30000);
    if (!valid) return { ok: false, message: "Invalid 2FA code." };
    sessionStorage.setItem(KEY_2FA_PASSED, "1");
    return { ok: true };
  }

  function isAuthorized() {
    const session = getSession();
    if (!session) return false;
    if (!session.twoFactorRequired) return true;
    return sessionStorage.getItem(KEY_2FA_PASSED) === "1";
  }

  function getSession() {
    const raw = localStorage.getItem(KEY_SESSION);
    const session = safeParse(raw, null);
    if (!session || !session.email) return null;
    return session;
  }

  function getUserBySession() {
    const s = getSession();
    if (!s) return null;
    const users = loadUsers();
    return users.find(function (u) { return u.email === s.email; }) || null;
  }

  function signOut() {
    localStorage.removeItem(KEY_SESSION);
    sessionStorage.removeItem(KEY_2FA_PASSED);
  }

  global.myeoAuth = {
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    getSession: getSession,
    getUserBySession: getUserBySession,
    verifyTwoFactor: verifyTwoFactor,
    isAuthorized: isAuthorized,
    twoFactorCode: twoFactorCode
  };
})(window);
