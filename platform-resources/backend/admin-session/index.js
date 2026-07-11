"use strict";

const { registerAdminSessionRoutes } = require("./routes");

function registerRoutes(router, options) {
  registerAdminSessionRoutes(router, options || {});
}

module.exports = {
  registerRoutes,
};
