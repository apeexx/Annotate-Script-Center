"use strict";

const { registerAdminDownloadCenterRoutes } = require("./routes");

function registerRoutes(router, options) {
  registerAdminDownloadCenterRoutes(router, options || {});
}

module.exports = {
  registerRoutes,
};
