/* ==========================================================
   INDUPALLI SERVICES — Resume Database Gate
   Shows a "15,234 resumes available" card on the recruiter
   dashboard. Recruiters who already have general (₹299) access
   still need a SEPARATE unlock request+approval to view the
   database. Admin gets a settings panel (set count + Drive
   link) and a request-approval queue.
========================================================== */

import {
  doc, getDoc, setDoc, addDoc, collection, serverTimestamp,
  getDocs, query, where, updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { payWithRazorpay, waitForUnlock } from "./razorpay-client.js";

const ADMIN_EMAIL = "praveencenaindupalli@gmail.com";
const UNLOCK_AMOUNT = 299;

// 👉 Matches PAYWALL_ENABLED in payment-gate.js — set both to true
// together when you're ready to charge again.
const PAYWALL_ENABLED = false;

function waitForFirebase(retries = 20) {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (window.auth && window.db) resolve();
      else if (retries <= 0) reject(new Error("Firebase not ready"));
      else { retries--; setTimeout(check, 150); }
    };
    check();
  });
}

waitForFirebase().then(async () => {
  const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  onAuthStateChanged(window.auth, (user) => {
    if (!user) return;
    if (user.email === ADMIN_EMAIL) {
      renderAdminControls(window.db);
    } else {
      renderRecruiterCard(window.db, user);
    }
  });
}).catch(e => console.error("Resume database module failed to start:", e));

/* ── Shared: read the public settings doc (count + drive link) ─── */
async function getSettings(db) {
  const snap = await getDoc(doc(db, "settings", "resumeDatabase"));
  return snap.exists() ? snap.data() : { count: 0, driveLink: "" };
}

/* ════════════════════════════════════════════════════════════
   RECRUITER VIEW
════════════════════════════════════════════════════════════ */
async function renderRecruiterCard(db, user) {
  const card = document.getElementById("resumeDatabaseCard");
  if (!card) return;

  const [settings, recruiterSnap] = await Promise.all([
    getSettings(db),
    getDoc(doc(db, "recruiters", user.uid))
  ]);

  const data = recruiterSnap.exists() ? recruiterSnap.data() : {};
  const count = settings.count || 0;
  const countLabel = count.toLocaleString("en-IN");

  if (!PAYWALL_ENABLED || data.databaseAccess === true) {
    card.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div>
          <h3 style="margin:0 0 4px 0;font-size:16px;font-weight:700;color:#001233;">🗄️ Resume Database</h3>
          <p style="margin:0;color:#00b86b;font-size:13px;font-weight:600;">✅ Unlocked — ${countLabel} resumes available</p>
        </div>
        <a href="${settings.driveLink || '#'}" target="_blank" rel="noopener noreferrer" style="background:#0056d2;color:#fff;padding:12px 20px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;white-space:nowrap;">
          📂 Open Resume Database
        </a>
      </div>`;
    return;
  }

  if (data.databaseRequestStatus === "pending") {
    card.innerHTML = `
      <div style="background:#fff3e0;border:2px solid #ffe0b2;border-radius:12px;padding:20px;">
        <h3 style="margin:0 0 4px 0;font-size:16px;font-weight:700;color:#001233;">🗄️ Resume Database — ${countLabel} resumes available</h3>
        <p style="margin:8px 0 12px 0;color:#a36b00;font-size:13px;">⏳ Manual unlock request pending review — no need to wait, though.</p>
        <button id="requestDbUnlockBtn" style="background:#0056d2;color:#fff;border:none;padding:12px 20px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">
          ⚡ Pay ₹${UNLOCK_AMOUNT} — Instant Unlock
        </button>
      </div>`;
    document.getElementById("requestDbUnlockBtn").addEventListener("click", () => {
      showUnlockPaywall(db, user);
    });
    return;
  }

  card.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #e5e7eb;">
      <h3 style="margin:0 0 4px 0;font-size:16px;font-weight:700;color:#001233;">🗄️ Resume Database</h3>
      <p style="margin:0 0 16px 0;color:#888;font-size:13px;">🔒 ${countLabel} resumes available — unlock to access.</p>
      <button id="requestDbUnlockBtn" style="background:#0056d2;color:#fff;border:none;padding:12px 20px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">
        🔓 Request Unlock — ₹${UNLOCK_AMOUNT}
      </button>
    </div>`;

  document.getElementById("requestDbUnlockBtn").addEventListener("click", () => {
    showUnlockPaywall(db, user);
  });
}

function showUnlockPaywall(db, user) {
  const overlay = document.createElement("div");
  overlay.id = "dbUnlockOverlay";
  overlay.style.cssText = `position:fixed;inset:0;z-index:999999;background:rgba(0,18,51,.65);display:flex;align-items:center;justify-content:center;font-family:'Poppins','Segoe UI',sans-serif;padding:20px;`;
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:30px;max-width:380px;width:100%;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.4);">
      <div style="font-size:28px;margin-bottom:10px;">🗄️</div>
      <h2 style="font-size:19px;font-weight:800;color:#001233;margin-bottom:8px;">Unlock Resume Database</h2>
      <p style="font-size:13px;color:#888;line-height:1.6;margin-bottom:20px;">This is a separate unlock from your dashboard access.</p>
      <div style="background:#f0f4ff;border-radius:14px;padding:16px;margin-bottom:20px;">
        <div style="font-size:30px;font-weight:900;color:#0056d2;">₹${UNLOCK_AMOUNT}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">One-time unlock</div>
      </div>

      <button id="dbRazorpayBtn" style="
        width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
        padding:14px;background:linear-gradient(135deg,#0056d2,#003ea8);color:#fff;
        border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;
      ">
        ⚡ Pay ₹${UNLOCK_AMOUNT} — Instant Unlock
      </button>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:16px;">Card, UPI, or netbanking. Unlocks automatically — no waiting on approval.</p>

      <button id="dbCancelBtn" style="width:100%;padding:10px;background:none;border:none;color:#999;font-size:12px;text-decoration:underline;cursor:pointer;">Cancel</button>
      <p id="dbPaywallHint" style="font-size:11px;color:#bbb;margin-top:12px;"></p>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById("dbCancelBtn").addEventListener("click", () => overlay.remove());

  const razorpayBtn = document.getElementById("dbRazorpayBtn");
  razorpayBtn.addEventListener("click", async () => {
    razorpayBtn.textContent = "⏳ Opening payment...";
    razorpayBtn.disabled = true;

    try {
      await payWithRazorpay({ purpose: "database-unlock", user });

      razorpayBtn.textContent = "✅ Payment received — verifying...";
      await waitForUnlock(db, onSnapshot, doc(db, "recruiters", user.uid), "databaseAccess", { timeoutMs: 25000 });

      overlay.remove();
      renderRecruiterCard(db, user);
    } catch (e) {
      if (e.message === "cancelled") {
        razorpayBtn.textContent = `⚡ Pay ₹${UNLOCK_AMOUNT} — Instant Unlock`;
        razorpayBtn.disabled = false;
      } else if (e.message === "timeout") {
        razorpayBtn.textContent = "⏳ Still verifying...";
        const hint = document.getElementById("dbPaywallHint");
        if (hint) hint.innerHTML = "Payment received but confirmation is taking longer than usual. It'll unlock automatically — no need to pay again.";
      } else {
        window.showToast("Payment could not be completed: " + e.message, "error");
        razorpayBtn.textContent = `⚡ Pay ₹${UNLOCK_AMOUNT} — Instant Unlock`;
        razorpayBtn.disabled = false;
      }
    }
  });
}

/* ════════════════════════════════════════════════════════════
   ADMIN VIEW — settings form + request approval queue
════════════════════════════════════════════════════════════ */
async function renderAdminControls(db) {
  const settingsPanel = document.getElementById("dbSettingsPanel");
  if (settingsPanel) {
    settingsPanel.style.display = "block";
    const settings = await getSettings(db);

    settingsPanel.innerHTML = `
      <div style="background:#fff;padding:20px;border-radius:12px;border:1px solid #e5e7eb;margin-top:30px;">
        <h2 style="margin:0 0 4px 0;font-size:17px;font-weight:700;color:#001233;">🗄️ Resume Database Settings</h2>
        <p style="margin:4px 0 16px 0;color:#888;font-size:13px;">Set the count recruiters see and the Google Drive folder link they get after unlocking.</p>
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;margin-bottom:14px;">
          <div>
            <label style="font-size:12px;font-weight:600;color:#888;display:block;margin-bottom:5px;">Resume Count</label>
            <input type="number" id="dbCountInput" value="${settings.count || 0}" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#888;display:block;margin-bottom:5px;">Google Drive Folder Link (share as "Anyone with link")</label>
            <input type="text" id="dbLinkInput" value="${settings.driveLink || ''}" placeholder="https://drive.google.com/drive/folders/..." style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">
          </div>
        </div>
        <button id="dbSaveSettingsBtn" style="background:#00b86b;color:#fff;border:none;padding:11px 20px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">💾 Save</button>
        <span id="dbSaveStatus" style="margin-left:10px;font-size:12px;color:#00b86b;"></span>
      </div>`;

    document.getElementById("dbSaveSettingsBtn").addEventListener("click", async () => {
      const count = parseInt(document.getElementById("dbCountInput").value, 10) || 0;
      const driveLink = document.getElementById("dbLinkInput").value.trim();
      try {
        await setDoc(doc(db, "settings", "resumeDatabase"), {
          count, driveLink, updatedAt: serverTimestamp()
        }, { merge: true });
        document.getElementById("dbSaveStatus").textContent = "✅ Saved";
        setTimeout(() => { document.getElementById("dbSaveStatus").textContent = ""; }, 2500);
      } catch (e) {
        window.showToast("Could not save: " + e.message, "error");
      }
    });
  }

  const requestsPanel = document.getElementById("databaseRequestsPanel");
  if (requestsPanel) {
    requestsPanel.style.display = "block";
    await loadDatabaseRequests(db);
  }
}

async function loadDatabaseRequests(db) {
  const container = document.getElementById("databaseRequestsContainer");
  const countBadge = document.getElementById("pendingDbRequestCount");
  if (!container) return;

  try {
    const snap = await getDocs(query(
      collection(db, "databaseRequests"),
      where("status", "==", "pending")
    ));

    const requests = [];
    snap.forEach(d => requests.push({ id: d.id, ...d.data() }));

    if (countBadge) countBadge.textContent = `${requests.length} pending`;

    if (!requests.length) {
      container.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:#94a3b8;">No pending unlock requests 🎉</td></tr>`;
      return;
    }

    container.innerHTML = requests.map(r => {
      const requestedDate = r.requestedAt?.toDate ? r.requestedAt.toDate().toLocaleDateString("en-IN") : "—";
      return `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:12px;font-size:13px;">${r.email}</td>
          <td style="padding:12px;font-size:13px;font-weight:700;">₹${r.amount}</td>
          <td style="padding:12px;font-size:12px;color:#888;">${requestedDate}</td>
          <td style="padding:12px;">
            <button data-id="${r.id}" data-uid="${r.userId}" class="dbApproveBtn" style="background:#00b86b;color:#fff;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;margin-right:6px;">✅ Approve</button>
            <button data-id="${r.id}" class="dbRejectBtn" style="background:#ef4444;color:#fff;border:none;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">❌ Reject</button>
          </td>
        </tr>`;
    }).join("");

    container.querySelectorAll(".dbApproveBtn").forEach(btn => {
      btn.addEventListener("click", () => approveDbRequest(db, btn.dataset.id, btn.dataset.uid));
    });
    container.querySelectorAll(".dbRejectBtn").forEach(btn => {
      btn.addEventListener("click", () => rejectDbRequest(db, btn.dataset.id));
    });
  } catch (e) {
    container.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#ef4444;">Error loading requests: ${e.message}</td></tr>`;
  }
}

async function approveDbRequest(db, requestId, userId) {
  try {
    await updateDoc(doc(db, "databaseRequests", requestId), {
      status: "approved", approvedAt: serverTimestamp()
    });
    await setDoc(doc(db, "recruiters", userId), {
      databaseAccess: true,
      databaseRequestStatus: "approved",
      databaseApprovedAt: serverTimestamp()
    }, { merge: true });
    await loadDatabaseRequests(db);
  } catch (e) {
    window.showToast("Could not approve: " + e.message, "error");
  }
}

async function rejectDbRequest(db, requestId) {
  window.showConfirm("Reject Request?", "This will reject the resume database unlock request.", async () => {
    try {
      await updateDoc(doc(db, "databaseRequests", requestId), {
        status: "rejected", rejectedAt: serverTimestamp()
      });
      await loadDatabaseRequests(db);
    } catch (e) {
      window.showToast("Could not reject: " + e.message, "error");
    }
  });
}
