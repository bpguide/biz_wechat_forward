const crypto = require("crypto");

function createSignature(timestamp, bodyText, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}\n${bodyText}`)
    .digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || "", "utf8");
  const rightBuffer = Buffer.from(right || "", "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = {
  createSignature,
  safeEqual
};
