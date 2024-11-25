var ovh = require("ovh")({
  endpoint: "ovh-ca",
  appKey: "ISI_APP_KEY",
  appSecret: "ISI_APP_SECRET",
});

ovh.request(
  "POST",
  "/auth/credential",
  {
    accessRules: [
      { method: "GET", path: "/*" },
      { method: "POST", path: "/*" },
      { method: "PUT", path: "/*" },
      { method: "DELETE", path: "/*" },
    ],
  },
  function (error, credential) {
    console.log(error || credential);
  }
);
