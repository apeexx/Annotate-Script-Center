"use strict";

const path = require("path");
const { CONFIG_PATH, DOWNLOAD_PATH, UPLOAD_PATH, createLocalServer } = require("./http-server");
const { createStatisticsStore } = require("./file-store");

const host = process.env.ASR_JUDGEMENT_SERVER_HOST || "127.0.0.1";
const port = Number(process.env.ASR_JUDGEMENT_SERVER_PORT || 3333);
const dataDir =
  process.env.ASR_JUDGEMENT_STATS_DIR || path.join(__dirname, "statistics-data");
const persistRowsJson = process.env.ASR_JUDGEMENT_PERSIST_ROWS_JSON === "1";
const persistUploadEvents = process.env.ASR_JUDGEMENT_PERSIST_UPLOAD_EVENTS === "1";

const store = createStatisticsStore({ dataDir, persistRowsJson, persistUploadEvents });
store.ensureDataDir();

const server = createLocalServer({ dataDir, persistRowsJson, persistUploadEvents });

server.listen(port, host, function () {
  console.info(
    "[ASR Judgement][stats-server] listening on http://" +
      host +
      ":" +
      String(port) +
      UPLOAD_PATH
  );
  console.info(
    "[ASR Judgement][stats-server] config on http://" +
      host +
      ":" +
      String(port) +
      CONFIG_PATH
  );
  console.info(
    "[ASR Judgement][stats-server] csv download on http://" +
      host +
      ":" +
      String(port) +
      DOWNLOAD_PATH
  );
});

module.exports = server;
