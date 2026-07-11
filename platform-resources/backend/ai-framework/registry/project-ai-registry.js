"use strict";

function normalizeProjectId(value) {
  return String(value || "").trim();
}

function createProjectAiRegistry() {
  const adapters = new Map();

  function register(adapter) {
    const source = adapter && typeof adapter === "object" ? adapter : null;
    const projectId = normalizeProjectId(source && source.projectId);
    if (!projectId) {
      const error = new Error("AI adapter 缺少 projectId。");
      error.code = "ai-framework-project-id-required";
      throw error;
    }

    adapters.set(projectId, source);
    return source;
  }

  function get(projectId) {
    return adapters.get(normalizeProjectId(projectId)) || null;
  }

  function list() {
    return Array.from(adapters.values());
  }

  return {
    register,
    get,
    list,
  };
}

const defaultRegistry = createProjectAiRegistry();

module.exports = {
  createProjectAiRegistry,
  registerProjectAiAdapter: defaultRegistry.register,
  getProjectAiAdapter: defaultRegistry.get,
  listProjectAiAdapters: defaultRegistry.list,
};
