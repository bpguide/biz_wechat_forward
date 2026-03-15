const crypto = require("crypto");

const proxyBaseUrl = process.env.PROXY_BASE_URL || "https://proxy.example.com";
const proxyAuthToken = process.env.PROXY_AUTH_TOKEN || "replace-with-proxy-auth-token";
const proxySigningSecret = process.env.PROXY_SIGNING_SECRET || "replace-with-proxy-signing-secret";

function createSignature(timestamp, rawBody, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}\n${rawBody}`)
    .digest("hex");
}

async function callProxy(pathname, options = {}) {
  const method = options.method || "GET";
  const body = options.body === undefined ? "" : JSON.stringify(options.body);
  const timestamp = String(Date.now());
  const signature = createSignature(timestamp, body, proxySigningSecret);

  const response = await fetch(`${proxyBaseUrl}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${proxyAuthToken}`,
      "Content-Type": "application/json",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
      ...(options.headers || {})
    },
    body: ["GET", "HEAD"].includes(method) ? undefined : body
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    throw new Error(`Proxy request failed: ${response.status} ${text}`);
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }

  return text;
}

async function getAccessToken() {
  const corpid = process.env.WECOM_CORP_ID || "wwxxxxxxxxxxxxxxxx";
  const corpsecret = process.env.WECOM_CORP_SECRET || "your-corp-secret";
  const path = `/proxy/qyapi/cgi-bin/gettoken?corpid=${encodeURIComponent(corpid)}&corpsecret=${encodeURIComponent(corpsecret)}`;

  return callProxy(path, { method: "GET" });
}

async function sendTextMessage(accessToken) {
  const path = `/proxy/qyapi/cgi-bin/message/send?access_token=${encodeURIComponent(accessToken)}`;
  const payload = {
    touser: process.env.WECOM_TO_USER || "UserID1|UserID2",
    msgtype: "text",
    agentid: Number(process.env.WECOM_AGENT_ID || "1000002"),
    text: {
      content: "Hello from home PC via proxy"
    },
    safe: 0
  };

  return callProxy(path, {
    method: "POST",
    body: payload
  });
}

async function main() {
  const tokenResult = await getAccessToken();
  console.log("gettoken result:", tokenResult);

  if (!tokenResult.access_token) {
    throw new Error("Missing access_token in gettoken response");
  }

  const sendResult = await sendTextMessage(tokenResult.access_token);
  console.log("message/send result:", sendResult);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
