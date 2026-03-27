/**
 * Applies Cloudflare zone hardening via API.
 * Auth (one of):
 *   - CLOUDFLARE_API_TOKEN (Bearer), or
 *   - CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY (legacy global key)
 * Optional: CLOUDFLARE_ZONE_ID (skips name lookup)
 *
 * Usage: node scripts/cloudflare-hardening.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const cfgPath = path.join(root, "config", "cloudflare-security.json");

const token = process.env.CLOUDFLARE_API_TOKEN;
const cfEmail = process.env.CLOUDFLARE_EMAIL;
const cfGlobalKey = process.env.CLOUDFLARE_GLOBAL_API_KEY;

const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
/** @type {Record<string, string>} */
let headers;
if (cfEmail && cfGlobalKey) {
  headers = {
    "X-Auth-Email": cfEmail,
    "X-Auth-Key": cfGlobalKey,
    "Content-Type": "application/json",
  };
} else if (token) {
  headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
} else {
  console.error(
    "cloudflare-hardening: set CLOUDFLARE_API_TOKEN or CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY"
  );
  process.exit(1);
}

async function cf(method, url, body) {
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = data.errors?.[0]?.message || res.statusText;
    throw new Error(`${method} ${url} -> ${res.status}: ${err}`);
  }
  return data;
}

async function getZoneId() {
  if (process.env.CLOUDFLARE_ZONE_ID) return process.env.CLOUDFLARE_ZONE_ID;
  const name = cfg.zoneName;
  const data = await cf(
    "GET",
    `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(name)}`,
    null
  );
  const z = data.result?.[0];
  if (!z?.id) throw new Error(`Zone not found: ${name}`);
  return z.id;
}

async function patchSetting(zoneId, id, value) {
  await cf(
    "PATCH",
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/${id}`,
    { value }
  );
  console.log(`cloudflare-hardening: setting ${id} = ${JSON.stringify(value)}`);
}

async function main() {
  const zoneId = await getZoneId();
  console.log(`cloudflare-hardening: zone ${zoneId}`);

  await patchSetting(zoneId, "always_use_https", "on");
  await patchSetting(zoneId, "automatic_https_rewrites", "on");
  await patchSetting(zoneId, "min_tls_version", "1.2");
  await patchSetting(zoneId, "tls_1_3", "on");
  if (cfg.underAttackFallback) {
    await patchSetting(zoneId, "security_level", "under_attack");
  } else {
    await patchSetting(zoneId, "security_level", cfg.securityLevel || "medium");
  }
  await patchSetting(zoneId, "browser_check", "on");

  try {
    await cf(
      "PUT",
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/bot_management`,
      {
        fight_mode: true,
        enable_js: true,
        sbfm_definitely_automated: "block",
        sbfm_likely_automated: "managed_challenge",
        sbfm_verified_bots: "allow",
        sbfm_static_resource_protection: true,
      }
    );
    console.log("cloudflare-hardening: bot_management updated (plan-dependent)");
  } catch (e) {
    console.warn("cloudflare-hardening: bot_management skipped:", e.message);
  }

  const blocked = Array.isArray(cfg.blockedCountries) ? cfg.blockedCountries.filter(Boolean) : [];
  async function createFirewallRulesIfMissing(rulesPayload) {
    const existing = await cf(
      "GET",
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules?per_page=100`,
      null
    );
    const have = new Set((existing.result || []).map((r) => r.description));
    const need = rulesPayload.filter((r) => !have.has(r.description));
    if (!need.length) {
      console.log("cloudflare-hardening: firewall rules already present, skipping create");
      return;
    }
    for (const rule of need) {
      await cf("POST", `https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules`, [rule]);
    }
    console.log("cloudflare-hardening: created", need.length, "firewall rule(s)");
  }

  const rl = cfg.rateLimitPerMinute?.apiAndAuthPaths ?? 120;
  const loginRl = cfg.rateLimitPerMinute?.loginPath ?? 60;

  const rules = [];
  if (blocked.length) {
    const list = blocked.map((c) => `"${String(c).toUpperCase()}"`).join(" ");
    const expression = `(ip.geoip.country in {${list}})`;
    rules.push({
      action: "block",
      description: "myeo: block configured countries",
      filter: { expression, paused: false },
    });
  }

  if (cfg.challengeApiPaths !== false) {
    rules.push({
      action: "challenge",
      description: `myeo: challenge /api paths (ref ${rl}/min); disable in config if it breaks clients`,
      filter: {
        expression: `(http.request.uri.path contains "/api")`,
        paused: false,
      },
    });
  }

  rules.push({
    action: "challenge",
    description: `myeo: challenge login paths (baseline; ref ${loginRl}/min)`,
    filter: {
      expression: `(http.request.uri.path contains "login")`,
      paused: false,
    },
  });

  if (cfg.challengeSuspiciousUserAgents) {
    const uas = [
      "curl",
      "wget",
      "python-requests",
      "aiohttp",
      "scrapy",
      "Go-http",
      "Java/",
      "okhttp",
      "libwww",
      "HeadlessChrome",
      "PhantomJS",
    ];
    const parts = uas.map((s) => `(http.user_agent contains "${s}")`);
    rules.push({
      action: "managed_challenge",
      description: "myeo: challenge suspicious automation user-agents (no-regex)",
      filter: {
        expression: `(${parts.join(" or ")})`,
        paused: false,
      },
    });
  }

  try {
    await createFirewallRulesIfMissing(rules);
  } catch (e) {
    console.warn("cloudflare-hardening: firewall rules create skipped:", e.message);
  }

  try {
    const rs = await cf(
      "GET",
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_firewall_managed/entrypoint`,
      null
    );
    if (rs.result?.id) {
      console.log("cloudflare-hardening: managed WAF entrypoint present:", rs.result.id);
    }
  } catch (e) {
    console.warn("cloudflare-hardening: could not read managed WAF ruleset:", e.message);
  }

  console.log("cloudflare-hardening: done. Enable Super Bot Fight Mode and OWASP Managed Rules in dashboard if your plan supports them.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
