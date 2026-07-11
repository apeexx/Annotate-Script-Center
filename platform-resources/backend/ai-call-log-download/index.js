"use strict";

const { registerAiCallLogDownloadRoutes } = require("./routes");

function registerRoutes(router, options) {
  registerAiCallLogDownloadRoutes(router, options || {});
}

module.exports = {
  registerRoutes,
};
