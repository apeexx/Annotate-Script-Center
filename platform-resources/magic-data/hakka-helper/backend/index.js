"use strict";

const { registerAiRoutes } = require("./ai-routes");

function registerRoutes(router, options) {
  registerAiRoutes(router, options && typeof options === "object" ? options : {});
}

module.exports = {
  registerRoutes,
};
