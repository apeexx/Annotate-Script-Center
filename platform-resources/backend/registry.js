"use strict";

const path = require("path");
const { registerRoutes: registerAsrJudgementRoutes } = require("../alibaba-labelx/asr-judgement/backend");
const {
  registerRoutes: registerAsrTranscriptionRoutes,
} = require("../alibaba-labelx/asr-transcription/backend");
const { registerRoutes: registerDataBakerRoundOneRoutes } = require("../data-baker/round-one-quality/backend");
const { registerRoutes: registerMagicDataHakkaRoutes } = require("../magic-data/hakka-helper/backend");
const { registerRoutes: registerMagicDataMinnanRoutes } = require("../magic-data/minnan-helper/backend");
const { registerRoutes: registerAbakaTask21AiRoutes } = require("../abaka-ai/task21/backend");
const { registerRoutes: registerAishellTechMinnanRoutes } = require("../aishell-tech/minnan-helper/backend");
const {
  registerRoutes: registerAishellTechVietnameseRoutes,
} = require("../aishell-tech/vietnamese-helper/backend");
const {
  registerRoutes: registerAishellTechThaiRoutes,
} = require("../aishell-tech/thai-helper/backend");
const {
  registerRoutes: registerAishellTechCantoneseRoutes,
} = require("../aishell-tech/cantonese-helper/backend");
const { registerRoutes: registerAdminSessionRoutes } = require("./admin-session");
const { registerRoutes: registerAdminDashboardRoutes } = require("./admin-dashboard");
const { registerRoutes: registerAdminDownloadCenterRoutes } = require("./admin-download-center");
const { registerRoutes: registerProjectDataDownloadRoutes } = require("./project-data-download");
const { registerRoutes: registerAiCallLogDownloadRoutes } = require("./ai-call-log-download");

function registerProjectRoutes(router, options) {
  const config = options && typeof options === "object" ? options : {};
  registerAsrJudgementRoutes(router, {
    dataDir:
      config.asrJudgement?.dataDir ||
      process.env.ASR_JUDGEMENT_STATS_DIR ||
      path.join(__dirname, "..", "alibaba-labelx", "asr-judgement", "backend", "statistics-data"),
    persistRowsJson:
      config.asrJudgement?.persistRowsJson ||
      process.env.ASR_JUDGEMENT_PERSIST_ROWS_JSON === "1",
    persistUploadEvents:
      config.asrJudgement?.persistUploadEvents ||
      process.env.ASR_JUDGEMENT_PERSIST_UPLOAD_EVENTS === "1",
  });
  registerAsrTranscriptionRoutes(router, {
    dataDir:
      config.asrTranscription?.dataDir ||
      process.env.ASR_TRANSCRIPTION_STATS_DIR ||
      path.join(
        __dirname,
        "..",
        "alibaba-labelx",
        "asr-transcription",
        "backend",
        "statistics-data"
      ),
    persistRowsJson:
      config.asrTranscription?.persistRowsJson ||
      process.env.ASR_TRANSCRIPTION_PERSIST_ROWS_JSON === "1",
    persistUploadEvents:
      config.asrTranscription?.persistUploadEvents ||
      process.env.ASR_TRANSCRIPTION_PERSIST_UPLOAD_EVENTS === "1",
  });
  registerDataBakerRoundOneRoutes(router, config.dataBakerRoundOneQuality || {});
  registerMagicDataHakkaRoutes(
    router,
    config.magicDataHakkaHelper || config.magicDataAnnotator || {}
  );
  registerMagicDataMinnanRoutes(router, config.magicDataMinnanHelper || {});
  registerAbakaTask21AiRoutes(router, config.abakaTask21Ai || {});
  registerAishellTechMinnanRoutes(router, config.aishellTechMinnanHelper || {});
  registerAishellTechVietnameseRoutes(router, config.aishellTechVietnameseHelper || {});
  registerAishellTechThaiRoutes(router, config.aishellTechThaiHelper || {});
  registerAishellTechCantoneseRoutes(router, config.aishellTechCantoneseHelper || {});
  registerAdminSessionRoutes(router, config.adminSession || {});
  registerAdminDashboardRoutes(router, {
    projectDataDownload: config.projectDataDownload || {},
    aiCallLogDownload: config.aiCallLogDownload || {},
  });
  registerAdminDownloadCenterRoutes(router, config.adminDownloadCenter || {});
  registerProjectDataDownloadRoutes(router, config.projectDataDownload || {});
  registerAiCallLogDownloadRoutes(router, config.aiCallLogDownload || {});
}

module.exports = {
  registerProjectRoutes,
};
