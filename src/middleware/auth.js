const { createSignature, safeEqual } = require("../utils/signature");

const MAX_SKEW_MS = 5 * 60 * 1000;

function redactHeaders(headers) {
  const next = { ...headers };

  if (next.authorization) {
    next.authorization = "[redacted]";
  }

  if (next["x-signature"]) {
    next["x-signature"] = "[redacted]";
  }

  return next;
}

function requireProxyAuth(config) {
  return (req, res, next) => {
    const authorization = req.get("authorization") || "";
    const timestamp = req.get("x-timestamp") || "";
    const signature = req.get("x-signature") || "";
    const expectedAuthorization = `Bearer ${config.authToken}`;

    if (!safeEqual(authorization, expectedAuthorization)) {
      return res.status(401).json({ error: "invalid_authorization" });
    }

    const timestampMs = Number(timestamp);
    if (!Number.isFinite(timestampMs)) {
      return res.status(401).json({ error: "invalid_timestamp" });
    }

    if (Math.abs(Date.now() - timestampMs) > MAX_SKEW_MS) {
      return res.status(401).json({ error: "expired_timestamp" });
    }

    const expectedSignature = createSignature(timestamp, req.rawBody || "", config.signingSecret);
    if (!safeEqual(signature, expectedSignature)) {
      return res.status(401).json({ error: "invalid_signature" });
    }

    req.redactedHeaders = redactHeaders(req.headers);
    next();
  };
}

module.exports = {
  requireProxyAuth
};
