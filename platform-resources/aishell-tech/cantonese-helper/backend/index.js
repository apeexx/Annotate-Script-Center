"use strict";

const { registerAiRoutes } = require("./ai-routes");

function registerRoutes(router) {
  registerAiRoutes(router);
}

module.exports = {
  registerRoutes,
};
