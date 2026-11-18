// Publishing of the Moloko CRM apps (Android APK, Windows installer) to the public bucket "moloko-apps".
// Only the GitHub Actions build of RAWGym/MolokoArtStudios can call it: the caller sends the job's
// OpenID Connect token, which is verified against GitHub's keys. No shared secret exists anywhere.
// Builds from main may write anything; other branches only under preview/ and logs/.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const REPO = "RAWGym/MolokoArtStudios";
const BUCKET = "moloko-apps";
const ISSUER = "https://token.actions.githubusercontent.com";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));
const PATH_RE = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._\/-]{0,160}$/;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const token = req.headers.get("x-gh-oidc") ?? "";
  let claims: Record<string, unknown>;
  try {
    ({ payload: claims } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: "moloko-apps" }));
  } catch {
    return json({ error: "unauthorized" }, 401);
  }
  if (claims.repository !== REPO) return json({ error: "forbidden" }, 403);
  const main = claims.ref === "refs/heads/main";

  let paths: string[] = [];
  try { paths = (await req.json()).paths ?? []; } catch { return json({ error: "bad_json" }, 400); }
  if (!Array.isArray(paths) || !paths.length || paths.length > 20) return json({ error: "bad_paths" }, 400);

  const { data: bucket } = await admin.storage.getBucket(BUCKET);
  if (!bucket) {
    const { error } = await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: "50MB" });
    if (error && !/exists/i.test(error.message)) return json({ error: "bucket", detail: error.message }, 500);
  }

  const out: Record<string, string> = {};
  for (const p of paths) {
    if (typeof p !== "string" || !PATH_RE.test(p)) return json({ error: "bad_path", path: p }, 400);
    if (!main && !p.startsWith("preview/") && !p.startsWith("logs/")) return json({ error: "branch_not_allowed", path: p }, 403);
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(p, { upsert: true });
    if (error || !data) return json({ error: "sign", path: p, detail: error?.message }, 500);
    out[p] = data.signedUrl;
  }
  return json({ urls: out, main });
});
