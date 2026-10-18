// Entering demo mode (first time) and resetting it each write a whole
// sample office: cap them per user.
export const DEMO_SANDBOX_RATE_LIMIT = {
  keyPrefix: "demo-sandbox",
  windowMs: 60 * 60 * 1000,
  max: 10,
};

export const DEMO_UNAVAILABLE_CODE = "DEMO_UNAVAILABLE";
