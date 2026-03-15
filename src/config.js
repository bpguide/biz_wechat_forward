const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  host: process.env.HOST || "127.0.0.1",
  port: asNumber(process.env.PORT, 3000),
  authToken: process.env.PROXY_AUTH_TOKEN || "",
  signingSecret: process.env.PROXY_SIGNING_SECRET || "",
  wecomBaseUrl: process.env.WECOM_BASE_URL || "https://qyapi.weixin.qq.com",
  requestTimeoutMs: asNumber(process.env.REQUEST_TIMEOUT_MS, 10000),
  rateLimitWindowMs: asNumber(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  rateLimitMax: asNumber(process.env.RATE_LIMIT_MAX, 60),
  trustProxy: String(process.env.TRUST_PROXY || "true").toLowerCase() === "true"
};

function validateConfig() {
  const missing = [];

  if (!config.authToken) {
    missing.push("PROXY_AUTH_TOKEN");
  }

  if (!config.signingSecret) {
    missing.push("PROXY_SIGNING_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

module.exports = {
  config,
  validateConfig
};
