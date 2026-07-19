"use strict";

const { loadDefaultEnvFiles } = require("./env-loader");
const { createPlatformResourcesServer } = require("./app");
const { getServerConfig } = require("./config");
const { appendRuntimeLog } = require("./runtime-log-store");

loadDefaultEnvFiles();

const config = getServerConfig();
const server = createPlatformResourcesServer();

server.listen(config.port, config.host, function () {
  const baseUrl = "http://" + config.host + ":" + String(config.port);
  appendRuntimeLog({
    level: "success",
    scope: "backend.server",
    action: "listen",
    message: "platform-resources 后端已启动",
    details: {
      baseUrl,
    },
  });
  console.info("[Platform Resources][backend] listening on " + baseUrl);
  console.info(
    "[Platform Resources][backend] ASR judgement upload: " +
      baseUrl +
      "/api/alibaba-labelx/asr-judgement/statistics/upload"
  );
  console.info(
    "[Platform Resources][backend] ASR judgement CSV: " +
      baseUrl +
      "/api/alibaba-labelx/asr-judgement/statistics/download"
  );
  console.info(
    "[Platform Resources][backend] ASR judgement suppliers: " +
      baseUrl +
      "/api/alibaba-labelx/asr-judgement/statistics/suppliers"
  );
  console.info(
    "[Platform Resources][backend] ASR transcription upload: " +
      baseUrl +
      "/api/alibaba-labelx/asr-transcription/statistics/upload"
  );
  console.info(
    "[Platform Resources][backend] ASR transcription CSV: " +
      baseUrl +
      "/api/alibaba-labelx/asr-transcription/statistics/download"
  );
  console.info(
    "[Platform Resources][backend] ASR transcription suppliers: " +
      baseUrl +
      "/api/alibaba-labelx/asr-transcription/statistics/suppliers"
  );
  console.info(
    "[Platform Resources][backend] ASR judgement AI health: " +
      baseUrl +
      "/api/alibaba-labelx/asr-judgement/ai/health"
  );
  console.info(
    "[Platform Resources][backend] ASR judgement AI suggest: " +
      baseUrl +
      "/api/alibaba-labelx/asr-judgement/ai/suggest"
  );
  console.info(
    "[Platform Resources][backend] DataBaker AI health: " +
      baseUrl +
      "/api/data-baker/round-one-quality/ai/recommend/health"
  );
  console.info(
    "[Platform Resources][backend] DataBaker AI recommend: " +
      baseUrl +
      "/api/data-baker/round-one-quality/ai/recommend"
  );
  console.info(
    "[Platform Resources][backend] Aishell Tech AI health: " +
      baseUrl +
      "/api/aishell-tech/minnan-helper/ai/recommend/health"
  );
  console.info(
    "[Platform Resources][backend] Aishell Tech AI recommend: " +
      baseUrl +
      "/api/aishell-tech/minnan-helper/ai/recommend"
  );
  console.info(
    "[Platform Resources][backend] DataBaker export upload: " +
      baseUrl +
      "/api/data-baker/round-one-quality/export/upload"
  );
  console.info(
    "[Platform Resources][backend] DataBaker export CSV: " +
      baseUrl +
      "/api/data-baker/round-one-quality/export/download"
  );
  console.info(
    "[Platform Resources][backend] Admin session unlock: " +
      baseUrl +
      "/api/admin/session/unlock"
  );
  console.info(
    "[Platform Resources][backend] Admin dashboard overview: " +
      baseUrl +
      "/api/admin/dashboard/overview"
  );
  console.info(
    "[Platform Resources][backend] Admin dashboard runtime logs: " +
      baseUrl +
      "/api/admin/dashboard/runtime-logs"
  );
  console.info(
    "[Platform Resources][backend] Project data download options: " +
      baseUrl +
      "/api/admin/project-data-download/options"
  );
  console.info(
    "[Platform Resources][backend] Project data download request: " +
      baseUrl +
      "/api/admin/project-data-download/request"
  );
  console.info(
    "[Platform Resources][backend] Project data download file: " +
      baseUrl +
      "/api/admin/project-data-download/file?token=..."
  );
  console.info(
    "[Platform Resources][backend] AI call log options: " +
      baseUrl +
      "/api/admin/ai-call-log/options"
  );
  console.info(
    "[Platform Resources][backend] AI call log request: " +
      baseUrl +
      "/api/admin/ai-call-log/request"
  );
  console.info(
    "[Platform Resources][backend] AI call log file: " +
      baseUrl +
      "/api/admin/ai-call-log/file?token=..."
  );
});

module.exports = server;
