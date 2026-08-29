import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiLock,
  FiEye,
  FiEyeOff,
  FiArrowLeft,
  FiCheck,
} from "react-icons/fi";

import "./register.css";

const Register = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [agreeTerms, setAgreeTerms] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRegister = (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    // Full Name
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (fullName.trim().length < 3) {
      setError(
        "Name must be at least 3 characters."
      );
      return;
    }

    // Email
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setError(
        "Please enter a valid email address."
      );
      return;
    }

    // Phone
    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    const phonePattern = /^[0-9]{10}$/;

    if (!phonePattern.test(phone)) {
      setError(
        "Please enter a valid 10-digit phone number."
      );
      return;
    }

    // Password
    if (!password) {
      setError("Please create a password.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    // Confirm Password
    if (!confirmPassword) {
      setError(
        "Please confirm your password."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    // Terms
    if (!agreeTerms) {
      setError(
        "Please accept the Terms & Conditions."
      );
      return;
    }

    // Save basic user data
    const user = {
      fullName,
      email,
      phone,
      password,
    };

    localStorage.setItem(
      "registeredUser",
      JSON.stringify(user)
    );

    setSuccess(
      "Account created successfully!"
    );

    setTimeout(() => {
      navigate("/login");
    }, 1000);
  };

  return (
    <main className="register-page">

      {/* Back Button */}

      <button
        className="register-back-btn"
        onClick={() => navigate("/")}
      >
        <FiArrowLeft />
        Back to Home
      </button>

      <div className="register-container">
        <section className="register-info">
          <div className="register-brand">
            <span>Kadai</span>App
          </div>
          <h1>
            Create
            <br />
            Your Account
          </h1>

          <p>
            Join KadaiApp and enjoy a simple,
            secure and convenient shopping
            experience.
          </p>

          <div className="register-benefits">

            <div>
              <span><FiCheck/></span>
              Shop your favorite products
            </div>

            <div>
              <span><FiCheck/></span>
              Track your orders easily
            </div>

            <div>
              <span><FiCheck/></span>
              Save products for later
            </div>

          </div>

        </section>


        {/* Register Card */}

        <section className="register-card">

          <div className="register-heading">

            <h2>
              Create Account
            </h2>

            <p>
              Fill in your details to get started
            </p>

          </div>


          <form onSubmit={handleRegister}>

            {/* Full Name */}

            <div className="register-field">

              <label htmlFor="fullName">
                Full Name
              </label>

              <div className="register-input-wrapper">

                <FiUser />

                <input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(
                      event.target.value
                    )
                  }
                />

              </div>

            </div>


            {/* Email */}

            <div className="register-field">

              <label htmlFor="registerEmail">
                Email Address
              </label>

              <div className="register-input-wrapper">

                <FiMail />

                <input
                  id="registerEmail"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                />

              </div>

            </div>


            {/* Phone */}

            <div className="register-field">

              <label htmlFor="phone">
                Phone Number
              </label>

              <div className="register-input-wrapper">

                <FiPhone />

                <input
                  id="phone"
                  type="tel"
                  placeholder="Enter 10-digit phone number"
                  value={phone}
                  maxLength={10}
                  onChange={(event) => {

                    const value =
                      event.target.value.replace(
                        /\D/g,
                        ""
                      );

                    setPhone(value);
                  }}
                />

              </div>

            </div>


            {/* Password */}

            <div className="register-field">

              <label htmlFor="registerPassword">
                Password
              </label>

              <div className="register-input-wrapper">

                <FiLock />

                <input
                  id="registerPassword"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                />

                <button
                  type="button"
                  className="register-password-toggle"
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


            {/* Confirm Password */}

            <div className="register-field">

              <label htmlFor="confirmPassword">
                Confirm Password
              </label>

              <div className="register-input-wrapper">

                <FiLock />

                <input
                  id="confirmPassword"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                />

                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                >
                  {showConfirmPassword ? (
                    <FiEyeOff />
                  ) : (
                    <FiEye />
                  )}
                </button>

              </div>

            </div>


            {/* Terms */}

            <label className="terms-checkbox">

              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(event) =>
                  setAgreeTerms(
                    event.target.checked
                  )
                }
              />

              <span>
                I agree to the{" "}
                <button
                  type="button"
                  onClick={(event) =>
                    event.preventDefault()
                  }
                >
                  Terms & Conditions
                </button>
              </span>

            </label>


            {/* Error */}

            {error && (
              <div className="register-message error">
                {error}
              </div>
            )}


            {/* Success */}

            {success && (
              <div className="register-message success">
                {success}
              </div>
            )}


            {/* Register Button */}

            <button
              type="submit"
              className="register-submit-btn"
            >
              Create Account
            </button>


            {/* Login */}

            <div className="login-link-text">

              Already have an account?

              <button
                type="button"
                onClick={() =>
                  navigate("/login")
                }
              >
                Login
              </button>

            </div>

          </form>

        </section>

      </div>

    </main>
  );
};

export default Register;
