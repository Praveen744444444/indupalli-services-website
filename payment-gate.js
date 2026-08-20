/* ==========================================================
   INDUPALLI SERVICES — Premium Access Gate (Supabase Version)
   Checks payment status, shows paywall, handles UPI request flow
   Usage: import and call initPaymentGate(user, role, onUnlocked)
========================================================== */

import { supabase } from "./supabase.js";
import { payWithRazorpay, waitForUnlock } from "./razorpay-client.js";

const PRICING = {
  candidate: { amount: 49,  label: "Candidate Access" },
  recruiter: { amount: 299, label: "Recruiter Access" }
};

// 👉 DEVELOPMENT MODE — set to true when you're ready to charge for
// access again. While false, every candidate/recruiter unlocks
// immediately, no payment required, and no paywall is ever shown.
const PAYWALL_ENABLED = false;

const ADMIN_EMAIL = "praveencenaindupalli@gmail.com";

/**
 * Main entry point.
 * @param {object} user - Supabase auth user object (or user object with id/uid and email)
 * @param {string} role - "candidate" or "recruiter"
 * @param {function} onUnlocked - callback to run once access is confirmed
 */
export async function initPaymentGate(user, role, onUnlocked) {
  // Admin always bypasses the paywall and sees the approval panel instead
  if (user?.email === ADMIN_EMAIL) {
    onUnlocked();
    showAdminApprovalPanel();
    return;
  }

  if (!PAYWALL_ENABLED) {
    onUnlocked();
    return;
  }

  const tableName = role === "recruiter" ? "recruiters" : "candidates";
  const userId = user?.id || user?.uid;

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    const userData = data || {};

    if (userData.isPaid === true) {
      // Already paid — unlock immediately
      onUnlocked();
      return;
    }

    // Check if there's a pending request already
    if (userData.paymentStatus === "pending") {
      showPaywall(user, role, "pending", onUnlocked);
    } else {
      showPaywall(user, role, "none", onUnlocked);
    }
  } catch (e) {
    console.error("Payment gate check failed:", e);
    // Fail SAFE — if we can't verify payment status, show the paywall
    showPaywall(user, role, "none", onUnlocked);
  }
}

function showPaywall(user, role, status, onUnlockedCallback) {
  const pricing = PRICING[role] || PRICING.candidate;
  const userId = user?.id || user?.uid;

  const overlay = document.createElement("div");
  overlay.id = "paymentGateOverlay";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:999999;
    background:linear-gradient(160deg,#001233,#001b70,#0038c8);
    display:flex;align-items:center;justify-content:center;
    font-family:'Poppins','Segoe UI',sans-serif;
    padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      background:#fff;border-radius:24px;padding:36px 32px;
      max-width:420px;width:100%;text-align:center;
      box-shadow:0 30px 80px rgba(0,0,0,.4);
    ">
      <div style="
        width:64px;height:64px;border-radius:50%;
        background:linear-gradient(135deg,#0056d2,#003ea8);
        display:flex;align-items:center;justify-content:center;
        margin:0 auto 18px;font-size:28px;
      ">🔒</div>

      <h2 style="font-size:22px;font-weight:800;color:#001233;margin-bottom:8px;">
        Premium Access Required
      </h2>
      <p style="font-size:14px;color:#777;line-height:1.6;margin-bottom:24px;">
        Unlock your ${role === "recruiter" ? "Recruiter" : "Candidate"} dashboard with a one-time payment.
      </p>

      <div style="
        background:#f0f4ff;border-radius:16px;padding:20px;margin-bottom:24px;
      ">
        <div style="font-size:13px;color:#888;font-weight:600;letter-spacing:.5px;text-transform:uppercase;">
          ${pricing.label}
        </div>
        <div style="font-size:36px;font-weight:900;color:#0056d2;margin-top:6px;">
          ₹${pricing.amount}
        </div>
        <div style="font-size:12px;color:#aaa;margin-top:4px;">One-time payment</div>
      </div>

      <div id="paywallStatus">
        <button id="razorpayPayBtn" style="
          width:100%;display:flex;align-items:center;justify-content:center;gap:10px;
          padding:15px;background:linear-gradient(135deg,#0056d2,#003ea8);
          color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;
          cursor:pointer;margin-bottom:8px;
          box-shadow:0 6px 20px rgba(0,86,210,.3);
        ">
          ⚡ Pay ₹${pricing.amount} — Instant Access
        </button>
        <p id="razorpaySubtext" style="font-size:11px;color:#aaa;margin-bottom:0;">
          Card, UPI, or netbanking. Unlocks automatically — no waiting on approval.
        </p>
      </div>

      <p id="paywallHint" style="font-size:11px;color:#bbb;margin-top:18px;line-height:1.6;"></p>

      <button id="paywallLogoutBtn" style="
        margin-top:16px;background:none;border:none;
        color:#999;font-size:12px;text-decoration:underline;cursor:pointer;
      ">
        Logout instead
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const razorpayBtn = document.getElementById("razorpayPayBtn");
  razorpayBtn.addEventListener("click", async () => {
    razorpayBtn.textContent = "⏳ Opening payment...";
    razorpayBtn.disabled = true;

    try {
      await payWithRazorpay({ purpose: role, user });

      razorpayBtn.textContent = "✅ Payment received — verifying...";
      const tableName = role === "recruiter" ? "recruiters" : "candidates";

      // Wait for Supabase Realtime confirmation
      await waitForUnlock(supabase, tableName, userId, "isPaid", { timeoutMs: 25000 });

      document.getElementById("paymentGateOverlay").remove();
      onUnlockedCallback();
    } catch (e) {
      if (e.message === "cancelled") {
        razorpayBtn.textContent = `⚡ Pay ₹${pricing.amount} — Instant Access`;
        razorpayBtn.disabled = false;
      } else if (e.message === "timeout") {
        razorpayBtn.textContent = "⏳ Still verifying...";
        const hint = document.getElementById("paywallHint");
        if (hint) hint.innerHTML = `Payment received but confirmation is taking longer than usual. This page will unlock automatically once verified. If it doesn't unlock within a few minutes, contact support.`;
      } else {
        alert("Payment could not be completed: " + e.message);
        razorpayBtn.textContent = `⚡ Pay ₹${pricing.amount} — Instant Access`;
        razorpayBtn.disabled = false;
      }
    }
  });

  const logoutBtn = document.getElementById("paywallLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = role === "recruiter" ? "recruiter-login.html" : "login.html";
    });
  }
}

/* ════════════════════════════════════════════════════════════
   ADMIN APPROVAL PANEL (Supabase Version)
════════════════════════════════════════════════════════════ */
function showAdminApprovalPanel() {
  const fab = document.createElement("button");
  fab.id = "adminPaymentFab";
  fab.innerHTML = "💳";
  fab.title = "Payment Requests";
  fab.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:99998;
    width:56px;height:56px;border-radius:50%;border:none;
    background:linear-gradient(135deg,#0056d2,#003ea8);
    color:#fff;font-size:24px;cursor:pointer;
    box-shadow:0 8px 24px rgba(0,86,210,.4);
  `;
  document.body.appendChild(fab);

  fab.addEventListener("click", () => openAdminPanel());
}

async function openAdminPanel() {
  const existing = document.getElementById("adminPaymentPanel");
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement("div");
  overlay.id = "adminPaymentPanel";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:999999;
    background:rgba(0,18,51,.6);
    display:flex;align-items:center;justify-content:center;
    font-family:'Poppins','Segoe UI',sans-serif;padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      background:#fff;border-radius:22px;padding:28px;
      max-width:520px;width:100%;max-height:80vh;overflow-y:auto;
      box-shadow:0 30px 80px rgba(0,0,0,.4);
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <h2 style="font-size:19px;font-weight:800;color:#001233;">💳 Payment Requests</h2>
        <button id="closeAdminPanelBtn" style="
          background:#f0f4ff;border:none;width:32px;height:32px;border-radius:50%;
          font-size:16px;cursor:pointer;color:#555;
        ">✕</button>
      </div>
      <div id="adminRequestsList" style="display:flex;flex-direction:column;gap:12px;">
        <p style="text-align:center;color:#888;padding:20px;">Loading requests...</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.getElementById("closeAdminPanelBtn").addEventListener("click", () => overlay.remove());

  await loadPendingRequests();
}

async function loadPendingRequests() {
  const listEl = document.getElementById("adminRequestsList");
  if (!listEl) return;

  try {
    const { data: requests, error } = await supabase
      .from("paymentRequests")
      .select("*")
      .eq("status", "pending")
      .order("requestedAt", { ascending: false });

    if (error) throw error;

    if (!requests || requests.length === 0) {
      listEl.innerHTML = `<p style="text-align:center;color:#888;padding:30px;">🎉 No pending requests right now.</p>`;
      return;
    }

    listEl.innerHTML = requests.map(r => `
      <div style="
        background:#f8f9ff;border:1px solid #e0e8ff;border-radius:14px;
        padding:16px;display:flex;flex-direction:column;gap:10px;
      ">
        <div>
          <div style="font-weight:700;color:#001233;font-size:14px;">${r.email}</div>
          <div style="font-size:12px;color:#888;margin-top:2px;">
            ${r.role === "recruiter" ? "👔 Recruiter" : "🧑‍💼 Candidate"} · ₹${r.amount}
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="approveBtn" data-id="${r.id}" data-uid="${r.userId}" data-role="${r.role}" style="
            flex:1;padding:10px;background:#00b86b;color:#fff;border:none;
            border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;
          ">✅ Approve</button>
          <button class="rejectBtn" data-id="${r.id}" style="
            flex:1;padding:10px;background:#fff;color:#ef4444;border:2px solid #ef4444;
            border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;
          ">✕ Reject</button>
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll(".approveBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.textContent = "⏳ Approving...";
        btn.disabled = true;
        try {
          await approveRequest(btn.dataset.id, btn.dataset.uid, btn.dataset.role);
          await loadPendingRequests();
        } catch (e) {
          alert("Could not approve: " + e.message);
        }
      });
    });

    listEl.querySelectorAll(".rejectBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.textContent = "⏳ Rejecting...";
        btn.disabled = true;
        try {
          const { error: updateErr } = await supabase
            .from("paymentRequests")
            .update({
              status: "rejected",
              rejectedAt: new Date().toISOString()
            })
            .eq("id", btn.dataset.id);

          if (updateErr) throw updateErr;
          await loadPendingRequests();
        } catch (e) {
          alert("Could not reject: " + e.message);
        }
      });
    });

  } catch (e) {
    listEl.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px;">Error loading requests: ${e.message}</p>`;
  }
}

async function approveRequest(requestId, userId, role) {
  const tableName = role === "recruiter" ? "recruiters" : "candidates";
  const now = new Date().toISOString();

  const { error: reqErr } = await supabase
    .from("paymentRequests")
    .update({
      status: "approved",
      approvedAt: now
    })
    .eq("id", requestId);

  if (reqErr) throw reqErr;

  const { error: userErr } = await supabase
    .from(tableName)
    .upsert({
      id: userId,
      isPaid: true,
      paymentStatus: "approved",
      approvedAt: now
    }, { onConflict: 'id' });

  if (userErr) throw userErr;
}