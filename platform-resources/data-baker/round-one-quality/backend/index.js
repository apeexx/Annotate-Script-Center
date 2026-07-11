"use strict";

const { registerAiRoutes } = require("./ai-routes");
const { registerExportRoutes } = require("./export-routes");

function registerRoutes(router, options) {
  const config = options && typeof options === "object" ? options : {};
  registerAiRoutes(router);
  registerExportRoutes(router, {
    dataDir:
      config.exportDataDir ||
      process.env.DATABAKER_ROUND_ONE_EXPORT_DIR ||
      "",
    persistHistory:
      config.persistExportHistory === true ||
      process.env.DATABAKER_ROUND_ONE_EXPORT_HISTORY === "1",
    persistEvents:
      config.persistExportEvents === true ||
      process.env.DATABAKER_ROUND_ONE_EXPORT_EVENTS === "1",
  });
}

module.exports = {
  registerRoutes,
};
