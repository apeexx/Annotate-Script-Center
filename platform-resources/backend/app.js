"use strict";

const http = require("http");
const { createRouter } = require("./router");
const { sendJson } = require("./response");
const { registerProjectRoutes } = require("./registry");

function createPlatformResourcesServer(options) {
  const router = createRouter();

  router.get("/", function ({ response }) {
    sendJson(response, 200, {
      success: true,
      service: "platform-resources-backend",
      projects: [
        "alibaba-labelx/asr-judgement",
        "alibaba-labelx/asr-transcription",
        "data-baker/round-one-quality",
        "aishell-tech/minnan-helper",
        "admin/session",
        "admin/dashboard",
        "admin/dashboard/runtime-logs",
        "admin/download-center",
        "admin/project-data-download",
        "admin/ai-call-log",
      ],
    });
  });

  registerProjectRoutes(router, options || {});

  return http.createServer(function (request, response) {
    void router.handle(request, response);
  });
}

module.exports = {
  createPlatformResourcesServer,
};
