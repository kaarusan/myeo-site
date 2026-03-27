;(function (global) {
  var TABLE = "biolink_public";
  var ROW_ID = "default";
  var ANALYTICS_TABLE = "biolink_analytics";
  var ANALYTICS_ID = "default";

  function pad2(n) {
    n = Number(n);
    return n < 10 ? "0" + n : String(n);
  }

  function clientLocalDayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function mergeWithDefaults(defaults, remote) {
    if (!remote || typeof remote !== "object") return defaults;
    return {
      ...defaults,
      ...remote,
      admin: { ...defaults.admin, ...(remote.admin || {}) },
      accents: { ...defaults.accents, ...(remote.accents || {}) },
      avatar: { ...defaults.avatar, ...(remote.avatar || {}) },
      music: { ...defaults.music, ...(remote.music || {}) },
      links: Array.isArray(remote.links) ? remote.links : defaults.links
    };
  }

  function getClient() {
    if (!global.myeoSupabaseAuth || !global.myeoSupabaseAuth.getClient) return null;
    return global.myeoSupabaseAuth.getClient();
  }

  async function fetchPublicBiolinkConfig() {
    var client = getClient();
    if (!client) return null;
    var res = await client.from(TABLE).select("config").eq("id", ROW_ID).maybeSingle();
    if (res.error) return null;
    if (!res.data || res.data.config == null) return null;
    var c = res.data.config;
    return typeof c === "object" && c !== null ? c : null;
  }

  async function savePublicBiolinkConfig(configObject) {
    var client = getClient();
    if (!client) throw new Error("Supabase not configured");
    var session = await global.myeoSupabaseAuth.getSession();
    if (!session) throw new Error("Sign in required");
    var res = await client.from(TABLE).upsert(
      {
        id: ROW_ID,
        config: configObject,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );
    if (res.error) throw res.error;
    return true;
  }

  /** PostgREST read (anon JWT) — for redirect.html without loading supabase-js. */
  async function fetchPublicBiolinkConfigRest() {
    var c = global.MYEO_SUPABASE;
    if (!c || !c.url || !c.anonKey) return null;
    var base = String(c.url).replace(/\/$/, "");
    var u =
      base +
      "/rest/v1/" +
      TABLE +
      "?id=eq." +
      encodeURIComponent(ROW_ID) +
      "&select=config";
    var r = await fetch(u, {
      headers: {
        apikey: c.anonKey,
        Authorization: "Bearer " + c.anonKey,
        Accept: "application/json"
      }
    });
    if (!r.ok) return null;
    var rows = await r.json();
    var row = rows && rows[0];
    if (!row || row.config == null) return null;
    return typeof row.config === "object" ? row.config : null;
  }

  async function fetchAnalyticsData() {
    var client = getClient();
    if (!client) return null;
    var res = await client
      .from(ANALYTICS_TABLE)
      .select("data")
      .eq("id", ANALYTICS_ID)
      .maybeSingle();
    if (res.error || !res.data || res.data.data == null) return null;
    return res.data.data;
  }

  async function trackBiolink(kind, label) {
    var client = getClient();
    if (!client) return null;
    var res = await client.rpc("biolink_track", {
      p_kind: kind,
      p_label: label || "",
      p_day: clientLocalDayKey()
    });
    if (res.error) return null;
    return res.data;
  }

  async function trackBiolinkRest(kind, label, dayKey) {
    var c = global.MYEO_SUPABASE;
    if (!c || !c.url || !c.anonKey) return null;
    var base = String(c.url).replace(/\/$/, "");
    var r = await fetch(base + "/rest/v1/rpc/biolink_track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: c.anonKey,
        Authorization: "Bearer " + c.anonKey
      },
      body: JSON.stringify({
        p_kind: kind,
        p_label: label || "",
        p_day: dayKey || clientLocalDayKey()
      })
    });
    if (!r.ok) return null;
    try {
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  async function resetAnalyticsAuthenticated() {
    var client = getClient();
    if (!client) throw new Error("Supabase not configured");
    var session = await global.myeoSupabaseAuth.getSession();
    if (!session) throw new Error("Sign in required");
    var empty = { total: 0, days: {}, clicks: {} };
    var res = await client
      .from(ANALYTICS_TABLE)
      .update({ data: empty, updated_at: new Date().toISOString() })
      .eq("id", ANALYTICS_ID);
    if (res.error) throw res.error;
    return true;
  }

  global.myeoBiolinkRemote = {
    TABLE: TABLE,
    ROW_ID: ROW_ID,
    clientLocalDayKey: clientLocalDayKey,
    mergeWithDefaults: mergeWithDefaults,
    fetchPublicBiolinkConfig: fetchPublicBiolinkConfig,
    savePublicBiolinkConfig: savePublicBiolinkConfig,
    fetchPublicBiolinkConfigRest: fetchPublicBiolinkConfigRest,
    fetchAnalyticsData: fetchAnalyticsData,
    trackBiolink: trackBiolink,
    trackBiolinkRest: trackBiolinkRest,
    resetAnalyticsAuthenticated: resetAnalyticsAuthenticated
  };
})(typeof window !== "undefined" ? window : globalThis);
