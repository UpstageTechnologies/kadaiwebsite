import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiArrowLeft,
} from "react-icons/fi";

import "./Login.css";

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [rememberMe, setRememberMe] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = (event) => {
  event.preventDefault();

  setError("");
  setSuccess("");

  if (!email.trim()) {
    setError("Please enter your email address.");
    return;
  }

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    setError("Please enter a valid email address.");
    return;
  }
  if (!password) {
    setError("Please enter your password.");
    return;
  }

  if (password.length < 6) {
    setError(
      "Password must be at least 6 characters."
    );
    return;
  }
  const savedUser = localStorage.getItem(
    "registeredUser"
  );
  if (!savedUser) {
    setError(
      "No account found. Please create an account first."
    );
    return;
  }

  const registeredUser =
    JSON.parse(savedUser);
  const emailMatches =
    email.trim().toLowerCase() ===
    registeredUser.email.trim().toLowerCase();
  const passwordMatches =
    password === registeredUser.password;
  if (!emailMatches || !passwordMatches) {
    setError("Invalid email or password.");
    return;
  }
  localStorage.setItem(
    "isLoggedIn",
    "true"
  );

  if (rememberMe) {
    localStorage.setItem(
      "rememberedEmail",
      email.trim()
    );
  } else {
    localStorage.removeItem(
      "rememberedEmail"
    );
  }

  setSuccess("Login successful!");

  setTimeout(() => {
    navigate("/");
  }, 800);
};

  return (
    <main className="login-page">

      {/* Back */}

      <button
        className="login-back-btn"
        onClick={() => navigate("/")}
      >
        <FiArrowLeft />
        Back to Home
      </button>


      <div className="login-container">

        {/* Left Side */}

        <section className="login-info">

          <div className="login-brand">
            <span>Kadai</span>App
          </div>

          <h1>
            Welcome
            <br />
            Back!
          </h1>

          <p>
            Login to continue shopping and
            manage your orders easily.
          </p>

          <div className="login-benefits">

            <div>
              <span>✓</span>
              Easy and secure shopping
            </div>

            <div>
              <span>✓</span>
              Track your orders
            </div>

            <div>
              <span>✓</span>
              Save your favorite products
            </div>

          </div>

        </section>


        {/* Login Form */}

        <section className="login-card">

          <div className="login-heading">

            <h2>Login</h2>

            <p>
              Enter your details to continue
            </p>

          </div>


          <form onSubmit={handleLogin}>

            {/* Email */}

            <div className="login-field">

              <label htmlFor="email">
                Email Address
              </label>

              <div className="input-wrapper">

                <FiMail />

                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                />

              </div>

            </div>


            {/* Password */}

            <div className="login-field">

              <label htmlFor="password">
                Password
              </label>

              <div className="input-wrapper">

                <FiLock />

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                >
                  {showPassword ? (
                    <FiEyeOff />
                  ) : (
                    <FiEye />
                  )}
                </button>

              </div>

            </div>

            <div className="login-options">

              <label className="remember-me">

                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(
                      event.target.checked
                    )
                  }
                />

                <span>
                  Remember me
                </span>

              </label>

              <button
                type="button"
                className="forgot-password"
                onClick={() =>
                  alert(
                    "Password reset will be available soon."
                  )
                }
              >
                Forgot Password?
              </button>

            </div>

            {error && (
              <div className="login-message error">
                {error}
              </div>
            )}


            {success && (
              <div className="login-message success">
                {success}
              </div>
            )}

            <button
              type="submit"
              className="login-submit-btn"
            >
              Login
            </button>

            <div className="register-text">

              Don't have an account?

              <button
                type="button"
                onClick={() =>
                  navigate("/register")
                }
              >
                Create Account
              </button>

            </div>

          </form>

        </section>

      </div>

    </main>
  );
};

export default Login;