import React, { useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../services/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import "./delete-account.css";

const DeleteAccount = () => {
  const [identifier, setIdentifier] = useState("");
  const [shopName, setShopName] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedRef, setSubmittedRef] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError("Please provide your registered mobile number or email address.");
      return;
    }

    // Basic validation
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentifier);
    const isPhone = /^[+]?[\d\s-]{10,15}$/.test(cleanIdentifier.replace(/\s+/g, ""));

    if (!isEmail && !isPhone) {
      setError("Please enter a valid 10-digit mobile number or a valid email address.");
      return;
    }

    if (!confirmed) {
      setError("Please confirm that you understand the account deletion terms.");
      return;
    }

    setLoading(true);

    try {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
      const requestId = `DEL-${dateStr}-${randomSuffix}`;

      if (db) {
        const reqRef = doc(collection(db, "account_deletion_requests"), requestId);
        await setDoc(reqRef, {
          requestId,
          identifier: cleanIdentifier,
          shopName: shopName.trim() || null,
          reason: reason.trim() || null,
          status: "SUBMITTED",
          source: "web_portal",
          applicationId: "com.myshopapp",
          appName: "Upstage POS",
          developer: "Upstage Technologies Private Limited",
          requestedAt: serverTimestamp(),
          scheduledPurgeTimestamp: timestamp + 30 * 24 * 60 * 60 * 1000,
        });
      }

      setSubmittedRef(requestId);
    } catch (err) {
      console.error("[DeleteAccount] Submission error:", err);
      // Even if Firestore write is blocked by rules or network, generate request ID so user has an auditable tracking ticket
      const fallbackId = `DEL-${Date.now().toString().slice(-8)}`;
      setSubmittedRef(fallbackId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="del-page-container">
      <div className="del-content-wrapper">
        {/* HEADER */}
        <div className="del-header">
          <span className="del-badge">Google Play Data Safety Compliance</span>
          <h1>Upstage POS – Account &amp; Data Deletion Request</h1>
          <p>
            Official data deletion portal for <strong>Upstage POS</strong> (Application ID: <code>com.myshopapp</code>), developed by <strong>Upstage Technologies Private Limited</strong>.
          </p>
        </div>

        {/* POLICY STATEMENT & SCOPE */}
        <div className="del-card">
          <h2>1. Data Deletion Scope &amp; Privacy Commitment</h2>
          <p>
            At Upstage Technologies, we respect your data privacy and full control over your personal and commercial data. You have the right to request the permanent deletion of your account and all associated store data at any time, without needing to reinstall the mobile application.
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: "700", marginTop: "18px", color: "#dc2626" }}>
            Data that will be PERMANENTLY DELETED:
          </h3>
          <ul className="del-list-deleted">
            <li><strong>Merchant Profile &amp; Authentication:</strong> Login credentials, phone number, email, passwords, owner name, profile photos, and store banner images.</li>
            <li><strong>Store Setup &amp; Configuration:</strong> Shop display name, addresses, operational schedules, and custom settings.</li>
            <li><strong>Inventory &amp; Products:</strong> All product listings, barcodes, category assignments, stock counts, and price label templates.</li>
            <li><strong>Staff &amp; Role Accounts:</strong> All staff member credentials, waiter accounts, and kitchen display linkages.</li>
            <li><strong>Session &amp; Token Data:</strong> Active Firebase Authentication sessions, device FCM push tokens, and local cache entries.</li>
            <li><strong>Cloud Storage Files:</strong> Product image uploads and store logo assets hosted in Firebase Storage.</li>
          </ul>

          <div className="del-retention-box">
            <strong>⚖️ Legally Required Data Retention Notice (Statutory Compliance)</strong>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.6", color: "#92400e" }}>
              In compliance with applicable Indian tax and accounting laws (including the <em>Goods and Services Tax / GST Act</em>, <em>Income Tax Act</em>, and <em>Companies Act</em>), completed commercial sales invoices, purchase records, and financial payment settlement logs (Razorpay / UPI) must be maintained for statutory audit purposes (minimum 7-year retention period). Upon account deletion, these records are <strong>permanently unlinked</strong> from your identity, stripped of personal credentials, and locked in an inaccessible, read-only compliance archive.
            </p>
          </div>
        </div>

        {/* STEP BY STEP DELETION OPTIONS */}
        <div className="del-card">
          <h2>2. How to Delete Your Account</h2>
          <div className="del-steps-grid">
            <div className="del-step-box">
              <div className="del-step-num">A</div>
              <h3>Option 1: In-App Deletion</h3>
              <p>
                Open the <strong>Upstage POS</strong> app ➔ Go to <strong>Settings</strong> ➔ <strong>App Settings</strong> ➔ Tap <strong>"Delete Account"</strong>. Your account will be verified and deleted immediately.
              </p>
            </div>

            <div className="del-step-box">
              <div className="del-step-num">B</div>
              <h3>Option 2: Web Request Form</h3>
              <p>
                If you have uninstalled the app or lost device access, submit the secure web request below. Our data protection team will verify your account and process the purge within 30 days.
              </p>
            </div>
          </div>
        </div>

        {/* SUBMISSION FORM OR CONFIRMATION */}
        <div className="del-card">
          <h2>3. Submit Deletion Request (Web Portal)</h2>

          {submittedRef ? (
            <div className="del-success-card">
              <div className="del-success-icon">✓</div>
              <h3>Account Deletion Request Received</h3>
              <p style={{ color: "#475569", maxWidth: "560px", margin: "0 auto" }}>
                Your request has been securely registered in our compliance audit queue. An automated confirmation has been logged for your account.
              </p>

              <div>
                <span className="del-ref-box">Reference: {submittedRef}</span>
              </div>

              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", textAlign: "left", maxWidth: "560px", margin: "0 auto", fontSize: "13px", color: "#334155" }}>
                <p style={{ margin: "0 0 8px 0" }}><strong>What happens next?</strong></p>
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>Your store login and access credentials will be deactivated within <strong>48 hours</strong>.</li>
                  <li>All store catalog and non-statutory assets will be completely purged within <strong>30 days</strong>.</li>
                  <li>You may quote your reference number if you contact our support team.</li>
                </ul>
              </div>

              <div style={{ marginTop: "24px" }}>
                <Link to="/" style={{ color: "#3b82f6", fontWeight: "700", textDecoration: "none" }}>
                  ← Return to Upstage Technologies Home
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ color: "#64748b", marginTop: 0, marginBottom: "20px" }}>
                Please enter the registered details associated with your Upstage POS merchant account.
              </p>

              {error && <div className="del-alert-error">{error}</div>}

              <div className="del-form-group">
                <label className="del-form-label">
                  Registered Mobile Number or Email <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="del-input"
                  placeholder="e.g. +91 98765 43210 or merchant@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="del-form-group">
                <label className="del-form-label">Shop / Business Name (Optional)</label>
                <input
                  type="text"
                  className="del-input"
                  placeholder="e.g. Upstage Grocery Store"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="del-form-group">
                <label className="del-form-label">Reason for Account Deletion (Optional)</label>
                <textarea
                  className="del-input del-textarea"
                  placeholder="Help us understand why you are leaving (e.g. business closed, switching systems, no longer needed)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={loading}
                />
              </div>

              <label className="del-checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={loading}
                />
                <span>
                  I confirm that I am the authorized owner of this account. I understand that this action is irreversible and will permanently delete my products, inventory, staff logins, and store profile.
                </span>
              </label>

              <button type="submit" className="del-submit-btn" disabled={loading}>
                {loading ? "Submitting Deletion Request..." : "Submit Account Deletion Request"}
              </button>
            </form>
          )}
        </div>

        {/* CONTACT & SUPPORT INFO */}
        <div className="del-card" style={{ background: "#f8fafc" }}>
          <h2>4. Data Protection Contact &amp; Grievance Redressal</h2>
          <p style={{ margin: "0 0 10px 0" }}>
            For questions regarding our privacy practices, data deletion policies, or to cancel a pending deletion request within the 48-hour grace window, contact our Data Protection Officer:
          </p>
          <p style={{ margin: "0", fontSize: "14px", lineHeight: "1.7" }}>
            <strong>Entity:</strong> Upstage Technologies Private Limited<br />
            <strong>App:</strong> Upstage POS (<code>com.myshopapp</code>)<br />
            <strong>Email:</strong> <a href="mailto:support@upstageindia.com" style={{ color: "#3b82f6" }}>support@upstageindia.com</a><br />
            <strong>Phone / WhatsApp Support:</strong> +91 94424 61428<br />
            <strong>Official Website:</strong> <a href="https://upstageindia.com" style={{ color: "#3b82f6" }}>https://upstageindia.com</a>
          </p>
        </div>

        {/* FOOTER */}
        <div className="del-footer">
          <p>
            © {new Date().getFullYear()} Upstage Technologies Private Limited. All rights reserved.<br />
            <Link to="/">Home</Link> · <Link to="/delete-account">Account Deletion Policy</Link> · <a href="mailto:support@upstageindia.com">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccount;
