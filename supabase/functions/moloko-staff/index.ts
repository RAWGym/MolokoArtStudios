// Staff accounts for the Moloko Studio CRM.
// Logins are mapped to internal e-mails (<login>@staff.moloko.invalid) so the team signs in
// with a plain login + password, and nobody needs a real mailbox.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const DOMAIN = "staff.moloko.invalid";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LOGIN_RE = /^[a-z0-9._-]{3,32}$/;

async function caller(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: row } = await admin.from("moloko_staff").select("*").eq("user_id", data.user.id).maybeSingle();
  if (!row || row.disabled) return null;
  return row as { user_id: string; role: string; login: string };
}

const ROLES = ["owner", "admin", "accountant", "tech", "smm"];

async function createAccount(login: string, name: string, password: string, role: string, by: string | null) {
  if (!LOGIN_RE.test(login)) return json({ error: "bad_login" }, 400);
  if (typeof password !== "string" || password.length < 6) return json({ error: "weak_password" }, 400);
  name = String(name || "").trim().slice(0, 80) || login;
  const { data: exists } = await admin.from("moloko_staff").select("user_id").eq("login", login).maybeSingle();
  if (exists) return json({ error: "login_taken" }, 409);
  const { data, error } = await admin.auth.admin.createUser({
    email: `${login}@${DOMAIN}`, password, email_confirm: true, user_metadata: { login, name },
  });
  if (error || !data.user) return json({ error: "auth_error", detail: error?.message }, 400);
  const { error: e2 } = await admin.from("moloko_staff").insert({ user_id: data.user.id, login, name, role, created_by: by });
  if (e2) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: "db_error", detail: e2.message }, 400); }
  return json({ ok: true, user_id: data.user.id });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const login = String(body.login || "").trim().toLowerCase();

  switch (body.action) {
    case "bootstrap": {
      // Only while the studio has no accounts at all: creates the first owner.
      const { count } = await admin.from("moloko_staff").select("user_id", { count: "exact", head: true });
      if ((count ?? 0) > 0) return json({ error: "already_set_up" }, 403);
      return createAccount(login, body.name, body.password, "owner", null);
    }
    case "create": {
      const me = await caller(req);
      if (!me || me.role !== "owner") return json({ error: "forbidden" }, 403);
      return createAccount(login, body.name, body.password, ROLES.includes(body.role) ? body.role : "admin", me.user_id);
    }
    case "set_disabled": {
      const me = await caller(req);
      if (!me || me.role !== "owner") return json({ error: "forbidden" }, 403);
      if (body.user_id === me.user_id) return json({ error: "self" }, 400);
      const disabled = !!body.disabled;
      const { error } = await admin.from("moloko_staff").update({ disabled }).eq("user_id", body.user_id);
      if (error) return json({ error: "db_error" }, 400);
      await admin.auth.admin.updateUserById(body.user_id, { ban_duration: disabled ? "876000h" : "none" });
      return json({ ok: true });
    }
    case "set_password": {
      const me = await caller(req);
      if (!me || me.role !== "owner") return json({ error: "forbidden" }, 403);
      if (typeof body.password !== "string" || body.password.length < 6) return json({ error: "weak_password" }, 400);
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
      if (error) return json({ error: "auth_error" }, 400);
      return json({ ok: true });
    }
    case "set_role": {
      const me = await caller(req);
      if (!me || me.role !== "owner") return json({ error: "forbidden" }, 403);
      if (body.user_id === me.user_id) return json({ error: "self" }, 400);
      if (!ROLES.includes(body.role)) return json({ error: "bad_role" }, 400);
      const { error } = await admin.from("moloko_staff").update({ role: body.role }).eq("user_id", body.user_id);
      if (error) return json({ error: "db_error" }, 400);
      return json({ ok: true });
    }
    default:
      return json({ error: "unknown_action" }, 400);
  }
});
