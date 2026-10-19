import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const HMAC_FIELDS = [
  "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction",
  "id", "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded",
  "is_standalone_payment", "is_voided", "order.id", "owner", "pending",
  "source_data.pan", "source_data.sub_type", "source_data.type", "success"
];
function valueAt(obj, path) {
  return path.split(".").reduce((value, key) => value == null ? undefined : value[key], obj);
}
function validHmac(obj, supplied, secret) {
  if (!obj || typeof supplied !== "string" || !/^[a-f0-9]{128}$/i.test(supplied) || !secret) return false;
  const payload = HMAC_FIELDS.map(field => {
    const value = valueAt(obj, field);
    return value == null ? "" : String(value);
  }).join("");
  const expected = crypto.createHmac("sha512", secret).update(payload).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(supplied, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }
  const secret = process.env.PAYMOB_HMAC_SECRET;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !serviceKey) return res.status(503).send("Payment webhook is not configured");

  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return null; } })() : req.body;
  const obj = body?.obj;
  const suppliedHmac = req.query?.hmac || req.headers["x-paymob-hmac"];
  if (!validHmac(obj, suppliedHmac, secret)) return res.status(401).send("Invalid HMAC");

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const paymobOrderId = String(obj?.order?.id ?? "");
  if (!paymobOrderId) return res.status(400).send("Missing order id");

  const { data: order, error: findError } = await db.from("gift_orders")
    .select("*").eq("paymob_order_id", paymobOrderId).maybeSingle();
  if (findError) {
    console.error("Payment order lookup failed:", findError.message);
    return res.status(500).send("Database lookup failed");
  }
  if (!order) return res.status(200).send("Unknown or already archived order");

  const integrationMatches = String(obj.integration_id) === String(process.env.PAYMOB_WALLET_INTEGRATION_ID);
  const paid = obj.success === true && obj.pending === false && obj.error_occured === false &&
    obj.is_refunded !== true && obj.is_voided !== true &&
    Number(obj.amount_cents) === Number(order.amount_cents) && obj.currency === "EGP" && integrationMatches;

  if (!paid) {
    if (obj.success !== true || obj.error_occured === true) {
      await db.from("gift_orders").update({ status: "failed", paymob_transaction_id: String(obj.id) })
        .eq("id", order.id).eq("status", "pending");
    }
    return res.status(200).send("Payment not successful");
  }

  const { data: existingGift, error: existingError } = await db.from("gifts").select("id").eq("slug", order.slug).maybeSingle();
  if (existingError) {
    console.error("Gift check failed:", existingError.message);
    return res.status(500).send("Gift lookup failed");
  }
  if (!existingGift) {
    const { error: giftError } = await db.from("gifts").insert({
      ...order.gift,
      created_at: new Date().toISOString()
    });
    if (giftError && giftError.code !== "23505") {
      console.error("Paid gift insert failed:", giftError.message);
      return res.status(500).send("Could not publish paid gift");
    }
  }
  const { error: markError } = await db.from("gift_orders").update({
    status: "paid",
    paymob_transaction_id: String(obj.id),
    paid_at: new Date().toISOString()
  }).eq("id", order.id).eq("status", "pending");
  if (markError) {
    console.error("Paid order update failed:", markError.message);
    return res.status(500).send("Could not mark payment paid");
  }
  return res.status(200).send("OK");
}
