"use strict";

const { registerProjectDataDownloadRoutes } = require("./routes");

function registerRoutes(router, options) {
  registerProjectDataDownloadRoutes(router, options || {});
}

module.exports = {
  registerRoutes,
};
