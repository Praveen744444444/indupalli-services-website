/* ==========================================================
   INDUPALLI SERVICES — Recruiter Payment Gate Hook (Supabase Version)
   Runs on recruiter-dashboard.html. Checks payment status via Supabase.
========================================================== */

import { initPaymentGate } from "./payment-gate.js";
import { supabase } from "./supabase.js";

const ADMIN_EMAIL = "praveencenaindupalli@gmail.com";

// Check current session on load
supabase.auth.getSession().then(({ data: { session } }) => {
  const user = session?.user;
  if (!user) {
    window.location.href = "recruiter-login.html";
    return;
  }

  // Admin always has full access — no paywall, sees approval panel
  if (user.email === ADMIN_EMAIL) {
    showAdminPaymentPanel();
    return;
  }

  // Regular recruiter — check payment status, gate the dashboard
  initPaymentGate(user, "recruiter", () => {
    // Access confirmed — dashboard.js's own DOMContentLoaded
    // listener already called loadJobs()/loadApplications(),
    // nothing else needed here.
  });
});

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  const user = session?.user;
  if (!user && window.location.pathname.includes("recruiter-dashboard.html")) {
    window.location.href = "recruiter-login.html";
  }
});

/* ── Admin: Payment Requests Approval Panel ─────────────────── */
async function showAdminPaymentPanel() {
  const panel = document.getElementById("paymentRequestsPanel");
  if (panel) panel.style.display = "block";

  await loadPaymentRequests();
}

async function loadPaymentRequests() {
  const container = document.getElementById("paymentRequestsContainer");
  const countBadge = document.getElementById("pendingRequestCount");
  if (!container) return;

  try {
    const { data: requests, error } = await supabase
      .from("paymentRequests")
      .select("*")
      .eq("status", "pending")
      .order("requestedAt", { ascending: false });

    if (error) throw error;

    if (countBadge) countBadge.textContent = `${requests?.length || 0} pending`;

    if (!requests || !requests.length) {
      container.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8;">No pending payment requests 🎉</td></tr>`;
      return;
    }

    container.innerHTML = requests.map(r => {
      const requestedDate = r.requestedAt
        ? new Date(r.requestedAt).toLocaleDateString("en-IN")
        : "—";
      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:12px;font-size:13px;">${r.email}</td>
          <td style="padding:12px;font-size:13px;text-transform:capitalize;">${r.role}</td>
          <td style="padding:12px;font-size:13px;font-weight:700;">₹${r.amount}</td>
          <td style="padding:12px;font-size:12px;color:#64748b;">${requestedDate}</td>
          <td style="padding:12px;">
            <button data-id="${r.id}" data-uid="${r.userId}" data-role="${r.role}" class="approveBtn"
              style="background:#16a34a;color:#fff;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;margin-right:6px;">
              ✅ Approve
            </button>
            <button data-id="${r.id}" class="rejectBtn"
              style="background:#ef4444;color:#fff;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">
              ❌ Reject
            </button>
          </td>
        </tr>`;
    }).join("");

    container.querySelectorAll(".approveBtn").forEach(btn => {
      btn.addEventListener("click", () => approveRequest(btn.dataset.id, btn.dataset.uid, btn.dataset.role));
    });
    container.querySelectorAll(".rejectBtn").forEach(btn => {
      btn.addEventListener("click", () => rejectRequest(btn.dataset.id));
    });

  } catch (e) {
    container.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#ef4444;">Error loading requests: ${e.message}</td></tr>`;
  }
}

async function approveRequest(requestId, userId, role) {
  try {
    const now = new Date().toISOString();
    const { error: reqError } = await supabase
      .from("paymentRequests")
      .update({
        status: "approved",
        approvedAt: now
      })
      .eq("id", requestId);

    if (reqError) throw reqError;

    const tableName = role === "recruiter" ? "recruiters" : "candidates";
    const { error: userError } = await supabase
      .from(tableName)
      .upsert({
        id: userId,
        isPaid: true,
        paymentStatus: "approved",
        approvedAt: now
      }, { onConflict: 'id' });

    if (userError) throw userError;

    await loadPaymentRequests();
  } catch (e) {
    window.showToast("Could not approve: " + e.message, "error");
  }
}

async function rejectRequest(requestId) {
  window.showConfirm("Reject Request?", "This will reject the payment request.", async () => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("paymentRequests")
        .update({
          status: "rejected",
          rejectedAt: now
        })
        .eq("id", requestId);

      if (error) throw error;
      await loadPaymentRequests();
    } catch (e) {
      window.showToast("Could not reject: " + e.message, "error");
    }
  });
}