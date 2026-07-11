"use strict";

const { registerAiRoutes } = require("./ai-routes");

function registerRoutes(router, options) {
  void options;
  registerAiRoutes(router);
}

module.exports = {
  registerRoutes,
};
