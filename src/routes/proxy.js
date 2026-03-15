const express = require("express");

const ALLOWED_PREFIXES = ["/cgi-bin/", "/externalcontact/", "/linkedcorp/"];
const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade"
]);

function normalizeTargetPath(pathSuffix) {
  const normalized = `/${pathSuffix || ""}`.replace(/\/{2,}/g, "/");

  if (normalized.includes("..")) {
    return null;
  }

  if (!ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return null;
  }

  return normalized;
}

function buildTargetUrl(baseUrl, pathSuffix, originalUrl) {
  const normalizedPath = normalizeTargetPath(pathSuffix);
  if (!normalizedPath) {
    return null;
  }

  const base = new URL(baseUrl);
  const url = new URL(normalizedPath, base);
  const queryIndex = originalUrl.indexOf("?");
  if (queryIndex >= 0) {
    url.search = originalUrl.slice(queryIndex);
  }

  return url;
}

function filterForwardHeaders(headers) {
  const next = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerKey)) {
      continue;
    }

    if (lowerKey === "authorization" || lowerKey === "x-signature" || lowerKey === "x-timestamp") {
      continue;
    }

    next[key] = value;
  }

  next.accept = headers.accept || "application/json, text/plain, */*";
  return next;
}

function createProxyRouter(config) {
  const router = express.Router();

  router.all("/*", async (req, res, next) => {
    const pathSuffix = req.params[0] || "";
    const targetUrl = buildTargetUrl(config.wecomBaseUrl, pathSuffix, req.originalUrl);

    if (!targetUrl) {
      return res.status(403).json({ error: "path_not_allowed" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: filterForwardHeaders(req.headers),
        body: ["GET", "HEAD"].includes(req.method) ? undefined : req.rawBody,
        signal: controller.signal
      });

      res.status(response.status);

      response.headers.forEach((value, key) => {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch (error) {
      if (error.name === "AbortError") {
        return res.status(504).json({ error: "upstream_timeout" });
      }

      next(error);
    } finally {
      clearTimeout(timeout);
    }
  });

  return router;
}

module.exports = {
  createProxyRouter
};
