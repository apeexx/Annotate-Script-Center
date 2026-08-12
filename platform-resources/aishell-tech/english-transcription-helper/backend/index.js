"use strict";

const { registerAiRoutes } = require("./ai-routes");

function registerAishellTechEnglishTranscriptionRoutes(router, options) {
  void options;
  registerAiRoutes(router);
}

module.exports = {
  registerAishellTechEnglishTranscriptionRoutes,
  registerRoutes: registerAishellTechEnglishTranscriptionRoutes,
};
