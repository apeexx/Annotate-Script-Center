"use strict";

const http = require("http");
const { createRouter } = require("../../../backend/router");
const { sendJson } = require("../../../backend/response");
const {
  CONFIG_PATH,
  DOWNLOAD_PATH,
  HEALTH_PATH,
  LEGACY_CONFIG_PATH,
  LEGACY_HEALTH_PATH,
  LEGACY_UPLOAD_PATH,
  UPLOAD_PATH,
  createScheduleConfig,
  readRequestBody,
  registerAsrJudgementRoutes,
} = require("./routes");

function createLocalServer(options) {
  const router = createRouter();
  registerAsrJudgementRoutes(router, options);
  router.get("/", function ({ response }) {
    sendJson(response, 200, {
      success: true,
      service: "asr-judgement-statistics",
      uploadPath: UPLOAD_PATH,
      legacyUploadPath: LEGACY_UPLOAD_PATH,
      configPath: CONFIG_PATH,
      legacyConfigPath: LEGACY_CONFIG_PATH,
      healthPath: HEALTH_PATH,
      legacyHealthPath: LEGACY_HEALTH_PATH,
      downloadPath: DOWNLOAD_PATH,
    });
  });

  return http.createServer(function (request, response) {
    void router.handle(request, response);
  });
}

module.exports = {
  CONFIG_PATH: LEGACY_CONFIG_PATH,
  DOWNLOAD_PATH,
  HEALTH_PATH: LEGACY_HEALTH_PATH,
  UPLOAD_PATH: LEGACY_UPLOAD_PATH,
  NEW_CONFIG_PATH: CONFIG_PATH,
  NEW_DOWNLOAD_PATH: DOWNLOAD_PATH,
  NEW_HEALTH_PATH: HEALTH_PATH,
  NEW_UPLOAD_PATH: UPLOAD_PATH,
  createScheduleConfig,
  createLocalServer,
  readRequestBody,
  sendJson,
};
