/* ==========================================================
   INDUPALLI SERVICES — Razorpay Checkout Helper (Supabase Version)
   Loads checkout.js, asks your Vercel backend for an order,
   opens the popup. Resolves once the user completes payment
   client-side — the actual database unlock (isPaid /
   databaseAccess) happens server-side in razorpay-webhook.js
   on Vercel, NOT here. Never trust the client for that.
========================================================== */

import { supabase } from "./supabase.js";

// 👉 Set this to your deployed Vercel URL once you've deployed
// razorpay-backend/ (e.g. "https://indupalli-razorpay.vercel.app")
const BACKEND_BASE_URL = "https://YOUR-VERCEL-PROJECT.vercel.app";

let scriptPromise = null;

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay checkout script."));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Opens Razorpay checkout for a given purpose.
 * @param {object} opts
 * @param {("candidate"|"recruiter"|"database-unlock")} opts.purpose
 * @param {object} opts.user - the Supabase user object
 * @returns {Promise<object>} resolves with the Razorpay response on client-side success
 */
export async function payWithRazorpay({ purpose, user }) {
  await loadRazorpayScript();

  // Get Supabase Session Access Token
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session || !session.access_token) {
    throw new Error("Not signed in.");
  }
  const accessToken = session.access_token;

  const orderRes = await fetch(`${BACKEND_BASE_URL}/api/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({ purpose })
  });

  if (!orderRes.ok) {
    const err = await orderRes.json().catch(() => ({}));
    throw new Error(err.error || `Order creation failed (${orderRes.status})`);
  }

  const data = await orderRes.json();

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      order_id: data.orderId,
      name: "Indupalli Services",
      description: purpose === "database-unlock" ? "Resume Database Unlock" : "Dashboard Access",
      prefill: { email: user?.email || session.user.email || "", name: user?.user_metadata?.full_name || "" },
      theme: { color: "#0056d2" },
      handler: function (response) {
        resolve(response);
      },
      modal: {
        ondismiss: function () {
          reject(new Error("cancelled"));
        }
      }
    });

    rzp.on("payment.failed", function (response) {
      reject(new Error(response?.error?.description || "Payment failed."));
    });

    rzp.open();
  });
}

/**
 * Waits (up to timeoutMs) for a Supabase row field to become true using Realtime channels.
 * Used after a successful Razorpay payment to detect the webhook's auto-approval
 * without the user needing to refresh.
 */
export function waitForUnlock(supabaseClient, tableName, recordId, fieldName, { timeoutMs = 25000 } = {}) {
  return new Promise(async (resolve, reject) => {
    let done = false;

    // Check immediately in case webhook already processed before subscription started
    try {
      const { data, error } = await supabaseClient
        .from(tableName)
        .select(fieldName)
        .eq("id", recordId)
        .maybeSingle();

      if (!error && data && data[fieldName] === true) {
        done = true;
        return resolve();
      }
    } catch (e) {
      // Ignore initial lookup failure and proceed with realtime channel
    }

    // Subscribe to Supabase Realtime channel for database updates
    const channelName = `payment_unlock_${tableName}_${recordId}_${Date.now()}`;
    const channel = supabaseClient
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: tableName,
          filter: `id=eq.${recordId}`
        },
        (payload) => {
          const newData = payload.new || {};
          if (newData[fieldName] === true && !done) {
            done = true;
            supabaseClient.removeChannel(channel);
            resolve();
          }
        }
      )
      .subscribe();

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        supabaseClient.removeChannel(channel);
        reject(new Error("timeout"));
      }
    }, timeoutMs);
  });
}