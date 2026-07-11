"use strict";

const { registerAdminDashboardRoutes } = require("./routes");

function registerRoutes(router, options) {
  registerAdminDashboardRoutes(router, options || {});
}

module.exports = {
  registerRoutes,
};
