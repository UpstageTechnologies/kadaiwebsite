import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiPhone, FiArrowLeft, FiUser } from "react-icons/fi";
import {
  auth,
  firebaseCreatePhoneVerifier,
  firebaseSendPhoneOtp,
  firebaseClearPhoneVerifier,
  firebaseIsPhoneOtpInProgress,
  firebaseSetPhoneOtpInProgress,
  normalizePhoneOtpError,
  firebaseUpsertCustomerProfile,
  updateProfile,
} from "../../../services/firebase";
import { setConfirmation, getConfirmation, clearConfirmation } from "./phoneSession";
import "./register.css";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeStep = useMemo(() => {
    if (location.pathname === "/register/otp") return "otp";
    if (location.pathname === "/register/username") return "username";
    return "phone";
  }, [location.pathname]);

  const [step, setStep] = useState(routeStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneCode, setPhoneCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [username, setUsername] = useState("");

  useEffect(() => {
    setStep(routeStep);
  }, [routeStep]);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((current) => Math.max(current - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  useEffect(() => {
    return () => {
      clearConfirmation();
    };
  }, []);

  const normalizedPhone = (input) => (input || "").replace(/\D/g, "");

  const maskPhone = (value) => {
    const digits = normalizedPhone(value);
    if (digits.length <= 4) return digits.replace(/\d/g, "•");
    const visible = digits.slice(-4);
    return `${"•".repeat(Math.max(0, digits.length - 4))}${visible}`;
  };

  const validatePhone = (phoneValue) => {
    const digits = normalizedPhone(phoneValue);
    if (!digits) return { ok: false, message: "Please enter a mobile number." };
    if (digits.length !== 10) return { ok: false, message: "Please enter a valid 10-digit Indian mobile number." };
    return { ok: true };
  };

  const sendOtp = async () => {
    const result = validatePhone(phone);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (loading || firebaseIsPhoneOtpInProgress()) return;

    setLoading(true);
    setError("");

    try {
      if (!auth) {
        throw new Error("Firebase auth is not configured. Check your VITE_FIREBASE_* environment variables.");
      }

      const container = document.getElementById("recaptcha-container");
      if (!container) {
        throw new Error("reCAPTCHA container is missing.");
      }

      const formatted = `${phoneCode}${normalizedPhone(phone)}`;
      const verifier = await firebaseCreatePhoneVerifier();
      const newConfirmation = await firebaseSendPhoneOtp(formatted, verifier);

      setConfirmation(newConfirmation);
      firebaseSetPhoneOtpInProgress(false);
      setStep("otp");
      setOtp("");

      navigate("/register/otp", { state: { phone: formatted } });
    } catch (sendError) {
      console.error("[AUTH] OTP send failed:", sendError);
      const mapped = normalizePhoneOtpError(sendError);
      const fallback = sendError?.message || sendError?.toString() || "Unable to verify this device. Please try again.";
      const message = mapped || fallback;

      setError(message);
      firebaseClearPhoneVerifier();
      firebaseSetPhoneOtpInProgress(false);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (loading) return;

    const currentConfirmation = getConfirmation();
    if (!currentConfirmation) {
      setError("Invalid session. Please go back and request a new code.");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("[AUTH] OTP verification successful");
      const credential = await currentConfirmation.confirm(otp.trim());
      const uid = credential?.user?.uid || auth?.currentUser?.uid || "";
      clearConfirmation();
      sessionStorage.setItem("kadai.phone.verifiedUid", uid);
      setStep("username");
      navigate("/register/username", { replace: true, state: { phone: `${phoneCode}${normalizedPhone(phone)}`, uid } });
    } catch (verifyError) {
      const code = verifyError?.code || "";
      let message = "The verification code is incorrect or expired.";
      if (code === "auth/invalid-verification-code") message = "Invalid OTP. Please try again.";
      if (code === "auth/code-expired") message = "The OTP has expired. Request a new code.";
      if (code === "auth/too-many-requests") message = "Too many attempts. Please try again later.";
      if (code === "auth/network-request-failed") message = "Network error. Please check your internet connection and try again.";

      setError(message);
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (seconds > 0 || loading || firebaseIsPhoneOtpInProgress()) return;

    try {
      const formatted = `${phoneCode}${normalizedPhone(phone)}`;
      const verifier = await firebaseCreatePhoneVerifier();
      const nextConfirmation = await firebaseSendPhoneOtp(formatted, verifier);
      setConfirmation(nextConfirmation);
      setSeconds(30);
      setOtp("");
    } catch (resendError) {
      console.error(resendError);
      const mapped = normalizePhoneOtpError(resendError);
      const fallback = resendError?.message || resendError?.toString() || "Unable to verify this device. Please try again.";
      setError(mapped || fallback);
      firebaseClearPhoneVerifier();
      firebaseSetPhoneOtpInProgress(false);
    }
  };

  const createAccount = async () => {
    if (loading) return;

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setError("Please enter your username.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("[AUTH] Current Firebase user:", auth.currentUser?.uid);
      console.log("[AUTH] Verified Firebase phone:", auth.currentUser?.phoneNumber);

      if (!auth?.currentUser) {
        throw new Error("Your verification session has expired. Please verify your mobile number again.");
      }

      if (!auth.currentUser?.phoneNumber) {
        throw new Error("Verified mobile number could not be found. Please verify your mobile number again.");
      }

      const verifiedPhone = auth.currentUser.phoneNumber;
      const digits = String(verifiedPhone).replace(/\D/g, "");
      let mobileDigits = digits;

      if (mobileDigits.startsWith("91") && mobileDigits.length === 12) {
        mobileDigits = mobileDigits.slice(2);
      }

      if (mobileDigits.length !== 10) {
        throw new Error("Please verify a valid Indian mobile number.");
      }

      const finalPhone = `+91${mobileDigits}`;

      console.log("[AUTH] Username:", trimmedUsername);
      console.log("[AUTH] Firebase displayName:", auth.currentUser?.displayName);
      console.log("[AUTH] Customer UID:", auth.currentUser?.uid);

      await updateProfile(auth.currentUser, {
        displayName: trimmedUsername,
      });

      const uid = auth?.currentUser?.uid || sessionStorage.getItem("kadai.phone.verifiedUid") || "";
      if (uid) {
        await firebaseUpsertCustomerProfile(uid, {
          uid,
          name: trimmedUsername,
          fullName: trimmedUsername,
          displayName: trimmedUsername,
          mobile: finalPhone,
          country: "India",
        });
      }

      console.log("[AUTH] Registration completed");
      setStep("phone");
      navigate("/login", { replace: true });
    } catch (registerError) {
      console.error("[AUTH] Registration failed:", registerError);
      setError(registerError?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">
      <button className="register-back" type="button" onClick={() => navigate("/")}>
        <FiArrowLeft /> Back to Home
      </button>

      <div className="register-container">
        <section className="register-info">
          <div className="register-brand">
            <span>Kadai</span>App
          </div>

          <h1>
            Welcome
            <br />
            to Kadai
          </h1>

          <p>Join and create a secure shopping profile for your next order.</p>

          <div className="register-benefits">
            <div><span>✓</span>Easy and secure shopping</div>
            <div><span>✓</span>Track your orders</div>
            <div><span>✓</span>Save your delivery details</div>
          </div>
        </section>

        <section className="register-card">
          <div id="recaptcha-container" className="recaptcha-container" />

          {step === "phone" && (
            <>
              <div className="register-title">
                <h1>Create your account</h1>
                <p>First, verify your mobile number. We'll send a one time code (OTP).</p>
              </div>

              <div className="register-phone-row">
                <div className="phone-country">
                  <select value={phoneCode} onChange={(event) => {
                    setPhoneCode(event.target.value);
                    setError("");
                  }}>
                    <option value="+91">India (+91)</option>
                  </select>
                </div>

                <div className="phone-input-wrap">
                  <FiPhone />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                      setError("");
                    }}
                    placeholder="Mobile number"
                    disabled={loading}
                    maxLength={10}
                  />
                </div>
              </div>

              {error && <div className="error-message" role="alert">{error}</div>}

              <button className="register-submit" type="button" onClick={sendOtp} disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </>
          )}

          {step === "otp" && (
            <>
              <div className="register-title">
                <h1>Verify your number</h1>
                <p>Enter the 6-digit code sent to {maskPhone(`${phoneCode}${normalizedPhone(phone)}`)}</p>
              </div>

              <div className="register-otp-area">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="6"
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setError("");
                  }}
                  placeholder="000000"
                  disabled={loading}
                />
              </div>

              {error && <div className="error-message" role="alert">{error}</div>}

              <button className="register-submit" type="button" onClick={verifyOtp} disabled={loading}>
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>

              <div className="register-resend">
                <span>Didn't receive the code?</span>
                <button type="button" onClick={resendOtp} disabled={loading || seconds > 0}>
                  {seconds > 0 ? `Resend in 00:${String(seconds).padStart(2, "0")}` : "Resend OTP"}
                </button>
              </div>
            </>
          )}

          {step === "username" && (
            <>
              <div className="register-title">
                <h1>Create your username</h1>
                <p>Choose a username for your Kadai account.</p>
              </div>

              <div className="register-form-grid">
                <div className="register-field">
                  <span>Username</span>
                  <div className="username-wrap">
                    <FiUser />
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        setError("");
                      }}
                      placeholder="Username"
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && <div className="error-message" role="alert">{error}</div>}

                <button className="register-submit" type="button" onClick={createAccount} disabled={loading}>
                  {loading ? "Saving..." : "Create Account"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
};

export default Register;
