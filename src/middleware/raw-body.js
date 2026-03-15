function captureRawBody(req, res, buf, encoding) {
  if (!buf || buf.length === 0) {
    req.rawBody = "";
    return;
  }

  req.rawBody = buf.toString(encoding || "utf8");
}

module.exports = {
  captureRawBody
};
