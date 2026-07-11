"use strict";

const routes = require("./routes");
const aiRoutes = require("./ai-routes");

function registerRoutes(router, options) {
  routes.registerAsrTranscriptionRoutes(router, options);
  aiRoutes.registerAiRoutes(router);
}

module.exports = {
  registerRoutes,
  routes,
  aiRoutes,
};
