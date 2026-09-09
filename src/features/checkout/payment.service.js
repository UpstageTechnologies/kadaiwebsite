const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
const RAZORPAY_SCRIPT_ID = "razorpay-checkout-script";
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || "";

const ensureRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(RAZORPAY_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load Razorpay checkout.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = RAZORPAY_SCRIPT_ID;
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
    document.body.appendChild(script);
  });
};

export const isRazorpayConfigured = () => Boolean(RAZORPAY_KEY);

export const openRazorpayCheckout = ({
  amount,
  order,
  paymentMethod,
  onSuccess,
  onCancel,
  onError,
}) => {
  if (!isRazorpayConfigured()) {
    onError("Razorpay public key is not configured. Add VITE_RAZORPAY_KEY_ID in your environment.");
    return;
  }

  ensureRazorpayScript()
    .then(() => {
      if (!window.Razorpay) {
        onError("Razorpay checkout could not be initialized.");
        return;
      }

      const safeOrderAmount = Math.round(Number(amount) * 100);
      if (!safeOrderAmount || safeOrderAmount < 1) {
        onError("Invalid checkout amount.");
        return;
      }

      const razorpayOptions = {
        key: RAZORPAY_KEY,
        amount: safeOrderAmount,
        currency: "INR",
        name: "Kadai",
        description: `Kadai ${paymentMethod === "google-pay" ? "Google Pay" : "Razorpay"} order`,
        handler: (response) => {
          if (!response?.razorpay_payment_id) {
            onError("Payment verification failed. Please try again.");
            return;
          }

          onSuccess(response);
        },
        modal: {
          ondismiss: () => {
            onCancel("Payment cancelled before completion. No order was placed.");
          },
        },
        theme: {
          color: "#65a91a",
        },
        notes: {
          order_id: order?.id || "",
          payment_method: paymentMethod,
        },
      };

      const razorpay = new window.Razorpay(razorpayOptions);
      razorpay.open();
    })
    .catch((error) => {
      onError(error?.message || "Payment gateway failed to load.");
    });
};
