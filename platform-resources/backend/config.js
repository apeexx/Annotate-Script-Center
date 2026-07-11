"use strict";

function getServerConfig() {
  return {
    host:
      process.env.PLATFORM_RESOURCES_SERVER_HOST ||
      process.env.ASR_JUDGEMENT_SERVER_HOST ||
      "127.0.0.1",
    port: Number(
      process.env.PLATFORM_RESOURCES_SERVER_PORT ||
        process.env.ASR_JUDGEMENT_SERVER_PORT ||
        3333
    ),
  };
}

module.exports = {
  getServerConfig,
};
