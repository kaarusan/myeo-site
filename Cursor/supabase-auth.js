;(function (global) {
  function cfg() {
    return global.MYEO_SUPABASE || null;
  }

  function isConfigured() {
    const c = cfg();
    return !!(c && c.url && c.anonKey && !String(c.url).includes("YOUR_PROJECT_ID"));
  }

  function getClient() {
    if (!isConfigured()) return null;
    if (!global.supabase || !global.supabase.createClient) return null;
    if (!global.__myeoSupabaseClient) {
      const c = cfg();
      global.__myeoSupabaseClient = global.supabase.createClient(c.url, c.anonKey);
    }
    return global.__myeoSupabaseClient;
  }

  async function getSession() {
    const client = getClient();
    if (!client) return null;
    const res = await client.auth.getSession();
    return res.data && res.data.session ? res.data.session : null;
  }

  async function getAal() {
    const client = getClient();
    if (!client) return null;
    const res = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    return res.data || null;
  }

  async function isAuthorizedAal2() {
    const session = await getSession();
    if (!session) return false;
    const aal = await getAal();
    if (!aal) return false;
    return aal.currentLevel === "aal2";
  }

  global.myeoSupabaseAuth = {
    isConfigured: isConfigured,
    getClient: getClient,
    getSession: getSession,
    getAal: getAal,
    isAuthorizedAal2: isAuthorizedAal2
  };
})(window);
