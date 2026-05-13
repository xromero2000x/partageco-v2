/**
 * Phase 10 — Static verification
 * Scans the codebase for forbidden patterns. NO new functionality.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

type Finding = { check: string; severity: "ok" | "warn" | "fail"; detail: string };
const findings: Finding[] = [];
const ROOT = new URL("../../", import.meta.url).pathname;
const SRC = join(ROOT, "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

const allFiles = walk(SRC).filter((f) => /\.(t|j)sx?$/.test(f));
const tsxRoutes = readdirSync(join(SRC, "routes")).filter((f) => f.endsWith(".tsx"));

// --- D1: Périmètre MVP — no forbidden modules / routes ---
const FORBIDDEN_ROUTE_PATTERNS = [
  /wallet/i, /kyc/i, /scoring/i, /parrainage|referral/i, /premium/i,
  /gamification/i, /avis|reviews?/i, /sponsor/i, /scrap/i, /import.*csv/i,
  /facturation|invoice/i, /remboursement|refund/i,
];
for (const pat of FORBIDDEN_ROUTE_PATTERNS) {
  const hits = tsxRoutes.filter((f) => pat.test(f));
  findings.push({
    check: `D1 forbidden route pattern ${pat}`,
    severity: hits.length ? "fail" : "ok",
    detail: hits.length ? hits.join(", ") : "no matching routes",
  });
}

// No public API routes
const apiDir = join(SRC, "routes", "api");
findings.push({
  check: "D1 no /api/public/* endpoints",
  severity: existsSync(apiDir) ? "fail" : "ok",
  detail: existsSync(apiDir) ? "src/routes/api exists" : "absent",
});

// --- D8: No real payment buttons / providers ---
const FORBIDDEN_TEXTS: { pat: RegExp; label: string }[] = [
  { pat: /\bstripe\b/i, label: "Stripe SDK reference" },
  { pat: /\bpaddle\b/i, label: "Paddle SDK reference" },
  { pat: /['"]Payer['"]|>\s*Payer\s*</, label: 'Bouton "Payer"' },
  { pat: /checkout\.session/i, label: "checkout.session" },
];
for (const { pat, label } of FORBIDDEN_TEXTS) {
  const hits: string[] = [];
  for (const f of allFiles) {
    const c = readFileSync(f, "utf8");
    if (pat.test(c)) hits.push(relative(ROOT, f));
  }
  findings.push({
    check: `D8 forbidden: ${label}`,
    severity: hits.length ? "fail" : "ok",
    detail: hits.length ? hits.join(", ") : "absent",
  });
}

// --- D11: Notifications mapping strict ---
const ALLOWED_NOTIF_TYPES = new Set([
  "email_verification", "admin_action", "participation_request",
  "participation_status_changed", "message_received", "dispute_updated",
]);
const notifFile = join(SRC, "lib", "notifications.functions.ts");
if (existsSync(notifFile)) {
  const c = readFileSync(notifFile, "utf8");
  const usedTypes = Array.from(c.matchAll(/notification_type['"]?\s*[:=]\s*['"]([a-z_]+)['"]/g)).map((m) => m[1]);
  const bad = usedTypes.filter((t) => !ALLOWED_NOTIF_TYPES.has(t));
  findings.push({
    check: "D11 notification_type within mapping",
    severity: bad.length ? "fail" : "ok",
    detail: bad.length ? `unknown: ${bad.join(",")}` : `seen: ${[...new Set(usedTypes)].join(",")}`,
  });
}

// --- D12: Audit envelope format ---
const auditFiles = allFiles.filter((f) => /\.functions\.ts$/.test(f));
let auditOk = true;
const auditDetails: string[] = [];
for (const f of auditFiles) {
  const c = readFileSync(f, "utf8");
  if (/audit_logs/.test(c) && /\.insert\(/.test(c)) {
    const hasEnvelope = /entity_type/.test(c) && /entity_id/.test(c) && /changed_fields/.test(c) && /before/.test(c) && /after/.test(c);
    if (!hasEnvelope) {
      auditOk = false;
      auditDetails.push(relative(ROOT, f));
    }
  }
}
findings.push({
  check: "D12 audit envelope (entity_type, entity_id, changed_fields, before, after)",
  severity: auditOk ? "ok" : "fail",
  detail: auditOk ? "all audit-emitting functions wrap envelope" : `missing in: ${auditDetails.join(", ")}`,
});

// --- D8: No SUPABASE_SERVICE_ROLE_KEY in client code ---
const clientFiles = allFiles.filter((f) => !/\.server\.ts$|\.functions\.ts$|\/routes\/api\//.test(f));
const leak: string[] = [];
for (const f of clientFiles) {
  const c = readFileSync(f, "utf8");
  if (/SERVICE_ROLE_KEY|client\.server/.test(c)) leak.push(relative(ROOT, f));
}
findings.push({
  check: "Security: service role / client.server never imported in client",
  severity: leak.length ? "fail" : "ok",
  detail: leak.length ? leak.join(", ") : "no client-side leak",
});

// --- Output ---
const fails = findings.filter((f) => f.severity === "fail").length;
console.log(JSON.stringify({ findings, summary: { total: findings.length, fails } }, null, 2));
process.exit(fails > 0 ? 1 : 0);
