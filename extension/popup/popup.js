(function () {
  const constants = globalThis.ASREdgeConstants || {};
  const storage = globalThis.ASREdgeStorage || null;
  const scriptLibrary = constants.SCRIPT_LIBRARY || {};
  const transcriptionProjectId = constants.TRANSCRIPTION_PROJECT_ID || "transcription";
  const judgementProjectId = constants.JUDGEMENT_PROJECT_ID || "judgement";
  const lightwheelScriptId = constants.LIGHTWHEEL_VIEW_PANEL_SCRIPT_ID || "lightwheelViewPanel";
  const dataBakerScriptId =
    constants.DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID || "dataBakerRoundOneQuality";
  const magicDataHakkaScriptId =
    constants.MAGIC_DATA_ANNOTATOR_SCRIPT_ID || "magicDataAnnotatorAiReview";
  const magicDataMinnanScriptId =
    constants.MAGIC_DATA_MINNAN_SCRIPT_ID || "magicDataMinnanAssistant";
  const aishellMinnanScriptId =
    constants.AISHELL_TECH_MINNAN_SCRIPT_ID || "aishellTechMinnanAssistant";
  const aishellVietnameseScriptId =
    constants.AISHELL_TECH_VIETNAMESE_SCRIPT_ID || "aishellTechVietnameseAssistant";
  const aishellThaiScriptId =
    constants.AISHELL_TECH_THAI_SCRIPT_ID || "aishellTechThaiAssistant";
  const aishellShortDramaScriptId =
    constants.AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID || "aishellTechCnEnShortDrama";
  const abakaScriptId = constants.ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID || "abakaAiTaskPageCapture";
  const haitianScriptId =
    constants.HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID || "haitianUtransAudioDownloadHelper";
  let currentScriptId = "";
  let currentSettings = null;

  function getElement(id) {
    return document.getElementById(id);
  }

  function queryTabs(queryInfo) {
    return new Promise(function (resolve) {
      chrome.tabs.query(queryInfo, function (tabs) {
        resolve(Array.isArray(tabs) ? tabs : []);
      });
    });
  }

  function setPopupStatus(text) {
    getElement("popup-status").textContent = text || "";
  }

  function setTogglePill(text, tone, disabled) {
    const node = getElement("detected-status-pill");
    node.textContent = text;
    node.className = "pill-toggle " + tone;
    node.disabled = disabled === true;
  }

  function getScriptLabel(scriptId) {
    const script = scriptLibrary[scriptId] || {};
    return script.label || script.shortLabel || scriptId || "未命中脚本";
  }

  function isScriptEnabled(settings, scriptId) {
    return typeof constants.isScriptRuntimeAccessible === "function"
      ? constants.isScriptRuntimeAccessible(scriptId, settings || {})
      : false;
  }

  function getMagicDataActiveScript(settings) {
    const active = String(settings?.platforms?.magicData?.activeScriptId || "").trim();
    const hakkaEnabled = isScriptEnabled(settings, magicDataHakkaScriptId);
    const minnanEnabled = isScriptEnabled(settings, magicDataMinnanScriptId);
    if (active === magicDataHakkaScriptId && hakkaEnabled) {
      return magicDataHakkaScriptId;
    }
    if (active === magicDataMinnanScriptId && minnanEnabled) {
      return magicDataMinnanScriptId;
    }
    if (hakkaEnabled) {
      return magicDataHakkaScriptId;
    }
    return minnanEnabled ? magicDataMinnanScriptId : "";
  }

  function getAishellActiveScript(settings) {
    const active = String(settings?.platforms?.aishellTech?.activeScriptId || "").trim();
    const ids = [
      aishellMinnanScriptId,
      aishellVietnameseScriptId,
      aishellThaiScriptId,
      aishellShortDramaScriptId,
    ];
    if (ids.indexOf(active) >= 0 && isScriptEnabled(settings, active)) {
      return active;
    }
    return ids.find(function (scriptId) {
      return isScriptEnabled(settings, scriptId);
    }) || "";
  }

  function detectScript(urlString, settings) {
    if (!urlString) {
      return "";
    }
    let url;
    try {
      url = new URL(urlString);
    } catch (error) {
      return "";
    }

    if (url.hostname === constants.TARGET_PLATFORM?.host) {
      const path = String(url.pathname || "").toLowerCase();
      if (path.startsWith("/corpora/labeling/")) {
        return settings?.platforms?.alibabaLabelx?.scriptCenter?.activeProjectId || transcriptionProjectId;
      }
      return "";
    }

    if (url.hostname === constants.LIGHTWHEEL_PLATFORM?.host) {
      return url.pathname === "/w/video3/index.html" && url.searchParams.get("access") === "1"
        ? lightwheelScriptId
        : "";
    }

    if (url.hostname === constants.DATA_BAKER_PLATFORM?.host) {
      return String(url.pathname || "").toLowerCase().startsWith("/v2") ? dataBakerScriptId : "";
    }

    if (url.hostname === constants.MAGIC_DATA_PLATFORM?.host) {
      return String(url.hash || "").toLowerCase().indexOf("#/asrmark") >= 0
        ? getMagicDataActiveScript(settings)
        : "";
    }

    if (url.hostname === constants.AISHELL_TECH_PLATFORM?.host) {
      return String(url.pathname || "").toLowerCase() === "/mytask/mark"
        ? getAishellActiveScript(settings)
        : "";
    }

    if (url.hostname === constants.ABAKA_AI_PLATFORM?.host) {
      return abakaScriptId;
    }

    if (url.hostname === constants.HAITIAN_UTRANS_PLATFORM?.host) {
      return haitianScriptId;
    }

    return "";
  }

  function openScriptCenter(scriptId) {
    const url = scriptId
      ? chrome.runtime.getURL("options/options.html?script=" + encodeURIComponent(scriptId))
      : chrome.runtime.getURL("options/options.html");
    chrome.tabs.create({ url: url });
    window.close();
  }

  async function render() {
    if (!storage || typeof storage.getSettings !== "function") {
      setPopupStatus("扩展存储不可用。");
      return;
    }
    currentSettings = await storage.getSettings();
    const tabs = await queryTabs({ active: true, currentWindow: true });
    currentScriptId = detectScript(tabs[0]?.url || "", currentSettings);
    document.title = constants.EXTENSION_NAME || "标注脚本中心";
    getElement("extension-name").textContent = constants.EXTENSION_NAME || "标注脚本中心";
    getElement("stage-label").textContent = constants.STAGE_LABEL || "脚本中心";

    if (!currentScriptId) {
      getElement("detected-title").textContent = "当前页面未命中脚本";
      getElement("detected-description").textContent = "可打开脚本中心查看全部公开脚本。";
      getElement("open-script-settings").disabled = true;
      setTogglePill("未命中", "pending", true);
      return;
    }

    const enabled = isScriptEnabled(currentSettings, currentScriptId);
    getElement("detected-title").textContent = getScriptLabel(currentScriptId);
    getElement("detected-description").textContent = enabled
      ? "当前页面命中已启用脚本。"
      : "当前页面命中脚本，但该脚本未启用。";
    getElement("open-script-settings").disabled = false;
    setTogglePill(enabled ? "已启用" : "未启用", enabled ? "enabled" : "disabled", false);
  }

  async function toggleCurrentScript() {
    if (!currentScriptId || !storage || typeof storage.setScriptEnabled !== "function") {
      return;
    }
    const enabled = isScriptEnabled(currentSettings || {}, currentScriptId);
    await storage.setScriptEnabled(currentScriptId, !enabled);
    await render();
  }

  document.addEventListener("DOMContentLoaded", async function () {
    getElement("stage-label").addEventListener("click", function () {
      openScriptCenter("");
    });
    getElement("open-script-settings").addEventListener("click", function () {
      openScriptCenter(currentScriptId);
    });
    getElement("detected-status-pill").addEventListener("click", function () {
      void toggleCurrentScript();
    });
    await render();
  });
})();
