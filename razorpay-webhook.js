// api/razorpay-webhook.js
// Razorpay calls this the moment a payment is captured. Verifies the
// signature, then grants access in Supabase automatically — this is
// the ONLY place access is ever granted, never the client.

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase Server Client using Service Role Key
function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables on server.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// Vercel parses JSON by default — we need the RAW body to verify the
// signature, so body parsing is turned off here.
module.exports.config = {
  api: { bodyParser: false }
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const signature = req.headers["x-razorpay-signature"];
  if (!signature) return res.status(400).send("Missing signature");

  const rawBody = await getRawBody(req);

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (expected !== signature) {
    console.error("razorpay-webhook: signature mismatch — rejecting.");
    return res.status(400).send("Invalid signature");
  }

  const body = JSON.parse(rawBody.toString("utf8"));
  const event = body.event;

  if (event !== "payment.captured") {
    return res.status(200).send("ignored");
  }

  const payment = body.payload?.payment?.entity;
  const notes = payment?.notes || {};
  const { uid, purpose, email } = notes;

  if (!uid || !purpose) {
    console.error("razorpay-webhook: payment missing uid/purpose in notes", notes);
    return res.status(200).send("ok"); // ack — nothing we can do without these
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (purpose === "database-unlock") {
      // Upsert recruiter database access status
      const { error: recError } = await supabase
        .from("recruiters")
        .upsert({
          id: uid,
          databaseAccess: true,
          databaseRequestStatus: "approved",
          databaseApprovedAt: now,
          databasePaymentId: payment.id
        }, { onConflict: 'id' });

      if (recError) throw recError;

      // Insert log into databaseRequests table
      const { error: reqError } = await supabase
        .from("databaseRequests")
        .insert([{
          userId: uid,
          email: email || "",
          amount: payment.amount / 100,
          status: "approved",
          method: "razorpay",
          razorpayPaymentId: payment.id,
          requestedAt: now,
          approvedAt: now
        }]);

      if (reqError) throw reqError;

    } else {
      const tableName = purpose === "recruiter" ? "recruiters" : "candidates";

      // Upsert user payment status
      const { error: userError } = await supabase
        .from(tableName)
        .upsert({
          id: uid,
          isPaid: true,
          paymentStatus: "approved",
          approvedAt: now,
          paymentId: payment.id
        }, { onConflict: 'id' });

      if (userError) throw userError;

      // Insert log into paymentRequests table
      const { error: payError } = await supabase
        .from("paymentRequests")
        .insert([{
          userId: uid,
          email: email || "",
          role: purpose,
          amount: payment.amount / 100,
          status: "approved",
          method: "razorpay",
          razorpayPaymentId: payment.id,
          requestedAt: now,
          approvedAt: now
        }]);

      if (payError) throw payError;
    }

    console.log(`Auto-approved "${purpose}" for uid=${uid} via Razorpay payment ${payment.id}`);
    return res.status(200).send("ok");
  } catch (e) {
    console.error("razorpay-webhook: failed to grant access", e);
    return res.status(500).send("Supabase update failed"); // Razorpay will retry
  }
};