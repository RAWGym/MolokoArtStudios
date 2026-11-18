// Client cabinet accounts for the booking widget.
// A client signs in with phone + password; the phone is mapped to <digits>@client.moloko.invalid.
// Without SMS the phone is not proven at sign-up, so bonuses and history open only after the
// studio confirms it (a booking made from the account gets paid, or staff verify it in the CRM).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const DOMAIN = "client.moloko.invalid";
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

const norm = (p: unknown) => {
  const d = String(p ?? "").replace(/\D/g, "");
  if (/^8\d{10}$/.test(d)) return "7" + d.slice(1);
  if (/^\d{10}$/.test(d)) return "7" + d;
  return d;
};

async function staffCaller(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return null;
  const { data: row } = await admin.from("moloko_staff").select("*").eq("user_id", data.user.id).maybeSingle();
  return row && !row.disabled && ["owner", "admin"].includes(row.role) ? row : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const phone = norm(body.phone);

  switch (body.action) {
    case "register": {
      if (!/^7\d{10}$/.test(phone)) return json({ error: "bad_phone" }, 400);
      if (typeof body.password !== "string" || body.password.length < 6) return json({ error: "weak_password" }, 400);
      const name = String(body.name || "").trim().slice(0, 80);
      const { data: acc } = await admin.from("moloko_accounts").select("user_id").eq("phone", phone).maybeSingle();
      if (acc) return json({ error: "phone_taken" }, 409);
      const { data: client } = await admin.from("moloko_clients").select("phone, blocked, name").eq("phone", phone).maybeSingle();
      if (client?.blocked) return json({ error: "blocked" }, 403);
      if (!client) await admin.from("moloko_clients").insert({ phone, name });
      else if (!client.name && name) await admin.from("moloko_clients").update({ name }).eq("phone", phone);
      const { data, error } = await admin.auth.admin.createUser({
        email: `${phone}@${DOMAIN}`, password: body.password, email_confirm: true, user_metadata: { phone, name, client: true },
      });
      if (error || !data.user) return json({ error: /already/i.test(error?.message ?? "") ? "phone_taken" : "auth_error" }, 400);
      const { error: e2 } = await admin.from("moloko_accounts").insert({ user_id: data.user.id, phone });
      if (e2) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: "db_error" }, 400); }
      return json({ ok: true });
    }
    case "reset_password": {
      // staff set a new cabinet password for a client who forgot theirs (after checking them by phone)
      const me = await staffCaller(req);
      if (!me) return json({ error: "forbidden" }, 403);
      if (typeof body.password !== "string" || body.password.length < 6) return json({ error: "weak_password" }, 400);
      const { data: acc } = await admin.from("moloko_accounts").select("user_id").eq("phone", phone).maybeSingle();
      if (!acc) return json({ error: "no_account" }, 404);
      const { error } = await admin.auth.admin.updateUserById(acc.user_id, { password: body.password });
      if (error) return json({ error: "auth_error" }, 400);
      return json({ ok: true });
    }
    default:
      return json({ error: "unknown_action" }, 400);
  }
});
