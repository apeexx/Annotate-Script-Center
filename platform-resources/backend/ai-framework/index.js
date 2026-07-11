"use strict";

const {
  createNormalizedRequest,
} = require("./contracts/normalized-request");
const {
  createNormalizedResponse,
} = require("./contracts/normalized-response");
const { createAiRoute } = require("./core/create-ai-route");
const { loadProjectAssets } = require("./loaders/project-assets");
const {
  executeProjectPipeline,
} = require("./runtime/execute-project-pipeline");
const {
  createProjectAiRegistry,
  getProjectAiAdapter,
  listProjectAiAdapters,
  registerProjectAiAdapter,
} = require("./registry/project-ai-registry");

module.exports = {
  createAiRoute,
  createNormalizedRequest,
  createNormalizedResponse,
  createProjectAiRegistry,
  executeProjectPipeline,
  getProjectAiAdapter,
  listProjectAiAdapters,
  loadProjectAssets,
  registerProjectAiAdapter,
};
