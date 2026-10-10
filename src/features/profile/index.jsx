import { useState } from "react";
import {
  FiArrowRight,
  FiEdit2,
  FiLogOut,
  FiMapPin,
  FiPhone,
  FiShoppingBag,
  FiUser,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { signOut, updateProfile } from "firebase/auth";

import Navbar from "../../components/Navbar";
import AddressChangeModal from "../../components/AddressChangeModal";
import { useAuth } from "../../components/AuthContext";
import { auth } from "../../services/firebase";
import { firebaseUpsertCustomerProfile } from "../../services/firebase";

import "./profile.css";

const getCustomerName = (customer, user) =>
  customer?.fullName || customer?.name || customer?.displayName || user?.displayName || "";

const formatAddress = (address) => {
  if (typeof address === "string") return address.trim();
  if (!address || typeof address !== "object") return "";

  return address.fullAddress
    || address.formattedAddress
    || address.address
    || [
      address.house,
      address.building,
      address.flat,
      address.road,
      address.area,
      address.city,
      address.district,
      address.state,
      address.country,
      address.pincode,
    ].filter(Boolean).join(", ");
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, customer, loading } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [error, setError] = useState("");

  const customerName = getCustomerName(customer, user);
  const phoneNumber = customer?.mobile || user?.phoneNumber || "Not available";
  const deliveryAddress = formatAddress(customer?.address) || "No delivery address saved.";
  const profileInitial = (customerName || phoneNumber || "K").trim().charAt(0).toUpperCase();

  const handleSaveName = async (event) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) {
      setError("Please enter your name.");
      return;
    }
    if (!user?.uid) {
      setError("Please sign in again to update your profile.");
      return;
    }

    setIsSavingName(true);
    setError("");
    try {
      await firebaseUpsertCustomerProfile(user.uid, {
        name,
        fullName: name,
        displayName: name,
      });
      if (auth?.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
      }
      setIsEditingName(false);
    } catch (saveError) {
      console.error("[PROFILE] Name update failed:", saveError);
      setError(saveError?.message || "Unable to update your profile. Please try again.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSignOut = async () => {
    setError("");
    try {
      if (auth) await signOut(auth);
      navigate("/login", { replace: true });
    } catch (signOutError) {
      console.error("[PROFILE] Sign out failed:", signOutError);
      setError(signOutError?.message || "Unable to sign out. Please try again.");
    }
  };

  return (
    <>
      <Navbar />
      <main className="profile-page">
        <header className="profile-page-header">
          <div>
            <span>YOUR ACCOUNT</span>
            <h1>My Profile</h1>
            <p>Manage your personal details and delivery preferences.</p>
          </div>
          {user && !loading && (
            <div className="profile-header-summary">
              <span className="profile-header-avatar">{profileInitial}</span>
              <span>
                <strong>{customerName || "Kadai Customer"}</strong>
                <small>Customer account</small>
              </span>
            </div>
          )}
        </header>

        {error && <div className="profile-message" role="alert">{error}</div>}

        {loading ? (
          <section className="profile-card profile-loading" role="status">
            Loading your profile...
          </section>
        ) : !user ? (
          <section className="profile-card profile-empty">
            <h2>Sign in to view your profile</h2>
            <button
              type="button"
              onClick={() => navigate(`/login?redirect=${encodeURIComponent("/profile")}`)}
            >
              Sign In
            </button>
          </section>
        ) : (
          <div className="profile-sections">
            <section className="profile-overview">
              <span className="profile-overview-icon"><FiShoppingBag aria-hidden="true" /></span>
              <div>
                <span className="profile-overview-kicker">Welcome to your account</span>
                <h2>{customerName ? `Hello, ${customerName}` : "Your Kadai account"}</h2>
                <p>Keep your details up to date for a smoother shopping experience.</p>
              </div>
            </section>

            <section className="profile-card">
              <div className="profile-section-heading">
                <div className="profile-section-icon"><FiUser aria-hidden="true" /></div>
                <div>
                  <h2>Personal Information</h2>
                  <p>Your customer profile details</p>
                </div>
                {!isEditingName && (
                  <button
                    type="button"
                    className="profile-text-button"
                    onClick={() => {
                      setDraftName(customerName);
                      setError("");
                      setIsEditingName(true);
                    }}
                  >
                    <FiEdit2 aria-hidden="true" />
                    Edit Profile
                  </button>
                )}
              </div>

              {isEditingName ? (
                <form className="profile-edit-form" onSubmit={handleSaveName}>
                  <label htmlFor="profile-name">Name</label>
                  <input
                    id="profile-name"
                    type="text"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    autoComplete="name"
                  />
                  <div className="profile-form-actions">
                    <button type="button" className="profile-secondary-button" onClick={() => setIsEditingName(false)}>
                      Cancel
                    </button>
                    <button type="submit" disabled={isSavingName}>
                      {isSavingName ? "Saving..." : "Save Profile"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="profile-info-row">
                  <FiUser aria-hidden="true" />
                  <div>
                    <span>Name</span>
                    <strong>{customerName || "Name not available"}</strong>
                  </div>
                </div>
              )}

              <div className="profile-info-row">
                <FiPhone aria-hidden="true" />
                <div>
                  <span>Registered Phone Number</span>
                  <strong>{phoneNumber}</strong>
                </div>
              </div>
            </section>

            <section className="profile-card">
              <div className="profile-section-heading">
                <div className="profile-section-icon"><FiMapPin aria-hidden="true" /></div>
                <div>
                  <h2>Delivery Address</h2>
                  <p>Your saved delivery location</p>
                </div>
                <button
                  type="button"
                  className="profile-text-button"
                  onClick={() => setIsEditingAddress(true)}
                >
                  <FiEdit2 aria-hidden="true" />
                  Edit Address
                </button>
              </div>
              <p className="profile-address-text">{deliveryAddress}</p>
            </section>

            <section className="profile-card profile-actions">
              <button type="button" onClick={() => navigate("/orders")}>
                <span><FiArrowRight aria-hidden="true" /> My Orders</span>
                <FiArrowRight aria-hidden="true" />
              </button>
              <button type="button" className="profile-signout" onClick={handleSignOut}>
                <span><FiLogOut aria-hidden="true" /> Sign Out</span>
                <FiArrowRight aria-hidden="true" />
              </button>
            </section>
          </div>
        )}
      </main>

      <AddressChangeModal
        open={isEditingAddress}
        onClose={() => setIsEditingAddress(false)}
        onSaved={() => setIsEditingAddress(false)}
      />
    </>
  );
};

export default Profile;
