(function () {
  const constants = globalThis.ASREdgeConstants || {};
  const storage = globalThis.ASREdgeStorage || null;
  let currentSettings = null;

  function getElement(id) {
    return document.getElementById(id);
  }

  function normalizeMode(value) {
    return String(value || "").trim().toLowerCase() === "local" ? "local" : "server";
  }

  function getBackendBaseUrls(settings) {
    const defaults = constants.DEFAULT_BACKEND_BASE_URLS || {};
    const stored = settings?.meta?.backendBaseUrls || {};
    return {
      server: String(stored.server || defaults.server || "https://script.aisiyunling.com").replace(/\/+$/, ""),
      local: String(stored.local || defaults.local || "http://127.0.0.1:3333").replace(/\/+$/, ""),
    };
  }

  function getScriptEntries(settings) {
    const scripts = constants.SCRIPT_LIBRARY || {};
    return Object.keys(scripts)
      .map(function (scriptId) {
        return scripts[scriptId];
      })
      .filter(function (script) {
        if (!script || !script.id) {
          return false;
        }
        return typeof constants.isScriptVisible === "function"
          ? constants.isScriptVisible(script.id, settings || {})
          : true;
      });
  }

  function getPlatformName(platformId) {
    const platform = constants.PLATFORM_LIBRARY?.[platformId] || {};
    return platform.label || platformId || "未知平台";
  }

  function isEnabled(settings, scriptId) {
    return typeof constants.isScriptRuntimeAccessible === "function"
      ? constants.isScriptRuntimeAccessible(scriptId, settings || {})
      : false;
  }

  function renderSummary(settings) {
    const manifest = chrome.runtime.getManifest();
    const mode = normalizeMode(settings?.meta?.backendEndpointMode);
    const scripts = getScriptEntries(settings);
    const platformIds = new Set(scripts.map(function (script) { return script.platformId; }));
    const enabledCount = scripts.filter(function (script) {
      return isEnabled(settings, script.id);
    }).length;

    getElement("extension-name").textContent = constants.EXTENSION_NAME || "标注脚本中心";
    getElement("workspace-brand-title").textContent = constants.EXTENSION_NAME || "标注脚本中心";
    getElement("workspace-version").textContent = "v" + (manifest.version || "0.0.0");
    getElement("workspace-release-channel").textContent = "public";
    getElement("workspace-backend-mode").textContent = mode === "local" ? "本机" : "服务器";
    getElement("workspace-enabled-count").textContent = String(enabledCount);
    getElement("workspace-library-count").textContent =
      String(platformIds.size) + " / " + String(scripts.length);

    const urls = getBackendBaseUrls(settings);
    getElement("home-endpoint-server-url").value = urls.server;
    getElement("home-endpoint-local-url").value = urls.local;
  }

  function renderScripts(settings) {
    const root = getElement("script-center-view");
    root.textContent = "";
    const scripts = getScriptEntries(settings);
    if (!scripts.length) {
      const empty = document.createElement("section");
      empty.className = "detail-panel";
      empty.textContent = "当前没有可显示脚本。";
      root.appendChild(empty);
      return;
    }

    scripts.forEach(function (script) {
      const card = document.createElement("article");
      card.className = "platform-card";

      const title = document.createElement("h2");
      title.textContent = script.label || script.shortLabel || script.id;

      const meta = document.createElement("p");
      meta.className = "detail-copy";
      meta.textContent = getPlatformName(script.platformId);

      const desc = document.createElement("p");
      desc.className = "detail-copy";
      desc.textContent = script.description || script.note || "";

      const button = document.createElement("button");
      const enabled = isEnabled(settings, script.id);
      button.className = enabled ? "danger-button" : "primary-button";
      button.type = "button";
      button.textContent = enabled ? "关闭脚本" : "启用脚本";
      button.addEventListener("click", function () {
        void setScriptEnabled(script.id, !enabled);
      });

      card.appendChild(title);
      card.appendChild(meta);
      if (desc.textContent) {
        card.appendChild(desc);
      }
      card.appendChild(button);
      root.appendChild(card);
    });
  }

  function showStatus(text) {
    getElement("home-endpoint-status").textContent = text || "";
  }

  async function setScriptEnabled(scriptId, enabled) {
    if (!storage || typeof storage.setScriptEnabled !== "function") {
      showStatus("当前扩展存储不可用。");
      return;
    }
    currentSettings = await storage.setScriptEnabled(scriptId, enabled);
    render(currentSettings);
  }

  async function saveBackendSettings(mode) {
    if (!storage || typeof storage.patchSettings !== "function") {
      showStatus("当前扩展存储不可用。");
      return;
    }
    const server = getElement("home-endpoint-server-url").value;
    const local = getElement("home-endpoint-local-url").value;
    currentSettings = await storage.patchSettings({
      meta: {
        backendEndpointMode: normalizeMode(mode || currentSettings?.meta?.backendEndpointMode),
        backendBaseUrls: {
          server: server,
          local: local,
        },
      },
    });
    render(currentSettings);
    showStatus("已保存。");
  }

  function render(settings) {
    currentSettings = settings || currentSettings || {};
    renderSummary(currentSettings);
    renderScripts(currentSettings);
  }

  document.addEventListener("DOMContentLoaded", async function () {
    try {
      if (!storage || typeof storage.getSettings !== "function") {
        throw new Error("扩展存储不可用");
      }
      currentSettings = await storage.getSettings();
      getElement("home-endpoint-server").addEventListener("click", function () {
        void saveBackendSettings("server");
      });
      getElement("home-endpoint-local").addEventListener("click", function () {
        void saveBackendSettings("local");
      });
      getElement("home-endpoint-save").addEventListener("click", function () {
        void saveBackendSettings();
      });
      render(currentSettings);
    } catch (error) {
      const node = getElement("options-error");
      node.classList.remove("hidden");
      node.textContent = error && error.message ? error.message : String(error);
    }
  });
})();
