module.exports = {
  apps: [
    {
      name: "biz-wechat-forward",
      script: "./src/app.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
