"use strict";

const { registerAiRoutes } = require("./ai-routes");

function registerRoutes(router, options) {
  registerAiRoutes(router, options || {});
}

module.exports = { registerRoutes };
