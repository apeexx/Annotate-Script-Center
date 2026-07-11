"use strict";

const { registerAiRoutes } = require("./ai-routes");

function registerRoutes(router, options) {
  const config = options && typeof options === "object" ? options : {};
  registerAiRoutes(router, config);
}

module.exports = {
  registerRoutes,
};
