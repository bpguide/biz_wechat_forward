const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { config, validateConfig } = require("./config");
const { requireProxyAuth } = require("./middleware/auth");
const { captureRawBody } = require("./middleware/raw-body");
const { createProxyRouter } = require("./routes/proxy");

validateConfig();

const app = express();

if (config.trustProxy) {
  app.set("trust proxy", true);
}

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  morgan(':remote-addr :method :url :status :res[content-length] - :response-time ms')
);

app.use(
  express.json({
    limit: "1mb",
    verify: captureRawBody,
    type: ["application/json", "application/*+json"]
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "1mb",
    verify: captureRawBody
  })
);

app.use(
  express.text({
    limit: "1mb",
    verify: captureRawBody,
    type: ["text/*", "application/xml", "text/xml"]
  })
);

app.use((req, res, next) => {
  if (req.rawBody === undefined) {
    req.rawBody = "";
  }

  next();
});

app.get("/healthz", (req, res) => {
  res.json({ ok: true });
});

app.use(
  "/proxy/qyapi",
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false
  }),
  requireProxyAuth(config),
  createProxyRouter(config)
);

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error("Unhandled error:", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl
  });

  res.status(500).json({ error: "internal_server_error" });
});

app.listen(config.port, config.host, () => {
  console.log(`biz-wechat-forward listening on http://${config.host}:${config.port}`);
});
