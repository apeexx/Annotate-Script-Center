(function () {
  const constants = globalThis.ASREdgeConstants || {};
  const storage = globalThis.ASREdgeStorage || null;
  const aiUsageMeta = globalThis.ASREdgeAiUsageMeta || {};
  const projectDownloadSupplierHelper = globalThis.ASREdgeOptionsProjectDownloadSupplier || {};
  const platformLibrary = constants.PLATFORM_LIBRARY || {};
  const scriptLibrary = constants.SCRIPT_LIBRARY || {};
  const transcriptionProjectId = constants.TRANSCRIPTION_PROJECT_ID || "transcription";
  const judgementProjectId = constants.JUDGEMENT_PROJECT_ID || "judgement";
  const lightwheelScriptId = constants.LIGHTWHEEL_VIEW_PANEL_SCRIPT_ID || "lightwheelViewPanel";
  const dataBakerRoundOneQualityScriptId =
    constants.DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID || "dataBakerRoundOneQuality";
  const dataBakerCvpcLiuzhouScriptId =
    constants.DATA_BAKER_CVPC_LIUZHOU_ASSISTANT_SCRIPT_ID || "dataBakerCvpcLiuzhouAssistant";
  const bytedanceAidpSuzhouScriptId =
    constants.BYTEDANCE_AIDP_SUZHOU_HELPER_SCRIPT_ID || "bytedanceAidpSuzhouHelper";
  const bytedanceAidpJinhuaScriptId =
    constants.BYTEDANCE_AIDP_JINHUA_HELPER_SCRIPT_ID || "bytedanceAidpJinhuaHelper";
  const bytedanceAidpPlaybackRatePresets = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const bytedanceAidpFixedWaveZoomPresets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const magicDataAnnotatorScriptId =
    constants.MAGIC_DATA_ANNOTATOR_SCRIPT_ID || "magicDataAnnotatorAiReview";
  const magicDataMinnanScriptId =
    constants.MAGIC_DATA_MINNAN_SCRIPT_ID || "magicDataMinnanAssistant";
  const magicDataHangzhouScriptId =
    constants.MAGIC_DATA_HANGZHOU_SCRIPT_ID || "magicDataHangzhouAssistant";
  const aishellTechMinnanScriptId =
    constants.AISHELL_TECH_MINNAN_SCRIPT_ID || "aishellTechMinnanAssistant";
  const aishellTechVietnameseScriptId =
    constants.AISHELL_TECH_VIETNAMESE_SCRIPT_ID || "aishellTechVietnameseAssistant";
  const aishellTechThaiScriptId =
    constants.AISHELL_TECH_THAI_SCRIPT_ID || "aishellTechThaiAssistant";
  const aishellTechCantoneseScriptId =
    constants.AISHELL_TECH_CANTONESE_SCRIPT_ID || "aishellTechCantoneseAssistant";
  const aishellTechCnEnShortDramaScriptId =
    constants.AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID || "aishellTechCnEnShortDrama";
  const abakaAiTaskPageCaptureScriptId =
    constants.ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID || "abakaAiTaskPageCapture";
  const haitianUtransAudioDownloadHelperScriptId =
    constants.HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID || "haitianUtransAudioDownloadHelper";
  const jdTtsShanghaineseScriptId =
    constants.JD_TTS_SHANGHAINESE_SCRIPT_ID || "jdTtsShanghaineseAssistant";
  const backendModeServer = constants.BACKEND_ENDPOINT_MODE_SERVER || "server";
  const backendModeLocal = constants.BACKEND_ENDPOINT_MODE_LOCAL || "local";
  const backendModeBeta = constants.BACKEND_ENDPOINT_MODE_BETA || "beta";
  const releaseChannel = constants.RELEASE_CHANNEL || "public";
  const canUseBetaFeatures =
    typeof constants.canUseBetaFeatures === "function"
      ? constants.canUseBetaFeatures
      : function () {
          return false;
        };
  const isPlatformVisibleByRelease =
    typeof constants.isPlatformVisible === "function"
      ? constants.isPlatformVisible
      : function () {
          return true;
        };
  const isScriptVisibleByRelease =
    typeof constants.isScriptVisible === "function"
      ? constants.isScriptVisible
      : function () {
          return true;
        };
  const normalizeBetaBackendBaseUrl =
    typeof constants.normalizeBetaBackendBaseUrl === "function"
      ? constants.normalizeBetaBackendBaseUrl
      : function (value) {
          const text = String(value || "").trim().replace(/\/+$/, "");
          return /^https?:\/\//i.test(text) ? text : "";
        };
  const normalizeBackendBaseUrl =
    typeof constants.normalizeBackendBaseUrl === "function"
      ? constants.normalizeBackendBaseUrl
      : function (value, fallback) {
          const text = String(value || "").trim().replace(/\/+$/, "");
          if (/^https?:\/\//i.test(text)) {
            return text;
          }
          const fallbackText = String(fallback || "").trim().replace(/\/+$/, "");
          return /^https?:\/\//i.test(fallbackText) ? fallbackText : "";
        };
  const defaultBackendBaseUrls = Object.assign(
    {
      server: "https://script.xiangtianzhen.store",
      local: "http://127.0.0.1:3333",
      beta: normalizeBetaBackendBaseUrl(constants.DEFAULT_BETA_BACKEND_BASE_URL || ""),
    },
    constants.DEFAULT_BACKEND_BASE_URLS || {}
  );
  const defaultBetaUnlockPasswordSha256 = String(
    constants.BETA_UNLOCK_PASSWORD_SHA256 || ""
  )
    .trim()
    .toLowerCase();
  let activeInlineHelpAnchor = null;
  let hoveredInlineHelpAnchor = null;
  let inlineHelpPopoverNode = null;
  let inlineHelpListenersBound = false;
  let aidpLineNumberWindowListenerBound = false;
  const aidpLineNumberTextareaControllers = new WeakMap();
  const betaFeaturesVisibleByDefault = constants.BETA_FEATURES_VISIBLE_BY_DEFAULT === true;
  const getBackendModeFromSettings =
    typeof constants.getBackendEndpointModeFromSettings === "function"
      ? constants.getBackendEndpointModeFromSettings
      : function (settings) {
          const mode = settings?.meta?.backendEndpointMode;
          return String(mode || "").trim().toLowerCase() === backendModeLocal
            ? backendModeLocal
            : backendModeServer;
        };
  const getBackendBaseUrlByMode =
    typeof constants.getBackendBaseUrlByMode === "function"
      ? constants.getBackendBaseUrlByMode
      : function (mode, settings) {
          const backendBaseUrls =
            typeof constants.getBackendBaseUrlsFromSettings === "function"
              ? constants.getBackendBaseUrlsFromSettings(settings || {})
              : {
                  server: normalizeBackendBaseUrl(
                    settings?.meta?.backendBaseUrls?.server,
                    defaultBackendBaseUrls.server
                  ),
                  local: normalizeBackendBaseUrl(
                    settings?.meta?.backendBaseUrls?.local,
                    defaultBackendBaseUrls.local
                  ),
                  beta: normalizeBackendBaseUrl(
                    settings?.meta?.backendBaseUrls?.beta || settings?.meta?.betaBackendBaseUrl,
                    defaultBackendBaseUrls.beta
                  ),
                };
          const normalizedMode = String(mode || "").trim().toLowerCase();
          if (normalizedMode === backendModeLocal) {
            return backendBaseUrls.local;
          }
          if (normalizedMode === backendModeBeta) {
            return backendBaseUrls.beta;
          }
          return backendBaseUrls.server;
        };
  const getBackendBaseUrlsFromSettings =
    typeof constants.getBackendBaseUrlsFromSettings === "function"
      ? constants.getBackendBaseUrlsFromSettings
      : function (settings) {
          return {
            server: normalizeBackendBaseUrl(
              settings?.meta?.backendBaseUrls?.server,
              defaultBackendBaseUrls.server
            ),
            local: normalizeBackendBaseUrl(
              settings?.meta?.backendBaseUrls?.local,
              defaultBackendBaseUrls.local
            ),
            beta: normalizeBackendBaseUrl(
              settings?.meta?.backendBaseUrls?.beta || settings?.meta?.betaBackendBaseUrl,
              defaultBackendBaseUrls.beta
            ),
          };
        };
  const buildBackendUrl =
    typeof constants.buildBackendUrl === "function"
      ? constants.buildBackendUrl
      : function (path, settingsOrMode) {
          const mode =
            typeof settingsOrMode === "string"
              ? settingsOrMode
              : getBackendModeFromSettings(settingsOrMode || {});
          const baseUrl = String(getBackendBaseUrlByMode(mode, settingsOrMode || {}) || "").replace(/\/+$/, "");
          const normalizedPath = String(path || "").charAt(0) === "/" ? String(path || "") : "/" + String(path || "");
          return baseUrl + normalizedPath;
        };
  const buildDownloadUrl =
    typeof constants.buildDownloadUrl === "function"
      ? constants.buildDownloadUrl
      : function (path, settingsOrMode) {
          const mode =
            typeof settingsOrMode === "string"
              ? settingsOrMode
              : getBackendModeFromSettings(settingsOrMode || {});
          const baseUrl = String(getBackendBaseUrlByMode(mode, settingsOrMode || {}) || "").replace(/\/+$/, "");
          const normalizedPath = String(path || "/").charAt(0) === "/" ? String(path || "/") : "/" + String(path || "/");
          return baseUrl + "/downloads" + normalizedPath;
        };
  const buildProjectDownloadSupplierState =
    typeof projectDownloadSupplierHelper.buildProjectDownloadSupplierState === "function"
      ? projectDownloadSupplierHelper.buildProjectDownloadSupplierState
      : function (dataset) {
          const suppliers = Array.isArray(dataset?.suppliers) ? dataset.suppliers : [];
          return {
            supplierRequired: dataset?.supplierRequired === true,
            showRow: suppliers.length > 0,
            options: suppliers.length > 0
              ? [{ value: "__all__", label: "全部" }].concat(
                  suppliers.map(function (supplier) {
                    const text = String(supplier || "").trim();
                    return {
                      value: text,
                      label: text,
                    };
                  })
                )
              : [],
          };
        };
  const isAllProjectDownloadSuppliersValue =
    typeof projectDownloadSupplierHelper.isAllSuppliersValue === "function"
      ? projectDownloadSupplierHelper.isAllSuppliersValue
      : function (value) {
          return String(value || "").trim() === "__all__";
        };
  const isProjectDownloadSupplierSelectionValid =
    typeof projectDownloadSupplierHelper.isProjectDownloadSupplierSelectionValid === "function"
      ? projectDownloadSupplierHelper.isProjectDownloadSupplierSelectionValid
      : function (dataset, value) {
          if (isAllProjectDownloadSuppliersValue(value)) {
            return true;
          }
          if (dataset?.supplierRequired === true) {
            return Boolean(String(value || "").trim());
          }
          return true;
        };
  const projectDataDownloadOptionsPath =
    constants.PROJECT_DATA_DOWNLOAD_OPTIONS_PATH || "/api/admin/project-data-download/options";
  const projectDataDownloadRequestPath =
    constants.PROJECT_DATA_DOWNLOAD_REQUEST_PATH || "/api/admin/project-data-download/request";
  const aiCallLogDownloadOptionsPath =
    constants.AI_CALL_LOG_DOWNLOAD_OPTIONS_PATH || "/api/admin/ai-call-log/options";
  const aiCallLogDownloadRequestPath =
    constants.AI_CALL_LOG_DOWNLOAD_REQUEST_PATH || "/api/admin/ai-call-log/request";
  const adminSessionUnlockPath = "/api/admin/session/unlock";
  const adminDashboardOverviewPath = "/api/admin/dashboard/overview";
  const adminDashboardRuntimeLogsPath = "/api/admin/dashboard/runtime-logs";
  const adminDownloadCenterReleasesPath = "/api/admin/download-center/releases";
  const pendingTopToastSessionStorageKey = "asr-edge-options-pending-top-toast";
  const optionsRouteState = globalThis.ASREdgeOptionsRouteState || {};
  const parseOptionsRoute =
    typeof optionsRouteState.parseOptionsRoute === "function"
      ? optionsRouteState.parseOptionsRoute
      : function (search, scripts) {
          const query = new URLSearchParams(String(search || "").replace(/^\?/, ""));
          const scriptId = String(query.get("script") || "").trim();
          const view = String(query.get("view") || "").trim().toLowerCase();
          const tab = String(query.get("tab") || "").trim().toLowerCase();
          if (view === "script" && scripts && scripts[scriptId]) {
            return {
              view: "script",
              scriptId,
              adminTab: "overview",
            };
          }
          if (view === "admin") {
            return {
              view: "admin",
              scriptId: null,
              adminTab:
                ["overview", "backend", "exports"].indexOf(tab === "downloads" ? "exports" : tab) >= 0
                  ? tab === "downloads"
                    ? "exports"
                    : tab
                  : "overview",
            };
          }
          if (view === "downloads") {
            return {
              view: "downloads",
              scriptId: null,
              adminTab: "overview",
            };
          }
          return {
            view: "center",
            scriptId: null,
            adminTab: "overview",
          };
        };
  const buildOptionsRouteHref =
    typeof optionsRouteState.buildOptionsRouteHref === "function"
      ? optionsRouteState.buildOptionsRouteHref
      : function (currentHref, route) {
          const next = route && typeof route === "object" ? route : {};
          const url = new URL(String(currentHref || location.href));
          const view = String(next.view || "center").trim().toLowerCase();
          url.searchParams.set(
            "view",
            view === "admin" || view === "script" || view === "downloads" ? view : "center"
          );
          url.searchParams.delete("script");
          url.searchParams.delete("tab");
          if (view === "script" && String(next.scriptId || "").trim()) {
            url.searchParams.set("script", String(next.scriptId || "").trim());
          }
          if (view === "admin") {
            const adminTab = String(next.adminTab || "overview").trim() || "overview";
            url.searchParams.set("tab", adminTab === "downloads" ? "exports" : adminTab);
          }
          return url.toString();
        };
  const optionsWorkbenchState = globalThis.ASREdgeOptionsWorkbenchState || {};
  const sharedAsrAiPanel = globalThis.ASREdgeOptionsSharedAsrAiPanel || {};
  const sharedShortcutPanel = globalThis.ASREdgeOptionsSharedShortcutPanel || {};
  const sharedSelect = globalThis.ASREdgeOptionsSharedSelect || {};
  const buildPlatformEntryDescriptor =
    typeof optionsWorkbenchState.buildPlatformEntryDescriptor === "function"
      ? optionsWorkbenchState.buildPlatformEntryDescriptor
      : function (platform) {
          const target = platform && typeof platform === "object" ? platform : {};
          const explicitEntryUrl = String(target.entryUrl || "").trim();
          const displayHost = String(target.displayHost || target.host || "").trim();
          if (explicitEntryUrl) {
            return {
              displayHost,
              entryUrl: explicitEntryUrl,
            };
          }
          const matches = Array.isArray(target.matches) ? target.matches : [];
          const firstPattern = String(matches[0] || "").trim();
          if (!firstPattern) {
            return {
              displayHost,
              entryUrl: "",
            };
          }
          try {
            const url = new URL(firstPattern.replace(/\*.*$/, ""));
            return {
              displayHost,
              entryUrl: url.origin,
            };
          } catch (_error) {
            const matched = /^(https?:\/\/[^/*]+)/i.exec(firstPattern);
            return {
              displayHost,
              entryUrl: matched ? String(matched[1] || "").trim() : "",
            };
          }
        };
  const buildOrderedPlatformIds =
    typeof optionsWorkbenchState.buildOrderedPlatformIds === "function"
      ? optionsWorkbenchState.buildOrderedPlatformIds
      : function (platformIds, savedOrder) {
          const sourceIds = Array.isArray(platformIds) ? platformIds : [];
          const preferredOrder = Array.isArray(savedOrder) ? savedOrder : [];
          const result = [];
          const knownIds = new Set(sourceIds);
          const seen = new Set();
          preferredOrder.forEach(function (platformId) {
            const normalizedId = String(platformId || "").trim();
            if (!normalizedId || !knownIds.has(normalizedId) || seen.has(normalizedId)) {
              return;
            }
            seen.add(normalizedId);
            result.push(normalizedId);
          });
          sourceIds.forEach(function (platformId) {
            const normalizedId = String(platformId || "").trim();
            if (!normalizedId || seen.has(normalizedId)) {
              return;
            }
            seen.add(normalizedId);
            result.push(normalizedId);
          });
          return result;
        };
  const movePlatformOrderItem =
    typeof optionsWorkbenchState.movePlatformOrderItem === "function"
      ? optionsWorkbenchState.movePlatformOrderItem
      : function (platformIds, movingPlatformId, nextIndex) {
          const orderedIds = Array.isArray(platformIds) ? platformIds.slice() : [];
          const normalizedMovingId = String(movingPlatformId || "").trim();
          const currentIndex = orderedIds.indexOf(normalizedMovingId);
          if (currentIndex < 0) {
            return orderedIds;
          }
          const clampedIndex = Math.max(0, Math.min(orderedIds.length - 1, Number(nextIndex) || 0));
          if (clampedIndex === currentIndex) {
            return orderedIds;
          }
          orderedIds.splice(currentIndex, 1);
          orderedIds.splice(clampedIndex, 0, normalizedMovingId);
          return orderedIds;
        };
  const buildSharedAsrAiPanelSpec =
    typeof sharedAsrAiPanel.buildSharedAsrAiPanelSpec === "function"
      ? sharedAsrAiPanel.buildSharedAsrAiPanelSpec
      : function () {
          return {
            showAutofillConcurrency: false,
            showRecognitionStrategy: false,
            concurrencyInputId: "",
            concurrencyHelpId: "",
            modelFieldOrder: [],
          };
        };
  const renderSharedAsrAutofillConcurrencyField =
    typeof sharedAsrAiPanel.renderSharedAsrAutofillConcurrencyField === "function"
      ? sharedAsrAiPanel.renderSharedAsrAutofillConcurrencyField
      : function () {
          return "";
        };
  const buildSharedAsrAutofillConcurrencyHelp =
    typeof sharedAsrAiPanel.buildSharedAsrAutofillConcurrencyHelp === "function"
      ? sharedAsrAiPanel.buildSharedAsrAutofillConcurrencyHelp
      : function (_scriptId, rule) {
          const currentRule = rule && typeof rule === "object" ? rule : {};
          const modelLabel = currentRule.modelType === "fun_asr" ? "Fun-ASR" : "Omni";
          const defaultValue = Number.isFinite(Number(currentRule.defaultValue))
            ? Math.round(Number(currentRule.defaultValue))
            : 5;
          const min = Number.isFinite(Number(currentRule.min)) ? Math.round(Number(currentRule.min)) : 1;
          const max = Number.isFinite(Number(currentRule.max)) ? Math.round(Number(currentRule.max)) : 25;
          return (
            modelLabel +
            " 默认 " +
            String(defaultValue) +
            "，范围 " +
            String(min) +
            "~" +
            String(max)
          );
        };
  const getDetailWorkbenchLayoutMode =
    typeof optionsWorkbenchState.getDetailWorkbenchLayoutMode === "function"
      ? optionsWorkbenchState.getDetailWorkbenchLayoutMode
      : function (input) {
          const config = input && typeof input === "object" ? input : {};
          if (config.hasBasePanel !== false && config.hasAiPanel === true && config.hasShortcutPanel === true) {
            return "base-ai-shortcut";
          }
          if (config.hasBasePanel !== false && config.hasAiPanel === true) {
            return "base-ai";
          }
          if (config.hasBasePanel !== false && config.hasShortcutPanel === true) {
            return "base-shortcut";
          }
          return "single";
        };
  const buildDetailWorkbenchTrackState =
    typeof optionsWorkbenchState.buildDetailWorkbenchTrackState === "function"
      ? optionsWorkbenchState.buildDetailWorkbenchTrackState
      : function (input) {
          const config = input && typeof input === "object" ? input : {};
          const orderedKinds = [];
          if (config.hasBasePanel !== false) {
            orderedKinds.push("base");
          }
          if (config.hasAiPanel === true) {
            orderedKinds.push("ai");
          }
          if (config.hasShortcutPanel === true) {
            orderedKinds.push("shortcut");
          }
          const primary = [];
          const secondary = [];
          if (orderedKinds[0]) {
            primary.push(orderedKinds[0]);
          }
          if (orderedKinds[1]) {
            secondary.push(orderedKinds[1]);
          }
          if (orderedKinds[2]) {
            primary.push(orderedKinds[2]);
          }
          return {
            primary,
            secondary,
            panelCount: orderedKinds.length,
            isSingle: orderedKinds.length <= 1,
          };
        };
  const adminSessionStorageKey = "asc-options-admin-session";
  const adminTabs = ["overview", "backend", "exports"];
  const adminDashboardAutoRefreshIntervalMs = 60000;
  const dateTextPattern = /^\d{4}-\d{2}-\d{2}$/;
  const dataBakerPageSizeOptions = (
    Array.isArray(constants.DATABAKER_PAGE_SIZE_OPTIONS)
      ? constants.DATABAKER_PAGE_SIZE_OPTIONS
      : ["5条/页", "10条/页", "20条/页", "50条/页", "100条/页"]
  ).map(function (item) {
    return String(item || "").replace(/\s+/g, "");
  });
  const dataBakerShortcutActions = constants.DATABAKER_ROUND_ONE_SHORTCUT_ACTIONS || [
    { key: "aiRecommendCurrentItem", label: "AI 推荐文本" },
    { key: "copyAiHeardText", label: "复制 AI 听音文本" },
    { key: "copyRecommendedText", label: "复制 AI 推荐文本" },
    { key: "fillRecommendedText", label: "填入推荐文本" },
    { key: "ignoreAiResult", label: "忽略 AI 推荐结果" },
    { key: "sentenceQualified", label: "句子判定：合格" },
    { key: "sentenceUnqualified", label: "句子判定：不合格" },
    { key: "taskPass", label: "任务判定：通过" },
    { key: "taskPartialReject", label: "任务判定：部分驳回" },
    { key: "taskFullReject", label: "任务判定：全部驳回" },
  ];
  const aishellTechMinnanShortcutActions = constants.AISHELL_TECH_MINNAN_SHORTCUT_ACTIONS || [
    { key: "aiRecommendCurrentItem", label: "AI 推荐当前条" },
    { key: "autoFillQualifiedItem", label: "批量识别并保存" },
    { key: "copyAiHeardText", label: "复制 AI 听音文本" },
    { key: "copyRecommendedText", label: "复制 AI 推荐文本" },
    { key: "fillRecommendedText", label: "填入并保存当前条" },
    { key: "ignoreAiResult", label: "忽略 AI 结果" },
  ];
  const aishellTechVietnameseShortcutActions =
    constants.AISHELL_TECH_VIETNAMESE_SHORTCUT_ACTIONS || [
      { key: "aiRecommendCurrentItem", label: "AI 识别当前条" },
      { key: "autoFillQualifiedItem", label: "批量识别并保存" },
      { key: "copyRecommendedText", label: "复制识别文本" },
      { key: "fillRecommendedText", label: "填入并保存当前条" },
      { key: "ignoreAiResult", label: "忽略 AI 结果" },
    ];
  const aishellTechThaiShortcutActions =
    constants.AISHELL_TECH_THAI_SHORTCUT_ACTIONS || [
      { key: "aiRecommendCurrentItem", label: "AI 识别当前条" },
      { key: "autoFillQualifiedItem", label: "批量识别并保存" },
      { key: "copyRecommendedText", label: "复制识别文本" },
      { key: "fillRecommendedText", label: "填入并保存当前条" },
      { key: "ignoreAiResult", label: "忽略 AI 结果" },
    ];
  const aishellTechCnEnShortDramaShortcutActions =
    constants.AISHELL_TECH_CN_EN_SHORT_DRAMA_SHORTCUT_ACTIONS || [];
  const dataBakerCvpcShortcutActions = [
    { key: "valid", label: "当前段设为 Valid" },
    { key: "invalid", label: "当前段设为 Invalid" },
    { key: "fillAllValid", label: "当前音频内未填写段落补为 Valid" },
    { key: "preview", label: "生成当前音频画段建议" },
    { key: "applyPreview", label: "应用当前画段建议（实验）" },
    { key: "recommend", label: "生成当前段 AI 推荐" },
    { key: "applyDialectText", label: "填入标注文本" },
    { key: "applyMandarinText", label: "填入普通话顺滑" },
    { key: "applyRecommend", label: "填入当前段 AI 推荐" },
    { key: "labelSpk", label: "<SPK/>" },
    { key: "labelNps", label: "<NPS/>" },
    { key: "labelUm", label: "#um" },
    { key: "labelHmm", label: "#hmm" },
    { key: "labelAh", label: "#ah" },
    { key: "labelEh", label: "#eh" },
    { key: "labelUnintelligible", label: "<Unintelligible>" },
    { key: "labelMeaningless", label: "<Meaningless>" },
    { key: "labelSilence", label: "<Silence>" },
  ];
  const bytedanceAidpShortcutActions =
    constants.BYTEDANCE_AIDP_SUZHOU_SHORTCUT_ACTIONS || [
      { key: "togglePlayPause", label: "播放/暂停切换" },
      { key: "playSelection", label: "区间播放" },
      { key: "jumpToFirstFrame", label: "回到首帧" },
      { key: "deleteCurrentSelection", label: "删除当前选区" },
      { key: "clearSegments", label: "清空画段" },
      { key: "previewSegments", label: "生成分段建议" },
      { key: "applyPreviewSegments", label: "应用分段建议" },
    ];
  const dataBakerListenModelOptions = Array.isArray(constants.DATABAKER_AI_LISTEN_MODEL_OPTIONS)
    ? constants.DATABAKER_AI_LISTEN_MODEL_OPTIONS
    : [
        { value: "fun-asr", label: "fun-asr" },
        { value: "qwen3.5-omni-plus", label: "qwen3.5-omni-plus" },
        { value: "qwen3.5-omni-flash", label: "qwen3.5-omni-flash" },
        { value: "qwen3.5-omni-flash-2026-03-15", label: "qwen3.5-omni-flash-2026-03-15" },
        { value: "qwen3-omni-flash", label: "qwen3-omni-flash" },
        { value: "qwen3-omni-flash-2025-12-01", label: "qwen3-omni-flash-2025-12-01" },
        { value: "qwen3-omni-flash-2025-09-15", label: "qwen3-omni-flash-2025-09-15" },
      ];
  const dataBakerCvpcListenModelOptions = Array.isArray(
    constants.DATA_BAKER_CVPC_AI_LISTEN_MODEL_OPTIONS
  )
    ? constants.DATA_BAKER_CVPC_AI_LISTEN_MODEL_OPTIONS
    : [
        { value: "qwen3.5-omni-plus", label: "qwen3.5-omni-plus" },
        { value: "qwen3.5-omni-flash", label: "qwen3.5-omni-flash" },
      ];
  const dataBakerSingleModelOptions = Array.isArray(constants.DATABAKER_AI_SINGLE_MODEL_OPTIONS)
    ? constants.DATABAKER_AI_SINGLE_MODEL_OPTIONS
    : [
        { value: "qwen3.5-omni-plus", label: "qwen3.5-omni-plus" },
        { value: "qwen3.5-omni-flash", label: "qwen3.5-omni-flash" },
        { value: "qwen3.5-omni-flash-2026-03-15", label: "qwen3.5-omni-flash-2026-03-15" },
        { value: "qwen3-omni-flash", label: "qwen3-omni-flash" },
        { value: "qwen3-omni-flash-2025-12-01", label: "qwen3-omni-flash-2025-12-01" },
        { value: "qwen3-omni-flash-2025-09-15", label: "qwen3-omni-flash-2025-09-15" },
      ];
  const dataBakerCompareModelOptions = Array.isArray(constants.DATABAKER_AI_COMPARE_MODEL_OPTIONS)
    ? constants.DATABAKER_AI_COMPARE_MODEL_OPTIONS
    : [
        { value: "qwen3.6-plus", label: "qwen3.6-plus" },
        { value: "qwen3.5-plus", label: "qwen3.5-plus" },
        { value: "qwen3.6-flash", label: "qwen3.6-flash" },
        { value: "qwen3.5-flash", label: "qwen3.5-flash" },
      ];
  const bytedanceAidpJinhuaModelModeOptions = Array.isArray(
    constants.BYTEDANCE_AIDP_JINHUA_MODEL_MODE_OPTIONS
  )
    ? constants.BYTEDANCE_AIDP_JINHUA_MODEL_MODE_OPTIONS
    : [
        { value: "two_stage", label: "普通模式：听音模型 + 收口模型" },
        { value: "expert_omni_plus", label: "专家模式：qwen3.5-omni-plus" },
      ];
  const bytedanceAidpJinhuaRefineModelOptions = dataBakerCompareModelOptions
    .concat([{ value: "qwen3.5-omni-plus", label: "qwen3.5-omni-plus" }])
    .filter(function (item, index, source) {
      const value = getDataBakerModelText(item && typeof item === "object" ? item.value : item);
      return (
        value &&
        source.findIndex(function (candidate) {
          return (
            getDataBakerModelText(
              candidate && typeof candidate === "object" ? candidate.value : candidate
            ) === value
          );
        }) === index
      );
    });
  const dataBakerDefaultListenPrompt = [
    "你只负责听音转写，不负责生成最终推荐文本。",
    "页面候选文本、朗读要求和有效时间只用于辅助你更稳定地识别音频内容。",
    "输出 JSON 字段必须包含 heardText、confidence、needHumanReview。",
    "heardText 的普通中文统一输出简体。",
    "只输出 JSON，不要输出 Markdown 或解释文字。",
  ].join("\n");
  const dataBakerDefaultComparePrompt = [
    "听音阶段已经完成音频转写；你现在只负责比较 heardText 与页面候选文本，输出最终推荐文本。",
    "以实际发声为主，不因词表存在就无依据改写。",
    "recommendedText 的普通中文统一使用简体；pageText/heardText 中的普通繁体字应转换为简体。",
    "但命中闽南业务词表 JSON 的建议用字必须保持不变，不参与普通简繁转换。",
    "输出 JSON 字段：recommendedText、decision、changePoints、confidence、needHumanReview。",
    "只输出 JSON，不输出额外解释。",
  ].join("\n");
  const aishellTechVietnameseDefaultSinglePrompt = [
    "你正在处理越南语音频转写。",
    "请同时输出越南语文本和语速建议。",
    "只输出 JSON，不要输出 Markdown、解释、前缀或引号。",
    'JSON 固定字段：{"text":"...","speed":"slow|normal|fast"}。',
    'speed 只能返回 "slow"、"normal"、"fast" 三个值之一。',
    "保留越南语重音字符和正常单词空格。",
    "按越南语书写习惯处理标点与空格：去掉标点前多余空格，标点后保持单个空格。",
    "不要翻译成中文，不要改写成其他语言，不要补充词表写法。",
    "如果句末缺少终止标点，请补英文句号。",
  ].join("\n");
  const aishellTechThaiDefaultSinglePrompt = [
    "你正在处理泰语音频转写。",
    "请同时输出泰语文本和语速建议。",
    "只输出 JSON，不要输出 Markdown、解释、前缀或引号。",
    'JSON 固定字段：{"text":"...","speed":"slow|normal|fast"}。',
    'speed 只能返回 "slow"、"normal"、"fast" 三个值之一。',
    "text 保留泰语字符，不翻译成中文，不改写成其他语言。",
    "按当前项目泰语规则收口标点与空格，统一使用半角英文标点。",
  ].join("\n");
  const magicDataHelperModelModeOptions = Array.isArray(
    constants.MAGIC_DATA_HELPER_MODEL_MODE_OPTIONS
  )
    ? constants.MAGIC_DATA_HELPER_MODEL_MODE_OPTIONS
    : [
        { value: "two_stage", label: "双模型：听音模型 + 比较/转换模型" },
        { value: "omni_single", label: "单模型：Omni 单模型" },
      ];
  const magicDataHelperRecognitionStrategyOptions = Array.isArray(
    constants.MAGIC_DATA_HELPER_RECOGNITION_STRATEGY_OPTIONS
  )
    ? constants.MAGIC_DATA_HELPER_RECOGNITION_STRATEGY_OPTIONS
    : [
        { value: "direct_dialect", label: "直接识别方言文本" },
        { value: "mandarin_to_dialect", label: "识别转换：先听成普通话，再按字词表转方言" },
      ];
  const aishellTechRecognitionStrategyOptions = Array.isArray(
    constants.AISHELL_TECH_RECOGNITION_STRATEGY_OPTIONS
  )
    ? constants.AISHELL_TECH_RECOGNITION_STRATEGY_OPTIONS
    : [{ value: "audio_first_reference", label: "三文本对照（音频优先，文本参考）" }];
  const aishellTechCompareFamilyOptions = [
    { value: "qwen", label: "Qwen 文本比较" },
    { value: "omni", label: "Omni 听音比较" },
  ];
  const aishellTechStageParamDefinitions = [
    {
      suffix: "Temperature",
      apiKey: "temperature",
      domSuffix: "temperature",
      type: "number",
      min: 0,
      max: 2,
      precision: 3,
    },
    {
      suffix: "TopP",
      apiKey: "top_p",
      domSuffix: "top-p",
      type: "number",
      min: 0,
      max: 1,
      precision: 3,
    },
    {
      suffix: "MaxTokens",
      apiKey: "max_tokens",
      domSuffix: "max-tokens",
      type: "integer",
      min: 1,
      max: 8192,
    },
    {
      suffix: "MaxCompletionTokens",
      apiKey: "max_completion_tokens",
      domSuffix: "max-completion-tokens",
      type: "integer",
      min: 1,
      max: 8192,
    },
    {
      suffix: "PresencePenalty",
      apiKey: "presence_penalty",
      domSuffix: "presence-penalty",
      type: "number",
      min: -2,
      max: 2,
      precision: 3,
    },
    {
      suffix: "FrequencyPenalty",
      apiKey: "frequency_penalty",
      domSuffix: "frequency-penalty",
      type: "number",
      min: -2,
      max: 2,
      precision: 3,
    },
    {
      suffix: "Seed",
      apiKey: "seed",
      domSuffix: "seed",
      type: "integer",
      min: 0,
      max: 2147483647,
    },
    { suffix: "StopSequences", apiKey: "stop", domSuffix: "stop-sequences", type: "stop" },
  ];
  const judgementAiListenModels = Array.isArray(constants.JUDGEMENT_AI_LISTEN_MODELS)
    ? constants.JUDGEMENT_AI_LISTEN_MODELS
    : ["qwen3.5-omni-flash", "qwen3-omni-flash", "qwen3.5-omni-plus"];
  const judgementAiCompareModels = Array.isArray(constants.JUDGEMENT_AI_COMPARE_MODELS)
    ? constants.JUDGEMENT_AI_COMPARE_MODELS
    : ["qwen3.5-plus", "qwen-plus", "qwen-turbo"];
  const judgementAiAdvancedDefinitions = Array.isArray(
    constants.JUDGEMENT_AI_ADVANCED_PARAM_DEFINITIONS
  )
    ? constants.JUDGEMENT_AI_ADVANCED_PARAM_DEFINITIONS
    : [];
  const judgementAiSupportedParams = judgementAiAdvancedDefinitions.reduce(function (result, item) {
    const apiKey = String(item?.apiKey || "").trim();
    if (!apiKey) {
      return result;
    }
    result[apiKey] = item?.supported !== false;
    return result;
  }, {});
  const judgementShortcutActions = constants.JUDGEMENT_SHORTCUT_ACTIONS || [
    { key: "choiceFirstBetter", label: "选择：第一个更好" },
    { key: "choiceSecondBetter", label: "选择：第二个更好" },
    { key: "choiceBothBad", label: "选择：都不好" },
    { key: "choiceUnsure", label: "选择：不确定或差不多" },
    { key: "choiceOtherDialect", label: "选择：其他方言或语种" },
    { key: "volumeUp", label: "增大音量" },
    { key: "volumeDown", label: "减小音量" },
    { key: "volumeReset", label: "重置音量" },
    { key: "rateUp", label: "提高倍速" },
    { key: "rateDown", label: "降低倍速" },
    { key: "rateReset", label: "重置倍速" },
    { key: "seekBackward", label: "后退当前音频" },
    { key: "seekForward", label: "前进当前音频" },
    { key: "playPause", label: "播放/暂停当前音频" },
    { key: "aiSuggestCurrentItem", label: "AI 分析当前题" },
    { key: "applyAiSuggestion", label: "AI：采用建议" },
    { key: "retryAiSuggestion", label: "AI：重新分析" },
    { key: "ignoreAiSuggestion", label: "AI：忽略建议" },
    { key: "copyAsrTextPair", label: "复制两条 ASR 文本" },
    { key: "submitTask", label: "提交任务" },
    { key: "submitTaskAndFinish", label: "提交任务并结束" },
  ];
  const transcriptionShortcutActions = [
    { key: "shortcutPlayPause", label: "播放 / 暂停" },
    { key: "shortcutValid", label: "当前题标有效" },
    { key: "shortcutInvalid", label: "当前题标无效" },
    { key: "shortcutFill", label: "当前题快速填入" },
    { key: "shortcutRemoveSpaces", label: "当前题去空格" },
    { key: "shortcutConvertNum", label: "当前题数字转换" },
    { key: "shortcutToggleFocus", label: "焦点切换" },
    { key: "shortcutBackward", label: "当前音频后退" },
    { key: "shortcutForward", label: "当前音频前进" },
    { key: "shortcutSpeedDown", label: "降低倍速" },
    { key: "shortcutSpeedUp", label: "提高倍速" },
    { key: "shortcutResetSpeed", label: "重置倍速" },
    { key: "shortcutVolDown", label: "降低音量" },
    { key: "shortcutVolUp", label: "提高音量" },
    { key: "shortcutResetVol", label: "重置音量" },
    { key: "shortcutCopyDuration", label: "复制当前音频时长" },
    { key: "shortcutUploadStats", label: "上传转写统计" },
    { key: "shortcutSubmitTask", label: "提交任务" },
    { key: "shortcutSubmitTaskAndFinish", label: "提交任务并结束" },
    { key: "shortcutAiSuggest", label: "AI 推荐当前题" },
    { key: "shortcutApplyAiSuggestion", label: "填入 AI 推荐" },
  ];
  const magicDataDefaultSettings = {
    enabled: true,
    aiReviewEnabled: true,
    listenModel: "qwen3.5-omni-flash",
    reviewModel: "qwen3.5-flash",
    reviewMode: "rule_first",
    showHeardText: true,
    showEstimatedIncome: true,
    enableThinking: false,
    shortcuts: {},
  };
  const magicDataListenModelOptions = [
    "qwen3.5-omni-flash",
    "qwen3.5-omni",
    "qwen-omni-turbo",
    "qwen-audio-turbo",
  ];
  const magicDataReviewModelOptions = [
    "qwen3.5-plus",
    "qwen-plus",
    "qwen-max",
    "qwen-turbo",
    "qwen-long",
  ];
  const DEFAULT_AI_REQUEST_TIMEOUT_MS = 60000;
  const LEGACY_DEFAULT_AI_REQUEST_TIMEOUT_MS = 60 * 1000;
  const normalizeAiUsageOperatorName =
    typeof aiUsageMeta.normalizeAiUsageOperatorName === "function"
      ? aiUsageMeta.normalizeAiUsageOperatorName
      : function (value) {
          return String(value === undefined || value === null ? "" : value)
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 40);
        };
  const magicDataShortcutActions = [
    { key: "reviewCurrent", label: "AI 质检当前条" },
    { key: "fillAllAiSuggestions", label: "全部填入AI推荐" },
    { key: "toggleAutoRun", label: "开启/关闭全自动" },
    { key: "copySummary", label: "复制 AI 质检摘要" },
    { key: "showRawAiOutput", label: "显示 AI 原始输出" },
    { key: "toggleSpeakerDetail", label: "展开/收起说话人属性详情" },
    { key: "toggleDialectDetail", label: "展开/收起方言内容详情" },
    { key: "toggleMandarinDetail", label: "展开/收起普通话文本详情" },
    { key: "refreshCollection", label: "刷新采集" },
    { key: "resetPanelHeight", label: "重置高度" },
    { key: "save", label: "保存" },
    { key: "submit", label: "提交" },
    { key: "genderMale", label: "性别男" },
    { key: "genderFemale", label: "性别女" },
    { key: "age0To5", label: "年龄0-5" },
    { key: "age6To12", label: "年龄6-12" },
    { key: "age13To18", label: "年龄13-18" },
    { key: "age19To25", label: "年龄19-25" },
    { key: "age26To36", label: "年龄26-36" },
    { key: "age37To50", label: "年龄37-50" },
    { key: "age51To65", label: "年龄51-65" },
    { key: "age65Plus", label: "年龄65以上" },
  ];
  const abakaAiTask21ShortcutActions = Array.isArray(constants.ABAKA_AI_TASK21_SHORTCUT_ACTIONS)
    ? constants.ABAKA_AI_TASK21_SHORTCUT_ACTIONS
    : [
        { key: "sameFontTrue", label: "same_font：true" },
        { key: "sameFontFalse", label: "same_font：false" },
        {
          key: "sameFontArtisticEffect",
          label: "same_font：same underlying font+artistic effect",
        },
        { key: "imageBTextsRemovedSpecify", label: "image_b_texts_removed：specify" },
        { key: "otherChangesSpecify", label: "other_changes：specify" },
        { key: "stashSave", label: "暂存" },
        { key: "submitReview", label: "送审" },
        { key: "aiAnalyzeSameFont", label: "AI 分析 same_font" },
        { key: "aiAnalyzeImageBTextsRemoved", label: "AI 分析 image_b_texts_removed" },
        { key: "aiAnalyzeOtherChanges", label: "AI 分析 other_changes" },
        { key: "aiAnalyzeOverall", label: "AI 整体分析" },
      ];
  const abakaAiTask21AnalysisModes = Array.isArray(constants.ABAKA_AI_TASK21_AI_ANALYSIS_MODES)
    ? constants.ABAKA_AI_TASK21_AI_ANALYSIS_MODES
    : [
        { value: "two_stage", label: "双模型方案（默认）" },
        { value: "single_model", label: "单模型方案" },
      ];
  const abakaAiTask21VisionModelOptions = Array.isArray(
    constants.ABAKA_AI_TASK21_VISION_MODEL_OPTIONS
  )
    ? constants.ABAKA_AI_TASK21_VISION_MODEL_OPTIONS
    : [{ value: "qwen3.6-plus", label: "qwen3.6-plus", supportsVision: true, supportsThinking: true }];
  const abakaAiTask21OcrModelOptions = Array.isArray(constants.ABAKA_AI_TASK21_OCR_MODEL_OPTIONS)
    ? constants.ABAKA_AI_TASK21_OCR_MODEL_OPTIONS
    : [];
  const abakaAiTask21ReasoningModelOptions = Array.isArray(
    constants.ABAKA_AI_TASK21_REASONING_MODEL_OPTIONS
  )
    ? constants.ABAKA_AI_TASK21_REASONING_MODEL_OPTIONS
    : [{ value: "qwen3.6-plus", label: "qwen3.6-plus", supportsVision: true, supportsThinking: true }];
  const abakaAiTask21SingleModelOptions = Array.isArray(
    constants.ABAKA_AI_TASK21_SINGLE_MODEL_OPTIONS
  )
    ? constants.ABAKA_AI_TASK21_SINGLE_MODEL_OPTIONS
    : [{ value: "qwen3.6-plus", label: "qwen3.6-plus", supportsVision: true, supportsThinking: true }];
  const judgementItemsPerPageOptions = [
    { value: "1 条/页", label: "1 条/页" },
    { value: "2 条/页", label: "2 条/页" },
    { value: "3 条/页", label: "3 条/页" },
    { value: "4 条/页", label: "4 条/页" },
    { value: "5 条/页", label: "5 条/页" },
    { value: "10 条/页", label: "10 条/页" },
    { value: "20 条/页", label: "20 条/页" },
    { value: "30 条/页", label: "30 条/页" },
    { value: "40 条/页", label: "40 条/页" },
    { value: "50 条/页", label: "50 条/页" },
    { value: "400 条/页", label: "400 条/页" },
  ];
  const mouseButtonLabels = {
    0: "MouseLeft",
    1: "MouseMiddle",
    2: "MouseRight",
    3: "MouseBack",
    4: "MouseForward",
  };
  let currentSettings = null;
  let transcriptionShortcutsDraft = {};
  let transcriptionRecordingKey = null;
  let stopTranscriptionRecordingListeners = null;
  let judgementShortcutsDraft = {};
  let judgementRecordingKey = null;
  let stopJudgementRecordingListeners = null;
  let dataBakerShortcutsDraft = {};
  let dataBakerRecordingKey = null;
  let stopDataBakerRecordingListeners = null;
  let dataBakerCvpcShortcutsDraft = {};
  let dataBakerCvpcRecordingKey = null;
  let stopDataBakerCvpcRecordingListeners = null;
  let bytedanceAidpShortcutsDraft = {};
  let bytedanceAidpRecordingKey = null;
  let stopBytedanceAidpRecordingListeners = null;
  let aishellTechShortcutsDraft = {};
  let aishellTechRecordingKey = null;
  let stopAishellTechRecordingListeners = null;
  let magicDataShortcutsDraft = {};
  let magicDataRecordingKey = null;
  let stopMagicDataRecordingListeners = null;
  let abakaAiShortcutsDraft = {};
  let abakaAiRecordingKey = null;
  let stopAbakaAiRecordingListeners = null;
  let abakaAiAdvancedRevealCount = 0;
  let abakaAiAdvancedUnlocked = false;
  let abakaAiAdvancedLastClickAt = 0;
  let endpointAdvancedUnlocked = false;
  let judgementAiAdvancedRevealCount = 0;
  let judgementAiAdvancedUnlocked = false;
  let judgementAiAdvancedLastClickAt = 0;
  const asrVoiceAiRevealStates = {};
  const asrVoiceAiDefaultsCache = {};
  const asrVoiceAiDefaultsLoading = {};
  const asrVoiceAiDefaultsPaths = {
    judgement: "/api/alibaba-labelx/asr-judgement/ai/defaults",
    transcription: "/api/alibaba-labelx/asr-transcription/ai/defaults",
    dataBakerRoundOneQuality: "/api/data-baker/round-one-quality/ai/recommend/defaults",
    dataBakerCvpcLiuzhouAssistant: "/api/data-baker-cvpc/liuzhou-helper/ai/recommend/defaults",
    bytedanceAidpSuzhouHelper: "/api/bytedance-aidp/suzhou-helper/ai/recommend/defaults",
    bytedanceAidpJinhuaHelper: "/api/bytedance-aidp/jinhua-helper/ai/recommend/defaults",
    magicDataAnnotatorAiReview: "/api/magic-data/hakka-helper/ai/defaults",
    magicDataMinnanAssistant: "/api/magic-data/minnan-helper/ai/defaults",
    magicDataHangzhouAssistant: "/api/magic-data/hangzhou-helper/ai/defaults",
    aishellTechMinnanAssistant: "/api/aishell-tech/minnan-helper/ai/recommend/defaults",
    aishellTechVietnameseAssistant: "/api/aishell-tech/vietnamese-helper/ai/recommend/defaults",
    aishellTechThaiAssistant: "/api/aishell-tech/thai-helper/ai/recommend/defaults",
    aishellTechCantoneseAssistant: "/api/aishell-tech/cantonese-helper/ai/recommend/defaults",
    jdTtsShanghaineseAssistant: "/api/jd-tts-annotation/shanghainese-helper/ai/recommend/defaults",
  };
  const asrVoiceAiHealthPaths = {
    jdTtsShanghaineseAssistant: "/api/jd-tts-annotation/shanghainese-helper/ai/recommend/health",
  };
  let projectDataDownloadDatasets = [];
  let aiCallLogDownloadDatasets = [];
  let adminSessionState = null;
  let adminAuthMessage = "";
  let adminDashboardCache = null;
  let adminDashboardLoading = null;
  let adminDashboardAutoRefreshTimer = null;
  let adminDownloadCenterReleasesCache = null;
  let adminDownloadCenterReleasesLoading = null;
  let adminSelectedReleaseVersion = "";
  let adminBackendDraft = null;
  let publicCenterEditMode = false;
  let publicCenterDragState = null;
  let betaUnlockTapCount = 0;
  let betaUnlockTapTimer = null;
  let topToastHideTimer = null;
  const PLATFORM_REORDER_HOVER_DELAY_MS = 200;
  const PLATFORM_REORDER_EDGE_SCROLL_MARGIN = 92;
  const PLATFORM_REORDER_EDGE_SCROLL_STEP = 22;

  function getElement(id) {
    return document.getElementById(id);
  }

  function getExtensionManifestVersion() {
    try {
      return normalizeText(globalThis.chrome?.runtime?.getManifest?.().version || "");
    } catch (_error) {
      return "";
    }
  }

  function isBetaBuild() {
    return releaseChannel === "beta";
  }

  function getVisibleScriptIds(settings) {
    return Object.keys(scriptLibrary).filter(function (scriptId) {
      return isScriptVisibleByRelease(scriptId, settings || {});
    });
  }

  function getVisiblePlatformIds(settings) {
    return getOrderedPlatformIds(settings).filter(function (platformId) {
      return isPlatformVisibleByRelease(platformId, settings || {});
    });
  }

  function getVisiblePlatformScriptIds(settings, platformId) {
    return getVisibleScriptIds(settings).filter(function (scriptId) {
      return scriptLibrary[scriptId]?.platformId === platformId;
    });
  }

  function setBetaStatus(message, tone) {
    const node = getElement("workspace-beta-status");
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const text = normalizeText(message);
    node.className = "status-text hidden";
    node.textContent = "";
    node.setAttribute("aria-hidden", "true");
    if (!text || !tone) {
      return;
    }
  }

  function resetBetaUnlockTapSequence() {
    betaUnlockTapCount = 0;
    if (betaUnlockTapTimer) {
      clearTimeout(betaUnlockTapTimer);
      betaUnlockTapTimer = null;
    }
  }

  async function sha256Hex(value) {
    const text = String(value || "");
    if (!text || !globalThis.crypto?.subtle || typeof TextEncoder !== "function") {
      return "";
    }
    const buffer = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer))
      .map(function (item) {
        return item.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function reloadOptionsPage() {
    if (globalThis.location && typeof globalThis.location.reload === "function") {
      globalThis.location.reload();
    }
  }

  async function handleBetaUnlockAttempt() {
    if (!isBetaBuild()) {
      return;
    }
    if (!defaultBetaUnlockPasswordSha256) {
      if (typeof globalThis.alert === "function") {
        globalThis.alert("当前 beta 包未配置口令，无法解锁。");
      }
      return;
    }
    const password = globalThis.prompt("请输入 beta 口令");
    if (!normalizeText(password)) {
      return;
    }
    const hashed = await sha256Hex(password);
    if (hashed !== defaultBetaUnlockPasswordSha256) {
      if (typeof globalThis.alert === "function") {
        globalThis.alert("beta 口令错误。");
      }
      return;
    }
    currentSettings = await storage.patchSettings({
      meta: {
        betaUnlocked: true,
        betaUnlockedAt: new Date().toISOString(),
      },
    });
    reloadOptionsPage();
  }

  async function exitBetaMode() {
    if (!storage || typeof storage.patchSettings !== "function") {
      return;
    }
    const nextMeta = {
      betaUnlocked: false,
      betaUnlockedAt: null,
    };
    if (getBackendModeFromSettings(currentSettings || {}) === backendModeBeta) {
      nextMeta.backendEndpointMode = backendModeServer;
    }
    currentSettings = await storage.patchSettings({
      meta: nextMeta,
    });
    reloadOptionsPage();
  }

  function registerBetaUnlockTap() {
    if (!isBetaBuild() || canUseBetaFeatures(currentSettings || {})) {
      return;
    }
    betaUnlockTapCount += 1;
    if (betaUnlockTapTimer) {
      clearTimeout(betaUnlockTapTimer);
    }
    betaUnlockTapTimer = setTimeout(function () {
      resetBetaUnlockTapSequence();
    }, 3000);
    if (betaUnlockTapCount >= 7) {
      resetBetaUnlockTapSequence();
      void handleBetaUnlockAttempt();
    }
  }

  function renderWorkspaceSidebar(settings, route) {
    const activeRoute = route && typeof route === "object" ? route : getCurrentRouteState();
    const version = getExtensionManifestVersion() || "未知版本";
    const visibleScriptIds = getVisibleScriptIds(settings);
    const visiblePlatformIds = getVisiblePlatformIds(settings);
    const enabledCount = visibleScriptIds.filter(function (scriptId) {
      return isScriptEnabled(settings || {}, scriptId);
    }).length;
    const platformCount = visiblePlatformIds.length;
    const scriptCount = visibleScriptIds.length;
    const backendMode = getBackendModeFromSettings(settings || {});
    const routeNameNode = getElement("workspace-view-name");
    const routeNoteNode = getElement("workspace-view-note");
    const versionNode = getElement("workspace-version");
    const versionCompactNode = getElement("workspace-version-compact");
    const backendModeNode = getElement("workspace-backend-mode");
    const aiUsageOperatorNode = getElement("workspace-ai-usage-operator");
    const aiUsageOperatorInput = getElement("workspace-ai-usage-operator-input");
    const enabledNode = getElement("workspace-enabled-count");
    const libraryNode = getElement("workspace-library-count");
    const navCenterButton = getElement("workspace-nav-center");
    const navDownloadsButton = getElement("workspace-nav-downloads");
    const navAdminButton = getElement("workspace-nav-admin");
    const betaExitButton = getElement("workspace-beta-exit");
    const detailScriptId = activeRoute.view === "script" ? activeRoute.scriptId : "";
    const detailScript = detailScriptId ? scriptLibrary[detailScriptId] || {} : null;
    const betaUnlocked = canUseBetaFeatures(settings || {});

    if (versionNode) {
      versionNode.textContent = "浏览器扩展 v" + version;
    }
    if (versionCompactNode) {
      versionCompactNode.textContent = "v" + version;
    }
    if (backendModeNode) {
      backendModeNode.textContent = getBackendModeLabel(backendMode);
    }
    if (aiUsageOperatorNode) {
      const operatorName = getAiUsageOperatorName(settings || {});
      aiUsageOperatorNode.textContent = operatorName || "未设置";
    }
    if (aiUsageOperatorInput instanceof HTMLInputElement) {
      aiUsageOperatorInput.value = getAiUsageOperatorName(settings || {});
    }
    if (enabledNode) {
      enabledNode.textContent = formatNumber(enabledCount);
    }
    if (libraryNode) {
      libraryNode.textContent = formatNumber(platformCount) + " / " + formatNumber(scriptCount);
    }
    if (navCenterButton instanceof HTMLButtonElement) {
      const active = activeRoute.view === "center" || activeRoute.view === "script";
      navCenterButton.classList.toggle("active", active);
      navCenterButton.setAttribute("aria-pressed", String(active));
    }
    if (navDownloadsButton instanceof HTMLButtonElement) {
      const active = activeRoute.view === "downloads";
      navDownloadsButton.classList.toggle("active", active);
      navDownloadsButton.setAttribute("aria-pressed", String(active));
    }
    if (navAdminButton instanceof HTMLButtonElement) {
      const active = activeRoute.view === "admin";
      navAdminButton.classList.toggle("active", active);
      navAdminButton.setAttribute("aria-pressed", String(active));
    }
    if (betaExitButton instanceof HTMLButtonElement) {
      betaExitButton.classList.toggle(
        "hidden",
        !betaUnlocked || betaFeaturesVisibleByDefault
      );
    }
    setBetaStatus("");

    if (routeNameNode && routeNoteNode) {
      if (activeRoute.view === "admin") {
        routeNameNode.textContent = "系统管理";
        routeNoteNode.textContent = "统一处理后端设置、数据导出、模型池状态与系统仪表盘。";
      } else if (activeRoute.view === "downloads") {
        routeNameNode.textContent = "脚本下载中心";
        routeNoteNode.textContent = "公开提供扩展版本下载，默认突出最新版，并支持切换历史版本。";
      } else if (detailScript) {
        routeNameNode.textContent = String(detailScript.label || detailScriptId || "脚本详情");
        routeNoteNode.textContent = "当前正在编辑脚本专属设置，公共后端地址与数据导出能力仍统一走系统管理。";
      } else {
        routeNameNode.textContent = "功能面板";
        routeNoteNode.textContent = "默认展示平台与脚本状态，只保留启停和详情入口。";
      }
    }
  }

  function createAdminBackendDraft(settings) {
    const backendBaseUrls = getBackendBaseUrlsFromSettings(settings || {});
    return {
      backendEndpointMode: getBackendModeFromSettings(settings || {}),
      backendConfigExpanded: false,
      backendBaseUrls: {
        server: normalizeBackendBaseUrl(backendBaseUrls.server, defaultBackendBaseUrls.server),
        local: normalizeBackendBaseUrl(backendBaseUrls.local, defaultBackendBaseUrls.local),
        beta: normalizeBackendBaseUrl(backendBaseUrls.beta, defaultBackendBaseUrls.beta),
      },
      aiUsageOperatorName: getAiUsageOperatorName(settings || {}),
    };
  }

  function ensureAdminBackendDraft(settings) {
    if (!adminBackendDraft) {
      adminBackendDraft = createAdminBackendDraft(settings);
      return adminBackendDraft;
    }
    return adminBackendDraft;
  }

  function resetAdminBackendDraft(settings) {
    adminBackendDraft = createAdminBackendDraft(settings);
    return adminBackendDraft;
  }

  function getAdminBackendDraft() {
    return ensureAdminBackendDraft(currentSettings || {});
  }

  function isAdminBackendDraftDirty(settings) {
    const saved = createAdminBackendDraft(settings || currentSettings || {});
    const draft = getAdminBackendDraft();
    return (
      draft.backendEndpointMode !== saved.backendEndpointMode ||
      normalizeBackendBaseUrl(
        draft.backendBaseUrls?.server,
        defaultBackendBaseUrls.server
      ) !== normalizeBackendBaseUrl(saved.backendBaseUrls?.server, defaultBackendBaseUrls.server) ||
      normalizeBackendBaseUrl(
        draft.backendBaseUrls?.local,
        defaultBackendBaseUrls.local
      ) !== normalizeBackendBaseUrl(saved.backendBaseUrls?.local, defaultBackendBaseUrls.local) ||
      normalizeBackendBaseUrl(
        draft.backendBaseUrls?.beta,
        defaultBackendBaseUrls.beta
      ) !== normalizeBackendBaseUrl(saved.backendBaseUrls?.beta, defaultBackendBaseUrls.beta) ||
      normalizeAiUsageOperatorName(draft.aiUsageOperatorName) !==
        normalizeAiUsageOperatorName(saved.aiUsageOperatorName)
    );
  }

  function getBackendModeLabel(mode) {
    const normalizedMode = String(mode || "").trim().toLowerCase();
    if (normalizedMode === backendModeLocal) {
      return "local";
    }
    if (normalizedMode === backendModeBeta) {
      return "beta";
    }
    return "server";
  }

  function getBackendBaseUrlsForDisplay(source) {
    if (source && typeof source === "object" && source.backendBaseUrls) {
      return {
        server: normalizeBackendBaseUrl(
          source.backendBaseUrls.server,
          defaultBackendBaseUrls.server
        ),
        local: normalizeBackendBaseUrl(
          source.backendBaseUrls.local,
          defaultBackendBaseUrls.local
        ),
        beta: normalizeBackendBaseUrl(
          source.backendBaseUrls.beta,
          defaultBackendBaseUrls.beta
        ),
      };
    }
    return getBackendBaseUrlsFromSettings(source || currentSettings || {});
  }

  function buildBackendModeDisplayText(mode, source) {
    const normalizedMode = String(mode || "").trim().toLowerCase();
    const backendBaseUrls = getBackendBaseUrlsForDisplay(source);
    const label = getBackendModeLabel(normalizedMode);
    const rootUrl =
      normalizedMode === backendModeLocal
        ? backendBaseUrls.local
        : normalizedMode === backendModeBeta
          ? backendBaseUrls.beta
          : backendBaseUrls.server;
    return rootUrl ? label + "（" + rootUrl + "）" : label + "（未配置根地址）";
  }

  function applyForcedThinkingToggle(inputId, message) {
    const input = getElement(inputId);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const normalizedMessage =
      typeof message === "string" && message.trim()
        ? message.trim()
        : "thinking 已全局固定关闭，以避免 Omni 思考模式拖慢请求。";
    input.checked = false;
    input.disabled = true;
    input.title = normalizedMessage;
    input.setAttribute("aria-disabled", "true");
    const preserveSwitchText = input.getAttribute("data-preserve-switch-text") === "true";

    const labelTextNode =
      input.parentElement?.querySelector(".switch-text") ||
      input.parentElement?.querySelector("span");
    if (!preserveSwitchText && labelTextNode) {
      labelTextNode.textContent = normalizedMessage;
    }
  }

  function openExternalUrl(url) {
    const targetUrl = normalizeText(url);
    if (!targetUrl) {
      return;
    }
    if (globalThis.chrome?.tabs && typeof globalThis.chrome.tabs.create === "function") {
      globalThis.chrome.tabs.create({ url: targetUrl });
      return;
    }

    globalThis.open(targetUrl, "_blank", "noopener");
  }

  function openScriptDownloadCenter() {
    navigateToDownloads();
  }

  function getCurrentDownloadCenterUrl(settings) {
    return buildDownloadUrl("/", settings || currentSettings || {});
  }

  function openExternalScriptDownloadCenter() {
    openExternalUrl(getCurrentDownloadCenterUrl(currentSettings || {}));
  }

  function buildPlatformDisplayHost(platform) {
    return normalizeText(buildPlatformEntryDescriptor(platform).displayHost);
  }

  function buildPlatformRootUrl(platform) {
    return normalizeText(buildPlatformEntryDescriptor(platform).entryUrl);
  }

  function getSavedPlatformOrder(settings) {
    const rawOrder = settings?.meta?.publicCenterPlatformOrder;
    return Array.isArray(rawOrder)
      ? rawOrder
          .map(function (platformId) {
            return normalizeText(platformId);
          })
          .filter(Boolean)
      : [];
  }

  function getOrderedPlatformIds(settings) {
    return buildOrderedPlatformIds(Object.keys(platformLibrary), getSavedPlatformOrder(settings));
  }

  function buildScriptRemarkText(script) {
    const note = normalizeText(script?.note);
    const description = normalizeText(script?.description);
    if (note && description && description !== note) {
      return note + "；" + description;
    }
    return note || description || "当前脚本暂未补充备注。";
  }

  function buildScriptRemarkMarkup(script) {
    return [
      '<div class="script-remark-panel">',
      '<div class="script-remark-block">',
      '<span class="script-remark-label">项目备注</span>',
      '<p class="script-remark-copy">' + escapeHtml(buildScriptRemarkText(script)) + "</p>",
      "</div>",
      "</div>",
    ].join("");
  }

  function setPublicCenterEditStatus(message, tone) {
    const statusNode = getElement("public-center-edit-status");
    if (!(statusNode instanceof HTMLElement)) {
      return;
    }
    statusNode.className = "status-text public-center-edit-status" + (tone ? " " + tone : "");
    statusNode.textContent = normalizeText(message);
  }

  function getPlatformSectionNodes(root) {
    if (!(root instanceof HTMLElement)) {
      return [];
    }
    return Array.from(root.querySelectorAll(".platform-section.platform-module[data-platform-id]"));
  }

  function clearPlatformDropIndicators(root) {
    getPlatformSectionNodes(root).forEach(function (section) {
      section.classList.remove("is-drop-before", "is-drop-after", "is-dragging", "is-drop-active");
    });
  }

  function getCurrentRenderedPlatformOrder(root) {
    return getPlatformSectionNodes(root)
      .map(function (section) {
        return normalizeText(section.getAttribute("data-platform-id"));
      })
      .filter(Boolean);
  }

  function buildPlatformOrderAfterDrop(platformIds, movingId, targetId, position) {
    const source = Array.isArray(platformIds) ? platformIds.slice() : [];
    const normalizedMovingId = normalizeText(movingId);
    const normalizedTargetId = normalizeText(targetId);
    if (!normalizedMovingId || !normalizedTargetId || normalizedMovingId === normalizedTargetId) {
      return source;
    }

    const filtered = source.filter(function (platformId) {
      return platformId !== normalizedMovingId;
    });
    let insertionIndex = filtered.indexOf(normalizedTargetId);
    if (insertionIndex < 0) {
      return source;
    }
    if (position === "after") {
      insertionIndex += 1;
    }
    filtered.splice(Math.max(0, Math.min(filtered.length, insertionIndex)), 0, normalizedMovingId);
    return filtered;
  }

  function animatePlatformWorkbenchFlip(workbench, mutate) {
    if (!(workbench instanceof HTMLElement) || typeof mutate !== "function") {
      return;
    }
    const reducedMotion = Boolean(
      globalThis.matchMedia &&
        globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    const beforeRects = new Map();
    getPlatformSectionNodes(workbench).forEach(function (section) {
      beforeRects.set(section.getAttribute("data-platform-id"), section.getBoundingClientRect());
    });

    mutate();

    if (reducedMotion) {
      return;
    }

    getPlatformSectionNodes(workbench).forEach(function (section) {
      const platformId = section.getAttribute("data-platform-id");
      const before = beforeRects.get(platformId);
      if (!before) {
        return;
      }
      const after = section.getBoundingClientRect();
      const deltaX = before.left - after.left;
      const deltaY = before.top - after.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }
      section.style.transition = "none";
      section.style.transform = "translate(" + deltaX + "px, " + deltaY + "px)";
      void section.offsetWidth;
      section.style.transition = "transform 280ms cubic-bezier(0.2, 0.82, 0.2, 1)";
      section.style.transform = "";
      const cleanup = function () {
        section.style.transition = "";
        section.removeEventListener("transitionend", cleanup);
      };
      section.addEventListener("transitionend", cleanup);
    });
  }

  function isReducedMotionPreferred() {
    return Boolean(
      globalThis.matchMedia &&
        globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function buildPlatformDragPlaceholder(section) {
    const rect = section.getBoundingClientRect();
    const placeholder = document.createElement("div");
    placeholder.className = "platform-workbench-placeholder";
    placeholder.style.height = Math.max(120, Math.round(rect.height)) + "px";
    return placeholder;
  }

  function createPlatformDragGhost(section, rect) {
    section.classList.add("platform-drag-ghost");
    section.style.width = Math.round(rect.width) + "px";
    section.style.height = Math.round(rect.height) + "px";
    section.style.left = Math.round(rect.left) + "px";
    section.style.top = Math.round(rect.top) + "px";
    section.style.position = "fixed";
    section.style.margin = "0";
    section.style.zIndex = "1200";
    section.style.pointerEvents = "none";
    section.style.boxSizing = "border-box";
    document.body.appendChild(section);
    return section;
  }

  function resetPlatformDragGhost(section) {
    if (!(section instanceof HTMLElement)) {
      return;
    }
    section.classList.remove("platform-drag-ghost");
    section.style.width = "";
    section.style.height = "";
    section.style.left = "";
    section.style.top = "";
    section.style.position = "";
    section.style.margin = "";
    section.style.zIndex = "";
    section.style.pointerEvents = "";
    section.style.boxSizing = "";
    section.style.transition = "";
    section.style.transform = "";
  }

  function updatePlatformDragGhostPosition(state, clientX, clientY) {
    if (!state?.ghost) {
      return;
    }
    state.ghost.style.left = Math.round(clientX - state.offsetX) + "px";
    state.ghost.style.top = Math.round(clientY - state.offsetY) + "px";
  }

  function getPlatformReorderCandidate(workbench, movingId, clientY) {
    const sections = getPlatformSectionNodes(workbench).filter(function (section) {
      return normalizeText(section.getAttribute("data-platform-id")) !== normalizeText(movingId);
    });
    if (!sections.length) {
      return null;
    }

    const entries = sections.map(function (section) {
      return {
        section,
        rect: section.getBoundingClientRect(),
      };
    });

    let entry =
      entries.find(function (item) {
        return clientY >= item.rect.top && clientY <= item.rect.bottom;
      }) || null;

    if (!entry) {
      if (clientY < entries[0].rect.top) {
        entry = entries[0];
      } else {
        entry = entries[entries.length - 1];
      }
    }

    const position = clientY < entry.rect.top + entry.rect.height / 2 ? "before" : "after";
    return {
      target: entry.section,
      targetId: normalizeText(entry.section.getAttribute("data-platform-id")),
      position,
    };
  }

  function movePlatformPlaceholder(workbench, placeholder, target, position) {
    if (!(workbench instanceof HTMLElement) || !(placeholder instanceof HTMLElement) || !(target instanceof HTMLElement)) {
      return;
    }
    const desiredParent = target.parentElement;
    if (!(desiredParent instanceof HTMLElement)) {
      return;
    }
    const currentPrevious = placeholder.previousElementSibling;
    const currentNext = placeholder.nextElementSibling;
    if (
      (position === "before" && currentNext === target) ||
      (position === "after" && currentPrevious === target)
    ) {
      return;
    }
    animatePlatformWorkbenchFlip(workbench, function () {
      if (position === "before") {
        desiredParent.insertBefore(placeholder, target);
        return;
      }
      desiredParent.insertBefore(placeholder, target.nextSibling);
    });
  }

  function clearPlatformHoverTimer() {
    if (publicCenterDragState?.hoverTimer) {
      globalThis.clearTimeout(publicCenterDragState.hoverTimer);
      publicCenterDragState.hoverTimer = null;
    }
  }

  function updatePlatformHoverIndicator(workbench, target, position) {
    clearPlatformDropIndicators(workbench);
    if (!(target instanceof HTMLElement)) {
      return;
    }
    target.classList.add(position === "before" ? "is-drop-before" : "is-drop-after", "is-drop-active");
  }

  function maybeAutoScrollPlatformWorkbench(clientY) {
    const viewportHeight = Number(globalThis.innerHeight || 0);
    if (!viewportHeight) {
      return;
    }
    if (clientY <= PLATFORM_REORDER_EDGE_SCROLL_MARGIN) {
      globalThis.scrollBy(0, -PLATFORM_REORDER_EDGE_SCROLL_STEP);
      return;
    }
    if (clientY >= viewportHeight - PLATFORM_REORDER_EDGE_SCROLL_MARGIN) {
      globalThis.scrollBy(0, PLATFORM_REORDER_EDGE_SCROLL_STEP);
    }
  }

  function cleanupPlatformDragState(options) {
    const config = options && typeof options === "object" ? options : {};
    const state = publicCenterDragState;
    if (!state) {
      return;
    }

    clearPlatformHoverTimer();
    clearPlatformDropIndicators(state.workbench);
    if (state.workbench instanceof HTMLElement) {
      state.workbench.classList.remove("is-sorting");
    }
    if (state.ghost instanceof HTMLElement) {
      if (state.ghost === state.sourceSection) {
        resetPlatformDragGhost(state.ghost);
      } else if (state.ghost.parentNode) {
        state.ghost.parentNode.removeChild(state.ghost);
      }
    }
    if (state.placeholder instanceof HTMLElement && state.placeholder.parentNode && config.keepPlaceholder !== true) {
      state.placeholder.parentNode.removeChild(state.placeholder);
    }
    document.body.classList.remove("is-platform-reordering");
    window.removeEventListener("pointermove", state.onPointerMove);
    window.removeEventListener("pointerup", state.onPointerUp);
    window.removeEventListener("pointercancel", state.onPointerUp);
    window.removeEventListener("keydown", state.onKeyDown);
    publicCenterDragState = null;
  }

  function bindPlatformReorderInteractions(center, settings) {
    const workbench = center.querySelector(".platform-workbench");
    if (!(workbench instanceof HTMLElement)) {
      return;
    }
    const toggleButton = getElement("public-center-edit-toggle");
    if (toggleButton instanceof HTMLButtonElement) {
      toggleButton.addEventListener("click", function () {
        if (publicCenterDragState) {
          cleanupPlatformDragState();
        }
        publicCenterEditMode = !publicCenterEditMode;
        renderScriptCenter(currentSettings || settings || {});
      });
    }

    if (!publicCenterEditMode) {
      setPublicCenterEditStatus("点击“编辑顺序”后可拖动平台区块上下重排。", "");
      return;
    }

    setPublicCenterEditStatus("按住平台区块拖动；在目标区域停留片刻后，平台会自动让位并保存顺序。", "");

    Array.from(center.querySelectorAll(".platform-section.platform-module")).forEach(function (section) {
      section.addEventListener("pointerdown", function (event) {
        if (!publicCenterEditMode || event.button !== 0) {
          return;
        }
        const platformId = normalizeText(section.getAttribute("data-platform-id"));
        if (!(section instanceof HTMLElement) || !platformId) {
          return;
        }

        event.preventDefault();
        cleanupPlatformDragState();

        const rect = section.getBoundingClientRect();
        const placeholder = buildPlatformDragPlaceholder(section);
        const sourceIndex = getPlatformSectionNodes(workbench).indexOf(section);
        section.replaceWith(placeholder);
        const ghost = createPlatformDragGhost(section, rect);
        workbench.classList.add("is-sorting");
        document.body.classList.add("is-platform-reordering");

        const dragState = {
          platformId,
          workbench,
          sourceSection: section,
          placeholder,
          ghost,
          sourceIndex,
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
          hoverTargetId: "",
          hoverPosition: "",
          hoverTimer: null,
          isFinalizing: false,
          onPointerMove: null,
          onPointerUp: null,
          onKeyDown: null,
        };

        const handleHoverCandidate = function (clientY) {
          const candidate = getPlatformReorderCandidate(workbench, platformId, clientY);
          if (!candidate) {
            dragState.hoverTargetId = "";
            dragState.hoverPosition = "";
            clearPlatformHoverTimer();
            clearPlatformDropIndicators(workbench);
            return;
          }

          updatePlatformHoverIndicator(workbench, candidate.target, candidate.position);
          if (
            dragState.hoverTargetId === candidate.targetId &&
            dragState.hoverPosition === candidate.position
          ) {
            return;
          }

          dragState.hoverTargetId = candidate.targetId;
          dragState.hoverPosition = candidate.position;
          clearPlatformHoverTimer();
          dragState.hoverTimer = globalThis.setTimeout(function () {
            movePlatformPlaceholder(workbench, placeholder, candidate.target, candidate.position);
            updatePlatformHoverIndicator(workbench, candidate.target, candidate.position);
          }, PLATFORM_REORDER_HOVER_DELAY_MS);
        };

        const finalizeDrag = function (cancelled) {
          if (dragState.isFinalizing) {
            return;
          }
          dragState.isFinalizing = true;
          clearPlatformHoverTimer();
          clearPlatformDropIndicators(workbench);
          const finish = function () {
            if (cancelled && placeholder.parentNode) {
              const siblingSections = getPlatformSectionNodes(workbench).filter(function (item) {
                return item !== placeholder;
              });
              const restoreBefore = siblingSections[Math.max(0, dragState.sourceIndex)] || null;
              if (restoreBefore instanceof HTMLElement) {
                placeholder.parentNode.insertBefore(placeholder, restoreBefore);
              } else {
                placeholder.parentNode.appendChild(placeholder);
              }
            }
            placeholder.replaceWith(section);
            cleanupPlatformDragState({ keepPlaceholder: true });
            if (cancelled) {
              setPublicCenterEditStatus("已取消平台重排。", "");
              return;
            }
            const nextOrder = getCurrentRenderedPlatformOrder(workbench);
            if (nextOrder.length) {
              void persistPublicCenterPlatformOrder(nextOrder);
            }
          };

          if (!(ghost instanceof HTMLElement) || isReducedMotionPreferred()) {
            finish();
            return;
          }

          const targetRect = placeholder.getBoundingClientRect();
          ghost.style.transition = "left 180ms cubic-bezier(0.2, 0.82, 0.2, 1), top 180ms cubic-bezier(0.2, 0.82, 0.2, 1), transform 180ms cubic-bezier(0.2, 0.82, 0.2, 1), opacity 180ms ease";
          ghost.style.left = Math.round(targetRect.left) + "px";
          ghost.style.top = Math.round(targetRect.top) + "px";
          ghost.style.transform = "scale(0.98)";
          let completed = false;
          const done = function () {
            if (completed) {
              return;
            }
            completed = true;
            ghost.removeEventListener("transitionend", done);
            finish();
          };
          ghost.addEventListener("transitionend", done);
          globalThis.setTimeout(done, 220);
        };

        dragState.onPointerMove = function (moveEvent) {
          updatePlatformDragGhostPosition(dragState, moveEvent.clientX, moveEvent.clientY);
          maybeAutoScrollPlatformWorkbench(moveEvent.clientY);
          handleHoverCandidate(moveEvent.clientY);
        };
        dragState.onPointerUp = function () {
          finalizeDrag(false);
        };
        dragState.onKeyDown = function (keyEvent) {
          if (keyEvent.key === "Escape") {
            finalizeDrag(true);
          }
        };

        publicCenterDragState = dragState;
        updatePlatformDragGhostPosition(dragState, event.clientX, event.clientY);
        handleHoverCandidate(event.clientY);
        window.addEventListener("pointermove", dragState.onPointerMove);
        window.addEventListener("pointerup", dragState.onPointerUp, { once: true });
        window.addEventListener("pointercancel", dragState.onPointerUp, { once: true });
        window.addEventListener("keydown", dragState.onKeyDown);
      });
    });
  }

  async function persistPublicCenterPlatformOrder(nextOrder) {
    if (!storage || typeof storage.patchSettings !== "function") {
      setPublicCenterEditStatus("当前扩展版本不支持保存平台顺序。", "warning");
      return false;
    }
    try {
      currentSettings = await storage.patchSettings({
        meta: {
          publicCenterPlatformOrder: nextOrder,
        },
      });
      renderWorkspaceSidebar(currentSettings || {}, getCurrentRouteState());
      setPublicCenterEditStatus("平台顺序已保存到本地缓存。", "success");
      return true;
    } catch (error) {
      setPublicCenterEditStatus(
        "平台顺序保存失败：" + (error && error.message ? error.message : String(error)),
        "error"
      );
      return false;
    }
  }


  function getSearchParams() {
    return new URLSearchParams(location.search || "");
  }

  function getCurrentRouteState() {
    return parseOptionsRoute(location.search || "", scriptLibrary);
  }

  function getCurrentDetailScriptId() {
    const route = getCurrentRouteState();
    return route.view === "script" ? route.scriptId : null;
  }

  function getCurrentAdminTab() {
    const route = getCurrentRouteState();
    return route.view === "admin" ? route.adminTab : "overview";
  }

  function getPreferredPlatformScript(platformScriptIds, settings) {
    const candidates = Array.isArray(platformScriptIds) ? platformScriptIds : [];
    const activeScriptId = candidates.find(function (scriptId) {
      return isScriptEnabled(settings || {}, scriptId);
    });
    const targetScriptId = activeScriptId || candidates[0] || "";
    const script = targetScriptId ? scriptLibrary[targetScriptId] || {} : null;
    return {
      scriptId: targetScriptId,
      label: script ? String(script.shortLabel || script.label || targetScriptId) : "未设置",
      isActive: Boolean(activeScriptId),
    };
  }

  function navigateToRoute(route) {
    history.replaceState({}, "", buildOptionsRouteHref(location.href, route));
    renderCurrentView();
  }

  function navigateToCenter() {
    navigateToRoute({
      view: "center",
    });
  }

  function navigateToDownloads() {
    navigateToRoute({
      view: "downloads",
    });
  }

  function navigateToScript(scriptId) {
    navigateToRoute(
      scriptId
        ? {
            view: "script",
            scriptId: scriptId,
          }
        : {
            view: "center",
          }
    );
  }

  function navigateToAdmin(tab) {
    navigateToRoute({
      view: "admin",
      adminTab: adminTabs.indexOf(String(tab || "").trim()) >= 0 ? String(tab).trim() : "overview",
    });
  }

  function showError(message) {
    const node = getElement("options-error");
    node.textContent = String(message || "脚本中心加载失败。");
    node.classList.remove("hidden");
  }

  function hideError() {
    getElement("options-error").classList.add("hidden");
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clampNumber(value, fallback, min, max, precision) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    const clamped = Math.max(min, Math.min(max, numericValue));
    return typeof precision === "number" ? Number(clamped.toFixed(precision)) : clamped;
  }

  function normalizeJudgementItemsPerPage(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    if (
      text === "all" ||
      text === "全部" ||
      text === "全部/400条" ||
      text === "全部（400 条）" ||
      text === "全部（400条）" ||
      text === "400 条/页" ||
      text === "400条/页"
    ) {
      return "400 条/页";
    }

    if (
      text === "100 条/页" ||
      text === "100条/页" ||
      text === "150 条/页" ||
      text === "150条/页" ||
      text === "200 条/页" ||
      text === "200条/页"
    ) {
      return "50 条/页";
    }

    const validValues = judgementItemsPerPageOptions.map(function (option) {
      return option.value;
    });
    if (validValues.indexOf(text) >= 0) {
      return text;
    }

    return validValues.indexOf(fallback) >= 0 ? fallback : "50 条/页";
  }

  function normalizeHexColor(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    if (/^#[0-9a-fA-F]{6}$/.test(text)) {
      return text.toLowerCase();
    }

    return fallback;
  }

  function normalizeJudgementDiffColors(value, defaults) {
    const colorDefaults = defaults || {
      changeBackground: "#fef3c7",
      gapBackground: "#fee2e2",
      punctuationBackground: "#ede9fe",
    };
    const source = value && typeof value === "object" ? value : {};
    return {
      changeBackground: normalizeHexColor(
        source.changeBackground,
        colorDefaults.changeBackground || "#fef3c7"
      ),
      gapBackground: normalizeHexColor(
        source.gapBackground,
        colorDefaults.gapBackground || "#fee2e2"
      ),
      punctuationBackground: normalizeHexColor(
        source.punctuationBackground,
        colorDefaults.punctuationBackground || "#ede9fe"
      ),
    };
  }

  function normalizeTimeList(value, fallback) {
    const source = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[,，\n]/)
        : Array.isArray(fallback)
          ? fallback
          : [];
    const result = [];

    source.forEach(function (item) {
      const text = String(item || "").trim();
      const match = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (!match) {
        return;
      }

      const normalized = String(Number(match[1])).padStart(2, "0") + ":" + match[2];
      if (result.indexOf(normalized) < 0) {
        result.push(normalized);
      }
    });

    return result.length > 0 ? result : ["10:00", "16:00"];
  }

  function inferBackendModeFromEndpoint(endpointText, fallbackMode) {
    const text = String(endpointText || "").trim().toLowerCase();
    if (text.indexOf("127.0.0.1") >= 0 || text.indexOf("localhost") >= 0) {
      return backendModeLocal;
    }
    if (text.indexOf("http://") === 0 || text.indexOf("https://") === 0) {
      return backendModeServer;
    }
    return fallbackMode === backendModeLocal ? backendModeLocal : backendModeServer;
  }

  function normalizeJudgementAiModelText(value, fallback) {
    const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
    if (!text) {
      return String(fallback || "").trim();
    }
    return text.slice(0, 80);
  }

  function normalizeJudgementAiAvailableModels(value, fallback) {
    const source = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];
    const result = [];
    source.forEach(function (item) {
      const model = normalizeJudgementAiModelText(item, "");
      if (!model || result.indexOf(model) >= 0) {
        return;
      }
      result.push(model);
    });
    return result;
  }

  function isJudgementPresetModel(modelName, presetList) {
    return Array.isArray(presetList) &&
      presetList.some(function (item) {
        if (typeof item === "string") {
          return item === modelName;
        }
        const value = String(item?.value || "").trim();
        return value === modelName;
      });
  }

  function formatJudgementAiModelLabel(model, role) {
    if (role === "listen" && model === "qwen3.5-omni-flash") {
      return "qwen3.5-omni-flash（默认）";
    }
    if (role === "compare" && model === "qwen3.5-plus") {
      return "qwen3.5-plus（默认）";
    }
    return model;
  }

  function renderJudgementAiModelOptions(selectId, models, selectedModel, role) {
    const selectNode = getElement(selectId);
    if (!(selectNode instanceof HTMLSelectElement)) {
      return;
    }
    selectNode.innerHTML = (Array.isArray(models) ? models : [])
      .map(function (item) {
        const model = typeof item === "string" ? item : String(item?.value || "").trim();
        const label =
          typeof item === "string"
            ? formatJudgementAiModelLabel(model, role)
            : String(item?.label || formatJudgementAiModelLabel(model, role));
        if (!model) {
          return "";
        }
        return (
          '<option value="' +
          escapeHtml(model) +
          '">' +
          escapeHtml(label) +
          "</option>"
        );
      })
      .filter(Boolean)
      .join("") +
      '<option value="custom">自定义</option>';

    const normalizedModel = normalizeJudgementAiModelText(selectedModel, "");
    selectNode.value = isJudgementPresetModel(normalizedModel, models)
      ? normalizedModel
      : "custom";
    syncOptionsCustomSelectState(selectNode);
  }

  function applyJudgementModelField(selectId, customInputId, modelName, presetList, role) {
    const selectNode = getElement(selectId);
    const customNode = getElement(customInputId);
    if (!(selectNode instanceof HTMLSelectElement) || !(customNode instanceof HTMLInputElement)) {
      return;
    }
    const normalizedModel = normalizeJudgementAiModelText(modelName, "");
    renderJudgementAiModelOptions(selectId, presetList, normalizedModel, role);
    const useCustom = !normalizedModel || !isJudgementPresetModel(normalizedModel, presetList);
    selectNode.value = useCustom ? "custom" : normalizedModel;
    syncOptionsCustomSelectState(selectNode);
    customNode.value = useCustom ? normalizedModel : "";
    customNode.classList.toggle("hidden", !useCustom);
  }

  function readJudgementModelField(selectId, customInputId, fallback, presetList) {
    const selectNode = getElement(selectId);
    const customNode = getElement(customInputId);
    if (!(selectNode instanceof HTMLSelectElement) || !(customNode instanceof HTMLInputElement)) {
      return normalizeJudgementAiModelText(fallback, fallback);
    }
    if (selectNode.value === "custom") {
      return normalizeJudgementAiModelText(customNode.value, fallback);
    }
    if (isJudgementPresetModel(selectNode.value, presetList)) {
      return normalizeJudgementAiModelText(selectNode.value, fallback);
    }
    return normalizeJudgementAiModelText(fallback, fallback);
  }

  function syncOptionsCustomSelects(scope) {
    if (typeof sharedSelect.syncCustomSelects === "function") {
      return sharedSelect.syncCustomSelects(scope);
    }
    return scope;
  }

  function syncOptionsCustomSelectState(selectNode) {
    if (typeof sharedSelect.syncCustomSelectState === "function") {
      sharedSelect.syncCustomSelectState(selectNode);
    }
  }

  function closeOptionsCustomSelects(exceptNode) {
    if (typeof sharedSelect.closeAllCustomSelects === "function") {
      sharedSelect.closeAllCustomSelects(exceptNode);
    }
  }

  function renderDetailCustomSelectOptions(selectId, options, selectedValue, config) {
    const selectNode = getElement(selectId);
    if (!(selectNode instanceof HTMLSelectElement)) {
      return;
    }
    const placeholder = normalizeText(config?.placeholder || "");
    if (placeholder) {
      selectNode.setAttribute("data-options-placeholder", placeholder);
    } else {
      selectNode.removeAttribute("data-options-placeholder");
    }
    renderFixedModelOptions(selectId, options, selectedValue);
  }

  function renderFixedModelOptions(selectId, models, selectedModel) {
    const selectNode = getElement(selectId);
    if (!(selectNode instanceof HTMLSelectElement)) {
      return;
    }
    const options = (Array.isArray(models) ? models : [])
      .map(function (item) {
        const model = typeof item === "string" ? String(item || "").trim() : String(item?.value || "").trim();
        const label =
          typeof item === "string" ? model : String(item?.label || item?.value || "").trim();
        if (!model) {
          return "";
        }
        return '<option value="' + escapeHtml(model) + '">' + escapeHtml(label || model) + "</option>";
      })
      .filter(Boolean);
    selectNode.innerHTML = options.join("");
    const normalizedSelected = getDataBakerModelText(selectedModel);
    const allowedValues = (Array.isArray(models) ? models : [])
      .map(function (item) {
        return typeof item === "string" ? String(item || "").trim() : String(item?.value || "").trim();
      })
      .filter(Boolean);
    if (allowedValues.indexOf(normalizedSelected) >= 0) {
      selectNode.value = normalizedSelected;
      syncOptionsCustomSelectState(selectNode);
      return;
    }
    selectNode.value = allowedValues[0] || "";
    syncOptionsCustomSelectState(selectNode);
  }

  function setFieldVisibility(elementId, visible) {
    const node = getElement(elementId);
    if (!(node instanceof HTMLElement)) {
      return;
    }
    node.classList.toggle("hidden", visible !== true);
  }

  function isDataBakerFunAsrListenModel(listenModel) {
    return getDataBakerModelText(listenModel) === "fun-asr";
  }

  function getDataBakerAiQualifiedAutofillConcurrencyRule(configLike) {
    const helper =
      typeof constants.getDataBakerAiQualifiedAutofillConcurrencyRule === "function"
        ? constants.getDataBakerAiQualifiedAutofillConcurrencyRule
        : null;
    if (helper) {
      return helper(configLike || {});
    }
    const source = configLike && typeof configLike === "object" ? configLike : {};
    const recognitionMode = normalizeDataBakerRecognitionMode(
      source.recognitionMode || source.aiRecommendPipelineMode || source.pipelineMode,
      "two_stage"
    );
    const listenModel = getDataBakerModelText(source.listenModel || source.aiRecommendListenModel);
    const singleModel = getDataBakerModelText(
      source.singleModel || source.aiRecommendSingleModel || source.aiModel
    );
    if (recognitionMode === "two_stage" && listenModel === "fun-asr") {
      return { min: 1, max: 50, defaultValue: 5, modelType: "fun_asr" };
    }
    if (recognitionMode === "omni_single" && singleModel) {
      return { min: 1, max: 25, defaultValue: 5, modelType: "omni" };
    }
    return { min: 1, max: 25, defaultValue: 5, modelType: "omni" };
  }

  function normalizeDataBakerAutofillConcurrency(value, configLike) {
    const helper =
      typeof constants.normalizeDataBakerAiQualifiedAutofillConcurrency === "function"
        ? constants.normalizeDataBakerAiQualifiedAutofillConcurrency
        : null;
    if (helper) {
      return helper(value, configLike || {});
    }
    const rule = getDataBakerAiQualifiedAutofillConcurrencyRule(configLike || {});
    const number = Number(value);
    const base = Number.isFinite(number) ? Math.round(number) : rule.defaultValue;
    return Math.max(rule.min, Math.min(rule.max, base));
  }

  function updateSharedAsrAutofillConcurrencyField(scriptId, configLike, options) {
    const spec = buildSharedAsrAiPanelSpec(scriptId);
    const inputNode = getElement(spec.concurrencyInputId);
    if (!(inputNode instanceof HTMLInputElement)) {
      return;
    }
    const config = configLike && typeof configLike === "object" ? configLike : {};
    const rule = getDataBakerAiQualifiedAutofillConcurrencyRule(config);
    const normalizedValue = normalizeDataBakerAutofillConcurrency(inputNode.value, config);
    const forceDefault = options?.forceDefault === true;

    inputNode.min = String(rule.min);
    inputNode.max = String(rule.max);
    inputNode.step = "1";
    inputNode.placeholder = String(rule.defaultValue);
    inputNode.value = String(
      forceDefault === true
        ? rule.defaultValue
        : normalizeDataBakerAutofillConcurrency(
            config.aiQualifiedAutofillConcurrency !== undefined
              ? config.aiQualifiedAutofillConcurrency
              : normalizedValue,
            config
          )
    );

    const helpNode = getElement(spec.concurrencyHelpId);
    if (helpNode instanceof HTMLElement) {
      helpNode.textContent = buildSharedAsrAutofillConcurrencyHelp(scriptId, rule);
    }
  }

  function updateDataBakerAutofillConcurrencyField(configLike, options) {
    updateSharedAsrAutofillConcurrencyField(
      dataBakerRoundOneQualityScriptId,
      configLike,
      options
    );
  }

  function normalizeDataBakerRecognitionMode(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "two_stage" || text === "omni_single") {
      return text;
    }
    if (text === "fun_asr_compare" || text === "qwen_omni_compare" || text === "qwen_omni_two_stage") {
      return "two_stage";
    }
    if (text === "listen_only") {
      return "omni_single";
    }
    return String(fallback || "two_stage").trim().toLowerCase() === "omni_single"
      ? "omni_single"
      : "two_stage";
  }

  function deriveDataBakerPipelineMode(recognitionMode, model) {
    if (normalizeDataBakerRecognitionMode(recognitionMode, "two_stage") === "omni_single") {
      return "omni_single";
    }
    return isDataBakerFunAsrListenModel(model) ? "fun_asr_compare" : "qwen_omni_compare";
  }

  function getDataBakerListenModelDefault(aiDefaults) {
    return normalizeDataBakerListenModel(
      aiDefaults?.listenModel,
      aiDefaults?.omniModel || "qwen3.5-omni-flash"
    );
  }

  function getDataBakerSingleModelDefault(aiDefaults) {
    return normalizeDataBakerSingleModel(
      aiDefaults?.singleModel || aiDefaults?.omniModel,
      "qwen3.5-omni-flash"
    );
  }

  function normalizeFixedModelOption(item) {
    if (item && typeof item === "object") {
      const value = normalizeJudgementAiModelText(
        item.value || item.id || item.name || item.label || "",
        ""
      );
      if (!value) {
        return null;
      }
      return {
        value: value,
        label: String(item.label || item.name || value).trim() || value,
      };
    }
    const value = normalizeJudgementAiModelText(item, "");
    if (!value) {
      return null;
    }
    return {
      value: value,
      label: value,
    };
  }

  function buildMergedModelOptions(primaryOptions, fallbackOptions, extraValues) {
    const merged = [];
    const seen = new Set();

    function appendOption(item) {
      const normalized = normalizeFixedModelOption(item);
      if (!normalized || seen.has(normalized.value)) {
        return;
      }
      seen.add(normalized.value);
      merged.push(normalized);
    }

    (Array.isArray(primaryOptions) ? primaryOptions : []).forEach(appendOption);
    (Array.isArray(fallbackOptions) ? fallbackOptions : []).forEach(appendOption);
    (Array.isArray(extraValues) ? extraValues : []).forEach(appendOption);
    return merged;
  }

  function buildDataBakerListenModelOptions(aiDefaults, config) {
    return buildMergedModelOptions(
      aiDefaults?.listenModelOptions,
      dataBakerListenModelOptions,
      [
        config?.aiRecommendListenModel,
        aiDefaults?.listenModel,
        aiDefaults?.funAsrModel,
        aiDefaults?.omniModel,
      ]
    );
  }

  function buildDataBakerCompareModelOptions(aiDefaults) {
    return buildMergedModelOptions(
      aiDefaults?.compareModelOptions,
      dataBakerCompareModelOptions,
      [aiDefaults?.compareModel]
    );
  }

  function buildDataBakerSingleModelOptions(aiDefaults, config) {
    return buildMergedModelOptions(
      aiDefaults?.singleModelOptions,
      dataBakerSingleModelOptions,
      [
        config?.aiRecommendSingleModel,
        aiDefaults?.singleModel,
        aiDefaults?.omniModel,
      ]
    );
  }

  function applyDataBakerListenModelFields(listenModel, config, aiDefaults) {
    const currentListenModel = normalizeDataBakerListenModel(
      listenModel || config?.aiRecommendListenModel,
      getDataBakerListenModelDefault(aiDefaults)
    );
    const currentCompareModel = normalizeDataBakerCompareModel(
      config?.aiRecommendCompareModel,
      String(aiDefaults?.compareModel || "qwen3.5-plus")
    );
    const listenLabelNode = getElement("data-baker-ai-listen-model-label");
    const listenHelpNode = getElement("data-baker-ai-listen-model-help");
    const compareSelectNode = getElement("data-baker-ai-compare-model-select");
    const listenSelectNode = getElement("data-baker-ai-listen-model-select");

    if (listenLabelNode) {
      listenLabelNode.textContent = "听音模型";
    }
    if (listenHelpNode) {
      listenHelpNode.textContent =
        "听音模型为 fun-asr 时通过统一后端 Fun-ASR provider 调用；默认是 REST，只有显式切换时才会走 Python fallback。听音模型为所选 Qwen Omni 模型时通过 Qwen Omni 音频输入调用。比较模型负责结合听音文本与页面文本生成推荐文本。";
    }
    renderFixedModelOptions(
      "data-baker-ai-listen-model-select",
      dataBakerListenModelOptions,
      currentListenModel
    );
    renderFixedModelOptions(
      "data-baker-ai-compare-model-select",
      dataBakerCompareModelOptions,
      currentCompareModel
    );
    if (listenSelectNode instanceof HTMLSelectElement) {
      listenSelectNode.disabled = false;
    }
    if (compareSelectNode instanceof HTMLSelectElement) {
      compareSelectNode.disabled = false;
    }
    setFieldVisibility("data-baker-ai-listen-model-field", true);
    setFieldVisibility("data-baker-ai-compare-model-field", true);
    setFieldVisibility("data-baker-ai-listen-model-custom-field", false);
    setFieldVisibility("data-baker-ai-compare-model-custom-field", false);
    setFieldVisibility("data-baker-ai-listen-model-note", isDataBakerFunAsrListenModel(currentListenModel));
  }

  function applyDataBakerSingleModelFields(singleModel, config, aiDefaults) {
    const currentSingleModel = normalizeDataBakerSingleModel(
      singleModel || config?.aiRecommendSingleModel,
      getDataBakerSingleModelDefault(aiDefaults)
    );
    renderFixedModelOptions(
      "data-baker-ai-single-model-select",
      dataBakerSingleModelOptions,
      currentSingleModel
    );
    setFieldVisibility("data-baker-ai-single-model-field", true);
    setFieldVisibility("data-baker-ai-listen-model-note", false);
    updateDataBakerAutofillConcurrencyField(
      Object.assign({}, config || {}, {
        aiRecommendPipelineMode: "omni_single",
        aiRecommendSingleModel: currentSingleModel,
      })
    );
  }

  function normalizeMagicDataMinnanRecognitionMode(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "two_stage" || text === "omni_single" || text === "recognition_convert") {
      return text;
    }
    if (
      text === "fun_asr_compare" ||
      text === "qwen_omni_compare" ||
      text === "qwen_omni_two_stage"
    ) {
      return "two_stage";
    }
    if (text === "listen_only") {
      return "omni_single";
    }
    const fallbackText = String(fallback || "").trim().toLowerCase();
    if (fallbackText === "omni_single" || fallbackText === "recognition_convert") {
      return fallbackText;
    }
    return "two_stage";
  }

  function normalizeMagicDataModelMode(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "two_stage" || text === "omni_single") {
      return text;
    }
    if (text === "recognition_convert") {
      return "two_stage";
    }
    const fallbackText = String(fallback || "").trim().toLowerCase();
    return fallbackText === "omni_single" ? "omni_single" : "two_stage";
  }

  function normalizeMagicDataRecognitionStrategy(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "direct_dialect") {
      return "direct_dialect";
    }
    if (text === "mandarin_to_dialect") {
      return "mandarin_to_dialect";
    }
    if (text === "recognition_convert") {
      return "mandarin_to_dialect";
    }
    const fallbackText = String(fallback || "").trim().toLowerCase();
    return fallbackText === "mandarin_to_dialect" ? "mandarin_to_dialect" : "direct_dialect";
  }

  function hasValidMagicDataRecognitionStrategy(value) {
    const text = String(value || "").trim().toLowerCase();
    return text === "direct_dialect" || text === "mandarin_to_dialect";
  }

  function normalizeAishellTechRecognitionStrategy(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "audio_first_reference") {
      return "audio_first_reference";
    }
    return "audio_first_reference";
  }

  function hasValidAishellTechRecognitionStrategy(value) {
    const text = String(value || "").trim().toLowerCase();
    return text === "audio_first_reference";
  }

  function normalizeAishellTechCompareFamily(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "omni") {
      return "omni";
    }
    if (text === "qwen") {
      return "qwen";
    }
    return String(fallback || "qwen").trim().toLowerCase() === "omni" ? "omni" : "qwen";
  }

  function isAishellTechTextModel(value) {
    const model = getDataBakerModelText(value);
    return Boolean(model) && model !== "fun-asr" && model.indexOf("omni") < 0;
  }

  function isAishellTechOmniModel(value) {
    return getDataBakerModelText(value).indexOf("omni") >= 0;
  }

  function buildAishellTechTextModelOptions(aiDefaults, extraValues) {
    return buildMergedModelOptions(
      aiDefaults?.stages?.convert?.modelOptions,
      aiDefaults?.compareModelOptions || dataBakerCompareModelOptions,
      extraValues
    ).filter(function (item) {
      return isAishellTechTextModel(item?.value || item);
    });
  }

  function buildAishellTechOmniModelOptions(aiDefaults, extraValues) {
    return buildMergedModelOptions(
      aiDefaults?.stages?.compare?.omniModelOptions || aiDefaults?.stages?.compare?.modelOptions,
      aiDefaults?.singleModelOptions || dataBakerSingleModelOptions,
      extraValues
    ).filter(function (item) {
      return isAishellTechOmniModel(item?.value || item);
    });
  }

  function getAishellTechStageDefaults(aiDefaults) {
    const defaults = aiDefaults && typeof aiDefaults === "object" ? aiDefaults : {};
    const stages = defaults.stages && typeof defaults.stages === "object" ? defaults.stages : {};
    const convert = stages.convert && typeof stages.convert === "object" ? stages.convert : {};
    const listen = stages.listen && typeof stages.listen === "object" ? stages.listen : {};
    const compare = stages.compare && typeof stages.compare === "object" ? stages.compare : {};
    const qwenModelOptions = buildAishellTechTextModelOptions(defaults, [
      convert.model,
      compare.model,
      defaults.candidateModel,
      defaults.compareModel,
      "qwen3.5-plus",
    ]);
    const omniModelOptions = buildAishellTechOmniModelOptions(defaults, [
      compare.model,
      defaults.singleModel,
      defaults.omniModel,
      "qwen3.5-omni-flash",
    ]);
    const listenModelOptions = buildMergedModelOptions(
      listen.modelOptions,
      defaults.listenModelOptions || dataBakerListenModelOptions,
      [listen.model, defaults.listenModel, defaults.funAsrModel, defaults.omniModel]
    );
    const compareFamily = normalizeAishellTechCompareFamily(
      compare.family || defaults.compareFamily,
      "qwen"
    );
    return {
      convert: {
        model: normalizeDataBakerCompareModel(
          convert.model || defaults.candidateModel || defaults.compareModel,
          "qwen3.5-plus"
        ),
        modelOptions: qwenModelOptions,
        prompt: String(convert.prompt || defaults.candidatePrompt || ""),
        temperature: convert.temperature ?? defaults.temperature ?? "",
        top_p: convert.top_p ?? defaults.top_p ?? "",
        max_tokens: convert.max_tokens ?? defaults.max_tokens ?? "",
        max_completion_tokens:
          convert.max_completion_tokens ?? defaults.max_completion_tokens ?? "",
        presence_penalty: convert.presence_penalty ?? defaults.presence_penalty ?? "",
        frequency_penalty: convert.frequency_penalty ?? defaults.frequency_penalty ?? "",
        seed: convert.seed ?? defaults.seed ?? "",
        stop: convert.stop ?? convert.stopSequences ?? defaults.stop ?? "",
      },
      listen: {
        model: normalizeDataBakerListenModel(
          listen.model || defaults.listenModel,
          defaults.omniModel || "qwen3.5-omni-flash"
        ),
        modelOptions: listenModelOptions,
        prompt: String(listen.prompt || defaults.listenPrompt || ""),
        temperature: listen.temperature ?? defaults.temperature ?? "",
        top_p: listen.top_p ?? defaults.top_p ?? "",
        max_tokens: listen.max_tokens ?? defaults.max_tokens ?? "",
        max_completion_tokens:
          listen.max_completion_tokens ?? defaults.max_completion_tokens ?? "",
        presence_penalty: listen.presence_penalty ?? defaults.presence_penalty ?? "",
        frequency_penalty: listen.frequency_penalty ?? defaults.frequency_penalty ?? "",
        seed: listen.seed ?? defaults.seed ?? "",
        stop: listen.stop ?? listen.stopSequences ?? defaults.stop ?? "",
      },
      compare: {
        family: compareFamily,
        qwenModel: normalizeDataBakerCompareModel(
          compareFamily === "qwen" ? compare.model || defaults.compareModel : defaults.compareModel,
          "qwen3.5-plus"
        ),
        omniModel: normalizeDataBakerSingleModel(
          compareFamily === "omni" ? compare.model || defaults.singleModel : defaults.singleModel,
          defaults.omniModel || "qwen3.5-omni-flash"
        ),
        qwenModelOptions: qwenModelOptions,
        omniModelOptions: omniModelOptions,
        qwenPrompt: String(compare.qwenPrompt || defaults.comparePrompt || ""),
        omniPrompt: String(compare.omniPrompt || ""),
        adoptionThreshold:
          normalizeOptionalNumberText(
            compare.adoptionThreshold ?? defaults.compareAdoptionThreshold ?? 0.75,
            0,
            1,
            3
          ) || "0.75",
        temperature: compare.temperature ?? defaults.temperature ?? "",
        top_p: compare.top_p ?? defaults.top_p ?? "",
        max_tokens: compare.max_tokens ?? defaults.max_tokens ?? "",
        max_completion_tokens:
          compare.max_completion_tokens ?? defaults.max_completion_tokens ?? "",
        presence_penalty: compare.presence_penalty ?? defaults.presence_penalty ?? "",
        frequency_penalty: compare.frequency_penalty ?? defaults.frequency_penalty ?? "",
        seed: compare.seed ?? defaults.seed ?? "",
        stop: compare.stop ?? compare.stopSequences ?? defaults.stop ?? "",
      },
    };
  }

  function normalizeAishellTechStageParamFields(config, prefix) {
    const target = config && typeof config === "object" ? config : {};
    target[prefix + "Temperature"] = normalizeOptionalNumberText(
      target[prefix + "Temperature"],
      0,
      2,
      3
    );
    target[prefix + "TopP"] = normalizeOptionalNumberText(target[prefix + "TopP"], 0, 1, 3);
    target[prefix + "MaxTokens"] = normalizeOptionalIntegerText(
      target[prefix + "MaxTokens"],
      1,
      8192
    );
    target[prefix + "MaxCompletionTokens"] = normalizeOptionalIntegerText(
      target[prefix + "MaxCompletionTokens"],
      1,
      8192
    );
    target[prefix + "PresencePenalty"] = normalizeOptionalNumberText(
      target[prefix + "PresencePenalty"],
      -2,
      2,
      3
    );
    target[prefix + "FrequencyPenalty"] = normalizeOptionalNumberText(
      target[prefix + "FrequencyPenalty"],
      -2,
      2,
      3
    );
    target[prefix + "Seed"] = normalizeOptionalIntegerText(
      target[prefix + "Seed"],
      0,
      2147483647
    );
    target[prefix + "StopSequences"] = normalizeStopSequencesText(target[prefix + "StopSequences"] || "");
  }

  function getDataBakerCvpcStageDefaults(aiDefaults) {
    const defaults = aiDefaults && typeof aiDefaults === "object" ? aiDefaults : {};
    const stages = defaults.stages && typeof defaults.stages === "object" ? defaults.stages : {};
    const listen = stages.listen && typeof stages.listen === "object" ? stages.listen : {};
    const refine = stages.refine && typeof stages.refine === "object" ? stages.refine : {};
    return {
      listen: {
        model: normalizeDataBakerCvpcListenModel(
          listen.model || defaults.listenModel,
          defaults.omniModel || "qwen3.5-omni-flash"
        ),
        modelOptions: buildMergedModelOptions(
          listen.modelOptions,
          defaults.listenModelOptions || dataBakerCvpcListenModelOptions,
          [listen.model, defaults.listenModel, defaults.omniModel]
        ),
        prompt: String(listen.prompt || defaults.listenPrompt || ""),
        includeLexiconReference: listen.includeLexiconReference === true,
        temperature: listen.temperature ?? defaults.temperature ?? "",
        top_p: listen.top_p ?? defaults.top_p ?? "",
        max_tokens: listen.max_tokens ?? defaults.max_tokens ?? "",
        max_completion_tokens:
          listen.max_completion_tokens ?? defaults.max_completion_tokens ?? "",
        presence_penalty: listen.presence_penalty ?? defaults.presence_penalty ?? "",
        frequency_penalty: listen.frequency_penalty ?? defaults.frequency_penalty ?? "",
        seed: listen.seed ?? defaults.seed ?? "",
        stop: listen.stop ?? listen.stopSequences ?? defaults.stop ?? "",
      },
      refine: {
        model: normalizeDataBakerCompareModel(
          refine.model || defaults.refineModel || defaults.compareModel,
          "qwen3.5-plus"
        ),
        modelOptions: buildMergedModelOptions(
          refine.modelOptions,
          defaults.refineModelOptions || defaults.compareModelOptions || dataBakerCompareModelOptions,
          [refine.model, defaults.refineModel, defaults.compareModel]
        ),
        prompt: String(refine.prompt || defaults.refinePrompt || defaults.comparePrompt || ""),
        temperature: refine.temperature ?? defaults.temperature ?? "",
        top_p: refine.top_p ?? defaults.top_p ?? "",
        max_tokens: refine.max_tokens ?? defaults.max_tokens ?? "",
        max_completion_tokens:
          refine.max_completion_tokens ?? defaults.max_completion_tokens ?? "",
        presence_penalty: refine.presence_penalty ?? defaults.presence_penalty ?? "",
        frequency_penalty: refine.frequency_penalty ?? defaults.frequency_penalty ?? "",
        seed: refine.seed ?? defaults.seed ?? "",
        stop: refine.stop ?? refine.stopSequences ?? defaults.stop ?? "",
      },
    };
  }

  function getDataBakerCvpcStageParamElementId(stagePrefix, definition) {
    return (
      "data-baker-cvpc-ai-" +
      String(stagePrefix || "").trim() +
      "-" +
      String(definition?.domSuffix || "").trim()
    );
  }

  function applyDataBakerCvpcStageParamValues(stagePrefix, configPrefix, config, stageDefaults) {
    aishellTechStageParamDefinitions.forEach(function (definition) {
      const node = getElement(getDataBakerCvpcStageParamElementId(stagePrefix, definition));
      if (!(node instanceof HTMLInputElement) && !(node instanceof HTMLTextAreaElement)) {
        return;
      }
      node.value = String(
        getAsrVoiceAiEffectiveText(
          config?.[configPrefix + definition.suffix],
          stageDefaults?.[definition.apiKey]
        )
      );
    });
  }

  function readDataBakerCvpcStageParamDraft(target, configPrefix, stagePrefix) {
    const draft = target && typeof target === "object" ? target : {};
    aishellTechStageParamDefinitions.forEach(function (definition) {
      const node = getElement(getDataBakerCvpcStageParamElementId(stagePrefix, definition));
      const rawValue =
        node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement ? node.value : "";
      if (definition.type === "number") {
        draft[configPrefix + definition.suffix] = normalizeOptionalNumberText(
          rawValue,
          definition.min,
          definition.max,
          definition.precision
        );
        return;
      }
      if (definition.type === "integer") {
        draft[configPrefix + definition.suffix] = normalizeOptionalIntegerText(
          rawValue,
          definition.min,
          definition.max
        );
        return;
      }
      draft[configPrefix + definition.suffix] = normalizeStopSequencesText(rawValue || "");
    });
    return draft;
  }

  function getAishellTechConcurrencyModelConfig(configLike) {
    const config = configLike && typeof configLike === "object" ? configLike : {};
    const compareFamily = normalizeAishellTechCompareFamily(
      config.aiRecommendCompareFamily,
      "qwen"
    );
    const listenModel = normalizeDataBakerListenModel(
      config.aiRecommendListenModel,
      "qwen3.5-omni-flash"
    );
    const omniModel = normalizeDataBakerSingleModel(
      config.aiRecommendCompareModel || listenModel,
      "qwen3.5-omni-flash"
    );
    if (compareFamily === "qwen" && isDataBakerFunAsrListenModel(listenModel)) {
      return {
        aiRecommendPipelineMode: "two_stage",
        aiRecommendListenModel: "fun-asr",
        aiRecommendSingleModel: "qwen3.5-omni-flash",
        aiQualifiedAutofillConcurrency: config.aiQualifiedAutofillConcurrency,
      };
    }
    return {
      aiRecommendPipelineMode: "omni_single",
      aiRecommendListenModel: listenModel,
      aiRecommendSingleModel: omniModel,
      aiQualifiedAutofillConcurrency: config.aiQualifiedAutofillConcurrency,
    };
  }

  function resolveMagicDataRecognitionStrategyFromSource(source, fallback) {
    const safeSource = source && typeof source === "object" ? source : {};
    const explicitStrategy = hasValidMagicDataRecognitionStrategy(safeSource.aiReviewRecognitionStrategy)
      ? normalizeMagicDataRecognitionStrategy(safeSource.aiReviewRecognitionStrategy, "direct_dialect")
      : "";
    if (explicitStrategy) {
      return explicitStrategy;
    }
    const compatStrategy = hasValidMagicDataRecognitionStrategy(safeSource.recognitionStrategy)
      ? normalizeMagicDataRecognitionStrategy(safeSource.recognitionStrategy, "direct_dialect")
      : "";
    if (compatStrategy) {
      return compatStrategy;
    }
    const fallbackStrategy = hasValidMagicDataRecognitionStrategy(fallback)
      ? normalizeMagicDataRecognitionStrategy(fallback, "direct_dialect")
      : "";
    if (fallbackStrategy) {
      return fallbackStrategy;
    }
    return normalizeMagicDataRecognitionStrategy(
      safeSource.aiReviewRecognitionMode || safeSource.recognitionMode || safeSource.pipelineMode,
      "direct_dialect"
    );
  }

  function buildMagicDataLegacyRecognitionFields(modelMode, recognitionStrategy) {
    const normalizedModelMode = normalizeMagicDataModelMode(modelMode, "two_stage");
    const normalizedRecognitionStrategy = normalizeMagicDataRecognitionStrategy(
      recognitionStrategy,
      "direct_dialect"
    );
    const legacyRecognitionMode = deriveLegacyRecognitionModeByModeAndStrategy(
      normalizedModelMode,
      normalizedRecognitionStrategy
    );
    return {
      aiReviewRecognitionMode: legacyRecognitionMode,
      recognitionMode: legacyRecognitionMode,
      pipelineMode: legacyRecognitionMode,
    };
  }

  function deriveLegacyRecognitionModeByModeAndStrategy(modelMode, recognitionStrategy) {
    const normalizedModelMode = normalizeMagicDataModelMode(modelMode, "two_stage");
    const normalizedRecognitionStrategy = normalizeMagicDataRecognitionStrategy(
      recognitionStrategy,
      "direct_dialect"
    );
    if (normalizedRecognitionStrategy === "mandarin_to_dialect") {
      return "recognition_convert";
    }
    return normalizedModelMode;
  }

  function getDataBakerSettingsDraftConfig(aiDefaults) {
    const defaults = aiDefaults && typeof aiDefaults === "object" ? aiDefaults : {};
    const recognitionSelectNode = getElement("data-baker-ai-pipeline-mode-select");
    const listenSelectNode = getElement("data-baker-ai-listen-model-select");
    const compareSelectNode = getElement("data-baker-ai-compare-model-select");
    const singleSelectNode = getElement("data-baker-ai-single-model-select");
    return {
      aiRecommendPipelineMode:
        recognitionSelectNode instanceof HTMLSelectElement
          ? normalizeDataBakerRecognitionMode(recognitionSelectNode.value, "two_stage")
          : "two_stage",
      aiRecommendListenModel:
        listenSelectNode instanceof HTMLSelectElement
          ? normalizeDataBakerListenModel(
              listenSelectNode.value,
              getDataBakerListenModelDefault(defaults)
            )
          : getDataBakerListenModelDefault(defaults),
      aiRecommendCompareModel:
        compareSelectNode instanceof HTMLSelectElement
          ? normalizeDataBakerCompareModel(
              compareSelectNode.value,
              String(defaults.compareModel || "qwen3.5-plus")
            )
          : String(defaults.compareModel || "qwen3.5-plus"),
      aiRecommendSingleModel:
        singleSelectNode instanceof HTMLSelectElement
          ? normalizeDataBakerSingleModel(
              singleSelectNode.value,
              getDataBakerSingleModelDefault(defaults)
            )
          : getDataBakerSingleModelDefault(defaults),
    };
  }

  function applyDataBakerRecognitionModeFields(recognitionMode, config, aiDefaults) {
    const currentRecognitionMode = normalizeDataBakerRecognitionMode(
      recognitionMode || config?.aiRecommendPipelineMode,
      "two_stage"
    );
    renderFixedModelOptions(
      "data-baker-ai-pipeline-mode-select",
      [
        { value: "two_stage", label: "双模型：听音模型 + 比较模型" },
        { value: "omni_single", label: "单模型：Omni 单模型" },
      ],
      currentRecognitionMode
    );
    setFieldVisibility("data-baker-ai-listen-model-field", currentRecognitionMode === "two_stage");
    setFieldVisibility("data-baker-ai-compare-model-field", currentRecognitionMode === "two_stage");
    setFieldVisibility("data-baker-ai-single-model-field", currentRecognitionMode === "omni_single");
    setFieldVisibility("data-baker-ai-listen-model-custom-field", false);
    setFieldVisibility("data-baker-ai-compare-model-custom-field", false);
    if (currentRecognitionMode === "omni_single") {
      applyDataBakerSingleModelFields(config?.aiRecommendSingleModel, config, aiDefaults);
      setFieldVisibility("data-baker-ai-listen-model-note", false);
      return;
    }
    applyDataBakerListenModelFields(config?.aiRecommendListenModel, config, aiDefaults);
    updateDataBakerAutofillConcurrencyField(
      Object.assign({}, config || {}, {
        aiRecommendPipelineMode: currentRecognitionMode,
      })
    );
  }

  function updateDataBakerRecognitionModeFields(recognitionMode) {
    const aiDefaults =
      getAsrVoiceAiDefaultsCached(dataBakerRoundOneQualityScriptId).defaults || {};
    const draftConfig = getDataBakerSettingsDraftConfig(aiDefaults);
    draftConfig.aiRecommendPipelineMode = normalizeDataBakerRecognitionMode(recognitionMode, "two_stage");
    if (draftConfig.aiRecommendPipelineMode === "omni_single") {
      draftConfig.aiRecommendSingleModel = isDataBakerFunAsrListenModel(
        draftConfig.aiRecommendListenModel
      )
        ? "qwen3.5-omni-flash"
        : normalizeDataBakerSingleModel(
            draftConfig.aiRecommendSingleModel,
            getDataBakerSingleModelDefault(aiDefaults)
          );
    }
    applyDataBakerRecognitionModeFields(
      draftConfig.aiRecommendPipelineMode,
      draftConfig,
      aiDefaults
    );
  }

  function updateDataBakerListenModelFields(listenModel) {
    const aiDefaults =
      getAsrVoiceAiDefaultsCached(dataBakerRoundOneQualityScriptId).defaults || {};
    const draftConfig = getDataBakerSettingsDraftConfig(aiDefaults);
    draftConfig.aiRecommendListenModel = normalizeDataBakerListenModel(
      listenModel,
      getDataBakerListenModelDefault(aiDefaults)
    );
    applyDataBakerRecognitionModeFields(
      draftConfig.aiRecommendPipelineMode || "two_stage",
      draftConfig,
      aiDefaults
    );
  }

  function updateDataBakerSingleModelFields(singleModel) {
    const aiDefaults =
      getAsrVoiceAiDefaultsCached(dataBakerRoundOneQualityScriptId).defaults || {};
    const draftConfig = getDataBakerSettingsDraftConfig(aiDefaults);
    draftConfig.aiRecommendSingleModel = normalizeDataBakerSingleModel(
      singleModel,
      getDataBakerSingleModelDefault(aiDefaults)
    );
    applyDataBakerRecognitionModeFields(
      draftConfig.aiRecommendPipelineMode || "omni_single",
      draftConfig,
      aiDefaults
    );
  }

  function getAishellTechStageParamElementId(stagePrefix, definition) {
    return (
      "aishell-tech-ai-" +
      String(stagePrefix || "").trim() +
      "-" +
      String(definition?.domSuffix || "").trim()
    );
  }

  function applyAishellTechStageParamValues(stagePrefix, configPrefix, config, stageDefaults) {
    aishellTechStageParamDefinitions.forEach(function (definition) {
      const node = getElement(getAishellTechStageParamElementId(stagePrefix, definition));
      if (!(node instanceof HTMLInputElement) && !(node instanceof HTMLTextAreaElement)) {
        return;
      }
      node.value = String(
        getAsrVoiceAiEffectiveText(
          config?.[configPrefix + definition.suffix],
          stageDefaults?.[definition.apiKey]
        )
      );
    });
  }

  function readAishellTechStageParamDraft(target, configPrefix, stagePrefix) {
    const draft = target && typeof target === "object" ? target : {};
    aishellTechStageParamDefinitions.forEach(function (definition) {
      const node = getElement(getAishellTechStageParamElementId(stagePrefix, definition));
      const rawValue =
        node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement ? node.value : "";
      if (definition.type === "number") {
        draft[configPrefix + definition.suffix] = normalizeOptionalNumberText(
          rawValue,
          definition.min,
          definition.max,
          definition.precision
        );
        return;
      }
      if (definition.type === "integer") {
        draft[configPrefix + definition.suffix] = normalizeOptionalIntegerText(
          rawValue,
          definition.min,
          definition.max
        );
        return;
      }
      draft[configPrefix + definition.suffix] = normalizeStopSequencesText(rawValue || "");
    });
    return draft;
  }

  function updateAishellTechAutofillConcurrencyField(configLike, options) {
    const config = configLike && typeof configLike === "object" ? configLike : {};
    const targetScriptId =
      String(options?.scriptId || "").trim() === aishellTechVietnameseScriptId
        ? aishellTechVietnameseScriptId
        : aishellTechMinnanScriptId;
    updateSharedAsrAutofillConcurrencyField(
      targetScriptId,
      Object.assign({}, config, getAishellTechConcurrencyModelConfig(config)),
      options
    );
  }

  function getAishellTechCompareModelDefault(aiDefaults, compareFamily) {
    const stageDefaults = getAishellTechStageDefaults(aiDefaults);
    return normalizeAishellTechCompareFamily(compareFamily, stageDefaults.compare.family) === "omni"
      ? stageDefaults.compare.omniModel
      : stageDefaults.compare.qwenModel;
  }

  function applyAishellTechCompareFamilyFields(config, aiDefaults) {
    const currentConfig = Object.assign({}, config || {});
    const stageDefaults = getAishellTechStageDefaults(aiDefaults);
    const compareFamily = normalizeAishellTechCompareFamily(
      currentConfig.aiRecommendCompareFamily,
      stageDefaults.compare.family
    );
    const compareModel =
      compareFamily === "omni"
        ? normalizeDataBakerSingleModel(
            currentConfig.aiRecommendCompareModel,
            stageDefaults.compare.omniModel
          )
        : normalizeDataBakerCompareModel(
            currentConfig.aiRecommendCompareModel,
            stageDefaults.compare.qwenModel
          );
    renderFixedModelOptions(
      "aishell-tech-ai-compare-family-select",
      aishellTechCompareFamilyOptions,
      compareFamily
    );
    renderFixedModelOptions(
      "aishell-tech-ai-compare-model-select",
      compareFamily === "omni"
        ? stageDefaults.compare.omniModelOptions
        : stageDefaults.compare.qwenModelOptions,
      compareModel
    );
    const compareModelHelpNode = getElement("aishell-tech-ai-compare-model-help");
    if (compareModelHelpNode instanceof HTMLElement) {
      compareModelHelpNode.textContent =
        compareFamily === "omni"
          ? "Omni 会在比较阶段再次读取音频，并结合转换结果与听音结果输出最终判断。"
          : "Qwen 只做文本比较，基于原文、转换结果和听音结果决定是否采纳。";
    }
    setFieldVisibility("aishell-tech-ai-compare-qwen-prompt-field", compareFamily === "qwen");
    setFieldVisibility("aishell-tech-ai-compare-omni-prompt-field", compareFamily === "omni");
  }

  function applyAishellTechListenModelFields(listenModel, config, aiDefaults) {
    const currentConfig = Object.assign({}, config || {});
    const stageDefaults = getAishellTechStageDefaults(aiDefaults);
    const currentListenModel = normalizeDataBakerListenModel(
      listenModel || currentConfig.aiRecommendListenModel,
      stageDefaults.listen.model
    );
    renderFixedModelOptions(
      "aishell-tech-ai-listen-model-select",
      stageDefaults.listen.modelOptions,
      currentListenModel
    );
    const listenHelpNode = getElement("aishell-tech-ai-listen-model-help");
    if (listenHelpNode instanceof HTMLElement) {
      listenHelpNode.textContent =
        currentListenModel === "fun-asr"
          ? "Fun-ASR 只负责听音转写；转换板块会并行做词表替换，比较板块最后再汇总。"
          : "Omni 负责听音转写；比较板块是否再次听音由比较方式决定。";
    }
    const noteNode = getElement("aishell-tech-ai-listen-model-note");
    if (noteNode instanceof HTMLElement) {
      noteNode.innerHTML =
        '<span class="asr-ai-help">' +
        escapeHtml(
          currentListenModel === "fun-asr"
            ? "当前为 Fun-ASR 听音链路：先并行完成转换和听音，再由比较板块做纯文本或二次听音判断。"
            : "当前为 Omni 听音链路：听音阶段先产出 heardText；若比较方式也选 Omni，则比较阶段还会再次听音。"
        ) +
        "</span>";
    }
    updateAishellTechAutofillConcurrencyField(
      Object.assign({}, currentConfig, {
        aiRecommendListenModel: currentListenModel,
      })
    );
  }

  function applyAishellTechStageFields(config, aiDefaults) {
    const currentConfig = Object.assign({}, config || {});
    const stageDefaults = getAishellTechStageDefaults(aiDefaults);
    renderFixedModelOptions(
      "aishell-tech-ai-convert-model-select",
      stageDefaults.convert.modelOptions,
      normalizeDataBakerCompareModel(
        currentConfig.aiRecommendConvertModel,
        stageDefaults.convert.model
      )
    );
    const convertPromptNode = getElement("aishell-tech-ai-convert-prompt");
    if (convertPromptNode instanceof HTMLTextAreaElement) {
      convertPromptNode.value = String(
        getAsrVoiceAiEffectiveText(
          currentConfig.aiRecommendConvertPrompt,
          stageDefaults.convert.prompt
        )
      );
    }
    applyAishellTechStageParamValues(
      "convert",
      "aiRecommendConvert",
      currentConfig,
      stageDefaults.convert
    );

    applyAishellTechListenModelFields(currentConfig.aiRecommendListenModel, currentConfig, aiDefaults);
    const listenPromptNode = getElement("aishell-tech-ai-listen-prompt");
    if (listenPromptNode instanceof HTMLTextAreaElement) {
      listenPromptNode.value = String(
        getAsrVoiceAiEffectiveText(
          currentConfig.aiRecommendListenPrompt,
          stageDefaults.listen.prompt
        )
      );
    }
    applyAishellTechStageParamValues(
      "listen",
      "aiRecommendListen",
      currentConfig,
      stageDefaults.listen
    );

    applyAishellTechCompareFamilyFields(currentConfig, aiDefaults);
    const compareQwenPromptNode = getElement("aishell-tech-ai-compare-qwen-prompt");
    const compareOmniPromptNode = getElement("aishell-tech-ai-compare-omni-prompt");
    const compareThresholdNode = getElement("aishell-tech-ai-compare-adoption-threshold");
    if (compareQwenPromptNode instanceof HTMLTextAreaElement) {
      compareQwenPromptNode.value = String(
        getAsrVoiceAiEffectiveText(
          currentConfig.aiRecommendCompareQwenPrompt,
          stageDefaults.compare.qwenPrompt
        )
      );
    }
    if (compareOmniPromptNode instanceof HTMLTextAreaElement) {
      compareOmniPromptNode.value = String(
        getAsrVoiceAiEffectiveText(
          currentConfig.aiRecommendCompareOmniPrompt,
          stageDefaults.compare.omniPrompt
        )
      );
    }
    if (compareThresholdNode instanceof HTMLInputElement) {
      compareThresholdNode.value = String(
        getAsrVoiceAiEffectiveText(
          currentConfig.aiRecommendCompareAdoptionThreshold,
          stageDefaults.compare.adoptionThreshold
        )
      );
    }
    applyAishellTechStageParamValues(
      "compare",
      "aiRecommendCompare",
      currentConfig,
      stageDefaults.compare
    );
  }

  function getAishellTechSettingsDraftConfig(aiDefaults) {
    const stageDefaults = getAishellTechStageDefaults(aiDefaults);
    const convertModelNode = getElement("aishell-tech-ai-convert-model-select");
    const convertPromptNode = getElement("aishell-tech-ai-convert-prompt");
    const listenModelNode = getElement("aishell-tech-ai-listen-model-select");
    const listenPromptNode = getElement("aishell-tech-ai-listen-prompt");
    const compareFamilyNode = getElement("aishell-tech-ai-compare-family-select");
    const compareModelNode = getElement("aishell-tech-ai-compare-model-select");
    const compareQwenPromptNode = getElement("aishell-tech-ai-compare-qwen-prompt");
    const compareOmniPromptNode = getElement("aishell-tech-ai-compare-omni-prompt");
    const compareThresholdNode = getElement("aishell-tech-ai-compare-adoption-threshold");
    const compareFamily =
      compareFamilyNode instanceof HTMLSelectElement
        ? normalizeAishellTechCompareFamily(
            compareFamilyNode.value,
            stageDefaults.compare.family
          )
        : stageDefaults.compare.family;
    const draft = {
      aiRecommendConvertModel:
        convertModelNode instanceof HTMLSelectElement
          ? normalizeDataBakerCompareModel(convertModelNode.value, stageDefaults.convert.model)
          : stageDefaults.convert.model,
      aiRecommendConvertPrompt:
        convertPromptNode instanceof HTMLTextAreaElement
          ? normalizePromptText(convertPromptNode.value)
          : "",
      aiRecommendListenModel:
        listenModelNode instanceof HTMLSelectElement
          ? normalizeDataBakerListenModel(listenModelNode.value, stageDefaults.listen.model)
          : stageDefaults.listen.model,
      aiRecommendListenPrompt:
        listenPromptNode instanceof HTMLTextAreaElement
          ? normalizePromptText(listenPromptNode.value)
          : "",
      aiRecommendCompareFamily: compareFamily,
      aiRecommendCompareModel:
        compareModelNode instanceof HTMLSelectElement
          ? compareFamily === "omni"
            ? normalizeDataBakerSingleModel(
                compareModelNode.value,
                stageDefaults.compare.omniModel
              )
            : normalizeDataBakerCompareModel(
                compareModelNode.value,
                stageDefaults.compare.qwenModel
              )
          : getAishellTechCompareModelDefault(aiDefaults, compareFamily),
      aiRecommendCompareQwenPrompt:
        compareQwenPromptNode instanceof HTMLTextAreaElement
          ? normalizePromptText(compareQwenPromptNode.value)
          : "",
      aiRecommendCompareOmniPrompt:
        compareOmniPromptNode instanceof HTMLTextAreaElement
          ? normalizePromptText(compareOmniPromptNode.value)
          : "",
      aiRecommendCompareAdoptionThreshold:
        compareThresholdNode instanceof HTMLInputElement
          ? normalizeOptionalNumberText(compareThresholdNode.value, 0, 1, 3) ||
            stageDefaults.compare.adoptionThreshold
          : stageDefaults.compare.adoptionThreshold,
    };
    readAishellTechStageParamDraft(draft, "aiRecommendConvert", "convert");
    readAishellTechStageParamDraft(draft, "aiRecommendListen", "listen");
    readAishellTechStageParamDraft(draft, "aiRecommendCompare", "compare");
    return draft;
  }

  function applyDataBakerCvpcListenModelFields(listenModel, aiDefaults) {
    const stageDefaults = getDataBakerCvpcStageDefaults(aiDefaults);
    const currentListenModel = normalizeDataBakerCvpcListenModel(
      listenModel,
      stageDefaults.listen.model
    );
    renderFixedModelOptions(
      "data-baker-cvpc-ai-listen-model-select",
      stageDefaults.listen.modelOptions,
      currentListenModel
    );
    const listenHelpNode = getElement("data-baker-cvpc-ai-listen-model-help");
    if (listenHelpNode instanceof HTMLElement) {
      listenHelpNode.textContent =
        "Qwen Omni 只根据当前段音频输出原始柳州话听音文本。";
    }
  }

  function applyDataBakerCvpcStageFields(config, aiDefaults) {
    const currentConfig = Object.assign({}, config || {});
    const stageDefaults = getDataBakerCvpcStageDefaults(aiDefaults);
    applyDataBakerCvpcListenModelFields(currentConfig.aiRecommendListenModel, aiDefaults);
    const listenPromptNode = getElement("data-baker-cvpc-ai-listen-prompt");
    const listenIncludeLexiconReferenceNode = getElement(
      "data-baker-cvpc-ai-listen-include-lexicon-reference"
    );
    if (listenPromptNode instanceof HTMLTextAreaElement) {
      listenPromptNode.value = String(
        getAsrVoiceAiEffectiveText(
          currentConfig.aiRecommendListenPrompt,
          stageDefaults.listen.prompt
        )
      );
    }
    if (listenIncludeLexiconReferenceNode instanceof HTMLInputElement) {
      listenIncludeLexiconReferenceNode.checked =
        currentConfig.aiRecommendListenIncludeLexiconReference !== undefined
          ? currentConfig.aiRecommendListenIncludeLexiconReference === true
          : stageDefaults.listen.includeLexiconReference === true;
    }
    applyDataBakerCvpcStageParamValues(
      "listen",
      "aiRecommendListen",
      currentConfig,
      stageDefaults.listen
    );

    renderFixedModelOptions(
      "data-baker-cvpc-ai-refine-model-select",
      stageDefaults.refine.modelOptions,
      normalizeDataBakerCompareModel(
        currentConfig.aiRecommendRefineModel,
        stageDefaults.refine.model
      )
    );
    const refinePromptNode = getElement("data-baker-cvpc-ai-refine-prompt");
    if (refinePromptNode instanceof HTMLTextAreaElement) {
      refinePromptNode.value = String(
        getAsrVoiceAiEffectiveText(
          currentConfig.aiRecommendRefinePrompt,
          stageDefaults.refine.prompt
        )
      );
    }
    applyDataBakerCvpcStageParamValues(
      "refine",
      "aiRecommendRefine",
      currentConfig,
      stageDefaults.refine
    );
  }

  function getDataBakerCvpcSettingsDraftConfig(aiDefaults) {
    const stageDefaults = getDataBakerCvpcStageDefaults(aiDefaults);
    const listenModelNode = getElement("data-baker-cvpc-ai-listen-model-select");
    const listenPromptNode = getElement("data-baker-cvpc-ai-listen-prompt");
    const listenIncludeLexiconReferenceNode = getElement(
      "data-baker-cvpc-ai-listen-include-lexicon-reference"
    );
    const refineModelNode = getElement("data-baker-cvpc-ai-refine-model-select");
    const refinePromptNode = getElement("data-baker-cvpc-ai-refine-prompt");
    const draft = {
      aiRecommendListenModel:
        listenModelNode instanceof HTMLSelectElement
          ? normalizeDataBakerCvpcListenModel(listenModelNode.value, stageDefaults.listen.model)
          : stageDefaults.listen.model,
      aiRecommendListenPrompt:
        listenPromptNode instanceof HTMLTextAreaElement
          ? normalizePromptText(listenPromptNode.value)
          : "",
      aiRecommendListenIncludeLexiconReference:
        listenIncludeLexiconReferenceNode instanceof HTMLInputElement
          ? listenIncludeLexiconReferenceNode.checked === true
          : stageDefaults.listen.includeLexiconReference === true,
      aiRecommendRefineModel:
        refineModelNode instanceof HTMLSelectElement
          ? normalizeDataBakerCompareModel(refineModelNode.value, stageDefaults.refine.model)
          : stageDefaults.refine.model,
      aiRecommendRefinePrompt:
        refinePromptNode instanceof HTMLTextAreaElement
          ? normalizePromptText(refinePromptNode.value)
          : "",
    };
    readDataBakerCvpcStageParamDraft(draft, "aiRecommendListen", "listen");
    readDataBakerCvpcStageParamDraft(draft, "aiRecommendRefine", "refine");
    return draft;
  }

  function getBytedanceAidpSuzhouStageDefaults(aiDefaults, scriptId) {
    const defaults = aiDefaults && typeof aiDefaults === "object" ? aiDefaults : {};
    const stages = defaults.stages && typeof defaults.stages === "object" ? defaults.stages : {};
    const listen = stages.listen && typeof stages.listen === "object" ? stages.listen : {};
    const refine = stages.refine && typeof stages.refine === "object" ? stages.refine : {};
    const isJinhua = scriptId === bytedanceAidpJinhuaScriptId;
    const refineModelOptions = isJinhua
      ? bytedanceAidpJinhuaRefineModelOptions
      : dataBakerCompareModelOptions;
    return {
      listen: {
        model: normalizeDataBakerCvpcListenModel(
          listen.model || defaults.listenModel,
          defaults.omniModel || "qwen3.5-omni-flash"
        ),
        modelOptions: buildMergedModelOptions(
          listen.modelOptions,
          defaults.listenModelOptions || dataBakerCvpcListenModelOptions,
          [listen.model, defaults.listenModel, defaults.omniModel]
        ),
        prompt: String(listen.prompt || defaults.listenPrompt || ""),
        temperature: listen.temperature ?? defaults.temperature ?? "",
        top_p: listen.top_p ?? defaults.top_p ?? "",
        max_tokens: listen.max_tokens ?? defaults.max_tokens ?? "",
        max_completion_tokens:
          listen.max_completion_tokens ?? defaults.max_completion_tokens ?? "",
        presence_penalty: listen.presence_penalty ?? defaults.presence_penalty ?? "",
        frequency_penalty: listen.frequency_penalty ?? defaults.frequency_penalty ?? "",
        seed: listen.seed ?? defaults.seed ?? "",
        stop: listen.stop ?? listen.stopSequences ?? defaults.stop ?? "",
      },
      refine: {
        model: (isJinhua ? normalizeBytedanceAidpJinhuaRefineModel : normalizeDataBakerCompareModel)(
          refine.model || defaults.refineModel || defaults.compareModel,
          "qwen3.5-plus"
        ),
        modelOptions: buildMergedModelOptions(
          refine.modelOptions,
          defaults.refineModelOptions || defaults.compareModelOptions || refineModelOptions,
          [refine.model, defaults.refineModel, defaults.compareModel]
        ),
        prompt: String(refine.prompt || defaults.refinePrompt || defaults.comparePrompt || ""),
        temperature: refine.temperature ?? defaults.temperature ?? "",
        top_p: refine.top_p ?? defaults.top_p ?? "",
        max_tokens: refine.max_tokens ?? defaults.max_tokens ?? "",
        max_completion_tokens:
          refine.max_completion_tokens ?? defaults.max_completion_tokens ?? "",
        presence_penalty: refine.presence_penalty ?? defaults.presence_penalty ?? "",
        frequency_penalty: refine.frequency_penalty ?? defaults.frequency_penalty ?? "",
        seed: refine.seed ?? defaults.seed ?? "",
        stop: refine.stop ?? refine.stopSequences ?? defaults.stop ?? "",
      },
    };
  }

  function getBytedanceAidpSuzhouStageParamElementId(stagePrefix, definition) {
    return (
      "bytedance-aidp-ai-" +
      String(stagePrefix || "").trim() +
      "-" +
      String(definition?.domSuffix || "").trim()
    );
  }

  function formatBytedanceAidpSuzhouStageParamDefaultText(definition, value) {
    if (definition?.type === "number") {
      return normalizeOptionalNumberText(
        value,
        definition.min,
        definition.max,
        definition.precision
      );
    }
    if (definition?.type === "integer") {
      return normalizeOptionalIntegerText(value, definition.min, definition.max);
    }
    return normalizeStopSequencesText(value || "");
  }

  function refreshBytedanceAidpSuzhouStageParamHelpText(stagePrefix, definition, stageDefaults) {
    const fieldNode = getElement(getBytedanceAidpSuzhouStageParamElementId(stagePrefix, definition));
    const helpNode = getElement(
      getBytedanceAidpSuzhouStageParamHelpElementId(stagePrefix, definition)
    );
    if (
      (!(fieldNode instanceof HTMLInputElement) && !(fieldNode instanceof HTMLTextAreaElement)) ||
      !(helpNode instanceof HTMLElement)
    ) {
      return;
    }
    const rawValue = definition?.type === "stop" ? normalizeStopSequencesText(fieldNode.value || "") : normalizeText(fieldNode.value);
    const baseHelpText = getBytedanceAidpSuzhouStageParamExplanation(definition);
    if (rawValue) {
      setInlineHelpText(helpNode, baseHelpText);
      helpNode.setAttribute("data-empty-default-visible", "false");
      return;
    }
    const defaultValue = formatBytedanceAidpSuzhouStageParamDefaultText(
      definition,
      stageDefaults?.[definition.apiKey]
    );
    setInlineHelpText(
      helpNode,
      [baseHelpText, "当前为空，将使用后端默认值：" + (normalizeText(defaultValue) || "空")]
        .filter(Boolean)
        .join(" ")
    );
    helpNode.setAttribute("data-empty-default-visible", "true");
  }

  function bindBytedanceAidpSuzhouStageParamHelp(stagePrefix, stageDefaults) {
    aishellTechStageParamDefinitions.forEach(function (definition) {
      const fieldNode = getElement(getBytedanceAidpSuzhouStageParamElementId(stagePrefix, definition));
      if (
        !(fieldNode instanceof HTMLInputElement) &&
        !(fieldNode instanceof HTMLTextAreaElement)
      ) {
        return;
      }
      if (fieldNode.getAttribute("data-aidp-default-help-bound") === "true") {
        return;
      }
      fieldNode.setAttribute("data-aidp-default-help-bound", "true");
      ["input", "change"].forEach(function (eventName) {
        fieldNode.addEventListener(eventName, function () {
          refreshBytedanceAidpSuzhouStageParamHelpText(
            stagePrefix,
            definition,
            stageDefaults
          );
        });
      });
      refreshBytedanceAidpSuzhouStageParamHelpText(stagePrefix, definition, stageDefaults);
    });
  }

  function refreshBytedanceAidpSuzhouStageParamHelpTexts(stagePrefix, stageDefaults) {
    aishellTechStageParamDefinitions.forEach(function (definition) {
      refreshBytedanceAidpSuzhouStageParamHelpText(stagePrefix, definition, stageDefaults);
    });
  }

  function applyBytedanceAidpSuzhouStageParamValues(stagePrefix, configPrefix, config, stageDefaults) {
    aishellTechStageParamDefinitions.forEach(function (definition) {
      const node = getElement(
        getBytedanceAidpSuzhouStageParamElementId(stagePrefix, definition)
      );
      if (!(node instanceof HTMLInputElement) && !(node instanceof HTMLTextAreaElement)) {
        return;
      }
      const rawValue = config?.[configPrefix + definition.suffix];
      node.value = String(
        getAsrVoiceAiEffectiveText(rawValue, stageDefaults?.[definition.apiKey])
      );
      node.placeholder = "";
    });
    refreshBytedanceAidpSuzhouStageParamHelpTexts(stagePrefix, stageDefaults);
  }

  function readBytedanceAidpSuzhouStageParamDraft(target, configPrefix, stagePrefix) {
    const draft = target && typeof target === "object" ? target : {};
    aishellTechStageParamDefinitions.forEach(function (definition) {
      const node = getElement(
        getBytedanceAidpSuzhouStageParamElementId(stagePrefix, definition)
      );
      const rawValue =
        node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement ? node.value : "";
      if (definition.type === "number") {
        draft[configPrefix + definition.suffix] = normalizeOptionalNumberText(
          rawValue,
          definition.min,
          definition.max,
          definition.precision
        );
        return;
      }
      if (definition.type === "integer") {
        draft[configPrefix + definition.suffix] = normalizeOptionalIntegerText(
          rawValue,
          definition.min,
          definition.max
        );
        return;
      }
      draft[configPrefix + definition.suffix] = normalizeStopSequencesText(rawValue || "");
    });
    return draft;
  }

  function applyBytedanceAidpSuzhouListenModelFields(listenModel, aiDefaults, scriptId) {
    const stageDefaults = getBytedanceAidpSuzhouStageDefaults(aiDefaults, scriptId);
    const currentListenModel = normalizeDataBakerCvpcListenModel(
      listenModel,
      stageDefaults.listen.model
    );
    renderDetailCustomSelectOptions(
      "bytedance-aidp-ai-listen-model-select",
      stageDefaults.listen.modelOptions,
      currentListenModel,
      {
        placeholder: "请选择听音模型",
      }
    );
  }

  function applyBytedanceAidpSuzhouStageFields(config, aiDefaults, scriptId) {
    const currentConfig = Object.assign({}, config || {});
    const stageDefaults = getBytedanceAidpSuzhouStageDefaults(aiDefaults, scriptId);
    const currentModelMode =
      scriptId === bytedanceAidpJinhuaScriptId
        ? normalizeBytedanceAidpJinhuaModelMode(currentConfig.aiRecommendModelMode, "two_stage")
        : "two_stage";
    const isExpertMode = currentModelMode === "expert_omni_plus";
    const modelModeNode = getElement("bytedance-aidp-jinhua-model-mode-select");
    if (modelModeNode instanceof HTMLSelectElement) {
      renderDetailCustomSelectOptions(
        "bytedance-aidp-jinhua-model-mode-select",
        bytedanceAidpJinhuaModelModeOptions,
        currentModelMode,
        {
          placeholder: "请选择模型模式",
        }
      );
    }
    applyBytedanceAidpSuzhouListenModelFields(
      currentConfig.aiRecommendListenModel,
      aiDefaults,
      scriptId
    );
    const listenPromptNode = getElement("bytedance-aidp-ai-listen-prompt");
    if (listenPromptNode instanceof HTMLTextAreaElement) {
      listenPromptNode.value = String(
        getAsrVoiceAiEffectiveText(currentConfig.aiRecommendListenPrompt, stageDefaults.listen.prompt)
      );
      listenPromptNode.placeholder = "";
    }
    applyBytedanceAidpSuzhouStageParamValues(
      "listen",
      "aiRecommendListen",
      currentConfig,
      stageDefaults.listen
    );

    renderDetailCustomSelectOptions(
      "bytedance-aidp-ai-refine-model-select",
      stageDefaults.refine.modelOptions,
      (scriptId === bytedanceAidpJinhuaScriptId
        ? normalizeBytedanceAidpJinhuaRefineModel
        : normalizeDataBakerCompareModel)(currentConfig.aiRecommendRefineModel, stageDefaults.refine.model),
      {
        placeholder: "请选择收口模型",
      }
    );
    [getElement("bytedance-aidp-ai-listen-model-select"), getElement("bytedance-aidp-ai-refine-model-select")].forEach(
      function (node) {
        if (node instanceof HTMLSelectElement) {
          node.disabled = isExpertMode;
          node.title = isExpertMode
            ? "专家模式下听音与收口实际都使用 qwen3.5-omni-plus；原双模型配置会保留。"
            : "";
        }
      }
    );
    const refinePromptNode = getElement("bytedance-aidp-ai-refine-prompt");
    if (refinePromptNode instanceof HTMLTextAreaElement) {
      refinePromptNode.value = String(
        getAsrVoiceAiEffectiveText(currentConfig.aiRecommendRefinePrompt, stageDefaults.refine.prompt)
      );
      refinePromptNode.placeholder = "";
    }
    applyBytedanceAidpSuzhouStageParamValues(
      "refine",
      "aiRecommendRefine",
      currentConfig,
      stageDefaults.refine
    );
  }

  function getBytedanceAidpSuzhouSettingsDraftConfig(aiDefaults, scriptId, currentConfig) {
    const stageDefaults = getBytedanceAidpSuzhouStageDefaults(aiDefaults, scriptId);
    const currentSource = currentConfig && typeof currentConfig === "object" ? currentConfig : {};
    const modelModeNode = getElement("bytedance-aidp-jinhua-model-mode-select");
    const listenModelNode = getElement("bytedance-aidp-ai-listen-model-select");
    const listenPromptNode = getElement("bytedance-aidp-ai-listen-prompt");
    const refineModelNode = getElement("bytedance-aidp-ai-refine-model-select");
    const refinePromptNode = getElement("bytedance-aidp-ai-refine-prompt");
    const draft = {
      aiRecommendModelMode:
        scriptId === bytedanceAidpJinhuaScriptId
          ? modelModeNode instanceof HTMLSelectElement
            ? normalizeBytedanceAidpJinhuaModelMode(modelModeNode.value, "two_stage")
            : normalizeBytedanceAidpJinhuaModelMode(currentSource.aiRecommendModelMode, "two_stage")
          : undefined,
      aiRecommendListenModel:
        listenModelNode instanceof HTMLSelectElement
          ? normalizeDataBakerCvpcListenModel(listenModelNode.value, stageDefaults.listen.model)
          : stageDefaults.listen.model,
      aiRecommendListenPrompt:
        listenPromptNode instanceof HTMLTextAreaElement
          ? normalizePromptText(listenPromptNode.value)
          : "",
      aiRecommendRefineModel:
        refineModelNode instanceof HTMLSelectElement
          ? (scriptId === bytedanceAidpJinhuaScriptId
              ? normalizeBytedanceAidpJinhuaRefineModel
              : normalizeDataBakerCompareModel)(refineModelNode.value, stageDefaults.refine.model)
          : stageDefaults.refine.model,
      aiRecommendRefinePrompt:
        refinePromptNode instanceof HTMLTextAreaElement
          ? normalizePromptText(refinePromptNode.value)
          : "",
    };
    readBytedanceAidpSuzhouStageParamDraft(draft, "aiRecommendListen", "listen");
    readBytedanceAidpSuzhouStageParamDraft(draft, "aiRecommendRefine", "refine");
    return draft;
  }

  function updateAishellTechListenModelFields(listenModel) {
    const aiDefaults = getAsrVoiceAiDefaultsCached(aishellTechMinnanScriptId).defaults || {};
    const draftConfig = getAishellTechSettingsDraftConfig(aiDefaults);
    draftConfig.aiRecommendListenModel = normalizeDataBakerListenModel(
      listenModel,
      getAishellTechStageDefaults(aiDefaults).listen.model
    );
    applyAishellTechStageFields(draftConfig, aiDefaults);
  }

  function updateAishellTechCompareFamilyFields(compareFamily) {
    const aiDefaults = getAsrVoiceAiDefaultsCached(aishellTechMinnanScriptId).defaults || {};
    const draftConfig = getAishellTechSettingsDraftConfig(aiDefaults);
    draftConfig.aiRecommendCompareFamily = normalizeAishellTechCompareFamily(
      compareFamily,
      getAishellTechStageDefaults(aiDefaults).compare.family
    );
    draftConfig.aiRecommendCompareModel = getAishellTechCompareModelDefault(
      aiDefaults,
      draftConfig.aiRecommendCompareFamily
    );
    applyAishellTechStageFields(draftConfig, aiDefaults);
  }

  function getMagicDataMinnanListenModelDefault(aiDefaults) {
    return normalizeDataBakerListenModel(
      aiDefaults?.listenModel || aiDefaults?.omniModel,
      "qwen3.5-omni-flash"
    );
  }

  function getMagicDataMinnanSingleModelDefault(aiDefaults) {
    return normalizeDataBakerSingleModel(
      aiDefaults?.singleModel || aiDefaults?.omniModel,
      "qwen3.5-omni-flash"
    );
  }

  function getMagicDataMinnanCompareModelDefault(aiDefaults, scriptId) {
    const fallback =
      scriptId === magicDataMinnanScriptId ? "qwen3.5-plus" : "qwen3.5-flash";
    return normalizeDataBakerCompareModel(
      aiDefaults?.compareModel || aiDefaults?.reviewModel,
      fallback
    );
  }

  function getMagicDataSettingsDraftConfig(aiDefaults, scriptId) {
    const defaults = aiDefaults && typeof aiDefaults === "object" ? aiDefaults : {};
    const targetScriptId = isMagicDataScript(scriptId) ? scriptId : magicDataMinnanScriptId;
    const modelModeSelectNode = getElement("magic-data-ai-pipeline-mode-select");
    const strategySelectNode = getElement("magic-data-ai-recognition-strategy-select");
    const listenSelectNode = getElement("magic-data-ai-listen-model-select");
    const compareSelectNode = getElement("magic-data-ai-compare-model-select");
    const singleSelectNode = getElement("magic-data-ai-single-model-select");
    const defaultLegacyMode = normalizeMagicDataMinnanRecognitionMode(
      defaults.recognitionMode || defaults.pipelineMode,
      "two_stage"
    );
    const defaultModelMode = normalizeMagicDataModelMode(defaultLegacyMode, "two_stage");
    const defaultRecognitionStrategy = normalizeMagicDataRecognitionStrategy(
      defaultLegacyMode,
      "direct_dialect"
    );
    const modelMode =
      modelModeSelectNode instanceof HTMLSelectElement
        ? normalizeMagicDataModelMode(modelModeSelectNode.value, defaultModelMode)
        : defaultModelMode;
    const recognitionStrategy =
      strategySelectNode instanceof HTMLSelectElement
        ? normalizeMagicDataRecognitionStrategy(strategySelectNode.value, defaultRecognitionStrategy)
        : defaultRecognitionStrategy;
    return {
      aiReviewModelMode: modelMode,
      aiReviewRecognitionStrategy: recognitionStrategy,
      aiReviewRecognitionMode: deriveLegacyRecognitionModeByModeAndStrategy(
        modelMode,
        recognitionStrategy
      ),
      aiReviewListenModel:
        listenSelectNode instanceof HTMLSelectElement
          ? normalizeDataBakerListenModel(
              listenSelectNode.value,
              getMagicDataMinnanListenModelDefault(defaults)
            )
          : getMagicDataMinnanListenModelDefault(defaults),
      aiReviewCompareModel:
        compareSelectNode instanceof HTMLSelectElement
          ? normalizeDataBakerCompareModel(
              compareSelectNode.value,
              getMagicDataMinnanCompareModelDefault(defaults, targetScriptId)
            )
          : getMagicDataMinnanCompareModelDefault(defaults, targetScriptId),
      aiReviewSingleModel:
        singleSelectNode instanceof HTMLSelectElement
          ? normalizeDataBakerSingleModel(
              singleSelectNode.value,
              getMagicDataMinnanSingleModelDefault(defaults)
            )
          : getMagicDataMinnanSingleModelDefault(defaults),
    };
  }

  function applyMagicDataMinnanListenModelFields(listenModel, config, aiDefaults, scriptId) {
    const targetScriptId = isMagicDataScript(scriptId) ? scriptId : magicDataMinnanScriptId;
    const currentListenModel = normalizeDataBakerListenModel(
      listenModel || config?.aiReviewListenModel,
      getMagicDataMinnanListenModelDefault(aiDefaults)
    );
    const currentCompareModel = normalizeDataBakerCompareModel(
      config?.aiReviewCompareModel,
      getMagicDataMinnanCompareModelDefault(aiDefaults, targetScriptId)
    );
    const listenLabelNode = getElement("magic-data-ai-listen-model-label");
    const listenHelpNode = getElement("magic-data-ai-listen-model-help");
    const listenSelectNode = getElement("magic-data-ai-listen-model-select");
    const compareSelectNode = getElement("magic-data-ai-compare-model-select");

    if (listenLabelNode) {
      listenLabelNode.textContent = "听音模型";
    }
    if (listenHelpNode) {
      listenHelpNode.textContent =
        "听音模型为 fun-asr 时通过统一后端 Fun-ASR provider 调用；默认是 REST，只有显式切换时才会走 Python fallback。听音模型为所选 Qwen Omni 模型时通过 Qwen Omni 音频输入调用。比较模型负责结合听音文本与页面文本生成建议。";
    }
    renderFixedModelOptions(
      "magic-data-ai-listen-model-select",
      dataBakerListenModelOptions,
      currentListenModel
    );
    renderFixedModelOptions(
      "magic-data-ai-compare-model-select",
      dataBakerCompareModelOptions,
      currentCompareModel
    );
    if (listenSelectNode instanceof HTMLSelectElement) {
      listenSelectNode.disabled = false;
    }
    if (compareSelectNode instanceof HTMLSelectElement) {
      compareSelectNode.disabled = false;
    }
    setFieldVisibility("magic-data-ai-listen-model-field", true);
    setFieldVisibility("magic-data-ai-compare-model-field", true);
    setFieldVisibility("magic-data-ai-single-model-field", false);
    setFieldVisibility("magic-data-ai-listen-model-custom-field", false);
    setFieldVisibility("magic-data-ai-compare-model-custom-field", false);
    setFieldVisibility("magic-data-ai-listen-model-note", isDataBakerFunAsrListenModel(currentListenModel));
  }

  function applyMagicDataMinnanSingleModelFields(singleModel, config, aiDefaults) {
    const currentSingleModel = normalizeDataBakerSingleModel(
      singleModel || config?.aiReviewSingleModel,
      getMagicDataMinnanSingleModelDefault(aiDefaults)
    );
    renderFixedModelOptions(
      "magic-data-ai-single-model-select",
      dataBakerSingleModelOptions,
      currentSingleModel
    );
    setFieldVisibility("magic-data-ai-single-model-field", true);
    setFieldVisibility("magic-data-ai-listen-model-note", false);
  }

  function applyMagicDataMinnanRecognitionModeFields(recognitionMode, config, aiDefaults, scriptId) {
    const targetScriptId = isMagicDataScript(scriptId) ? scriptId : magicDataMinnanScriptId;
    const legacyRecognitionMode = normalizeMagicDataMinnanRecognitionMode(
      recognitionMode || config?.aiReviewRecognitionMode,
      "two_stage"
    );
    const currentModelMode = normalizeMagicDataModelMode(
      config?.aiReviewModelMode || legacyRecognitionMode,
      "two_stage"
    );
    const currentRecognitionStrategy = resolveMagicDataRecognitionStrategyFromSource(
      config,
      legacyRecognitionMode
    );
    renderFixedModelOptions(
      "magic-data-ai-pipeline-mode-select",
      magicDataHelperModelModeOptions,
      currentModelMode
    );
    renderFixedModelOptions(
      "magic-data-ai-recognition-strategy-select",
      magicDataHelperRecognitionStrategyOptions,
      currentRecognitionStrategy
    );
    setFieldVisibility("magic-data-ai-pipeline-mode-field", true);
    setFieldVisibility("magic-data-ai-recognition-strategy-field", true);
    setFieldVisibility(
      "magic-data-ai-listen-model-field",
      currentModelMode === "two_stage"
    );
    setFieldVisibility(
      "magic-data-ai-compare-model-field",
      currentModelMode === "two_stage"
    );
    setFieldVisibility("magic-data-ai-single-model-field", currentModelMode === "omni_single");
    setFieldVisibility("magic-data-ai-listen-model-custom-field", false);
    setFieldVisibility("magic-data-ai-compare-model-custom-field", false);
    if (currentModelMode === "omni_single") {
      applyMagicDataMinnanSingleModelFields(config?.aiReviewSingleModel, config, aiDefaults);
      return;
    }
    applyMagicDataMinnanListenModelFields(
      config?.aiReviewListenModel,
      config,
      aiDefaults,
      targetScriptId
    );
  }

  function updateMagicDataRecognitionModeFields(scriptId, nextValue) {
    const targetScriptId = isMagicDataScript(scriptId) ? scriptId : magicDataMinnanScriptId;
    const aiDefaults = getAsrVoiceAiDefaultsCached(targetScriptId).defaults || {};
    const draftConfig = getMagicDataSettingsDraftConfig(aiDefaults, targetScriptId);
    draftConfig.aiReviewModelMode = normalizeMagicDataModelMode(
      nextValue,
      draftConfig.aiReviewModelMode || "two_stage"
    );
    draftConfig.aiReviewRecognitionMode = deriveLegacyRecognitionModeByModeAndStrategy(
      draftConfig.aiReviewModelMode,
      draftConfig.aiReviewRecognitionStrategy
    );
    if (draftConfig.aiReviewModelMode === "omni_single") {
      draftConfig.aiReviewSingleModel = isDataBakerFunAsrListenModel(draftConfig.aiReviewListenModel)
        ? "qwen3.5-omni-flash"
          : normalizeDataBakerSingleModel(
              draftConfig.aiReviewSingleModel,
              getMagicDataMinnanSingleModelDefault(aiDefaults)
            );
    }
    applyMagicDataMinnanRecognitionModeFields(
      draftConfig.aiReviewRecognitionMode,
      draftConfig,
      aiDefaults,
      targetScriptId
    );
  }

  function updateMagicDataRecognitionStrategyFields(scriptId, nextValue) {
    const targetScriptId = isMagicDataScript(scriptId) ? scriptId : magicDataMinnanScriptId;
    const aiDefaults = getAsrVoiceAiDefaultsCached(targetScriptId).defaults || {};
    const draftConfig = getMagicDataSettingsDraftConfig(aiDefaults, targetScriptId);
    draftConfig.aiReviewRecognitionStrategy = normalizeMagicDataRecognitionStrategy(
      nextValue,
      draftConfig.aiReviewRecognitionStrategy || "direct_dialect"
    );
    draftConfig.aiReviewRecognitionMode = deriveLegacyRecognitionModeByModeAndStrategy(
      draftConfig.aiReviewModelMode,
      draftConfig.aiReviewRecognitionStrategy
    );
    applyMagicDataMinnanRecognitionModeFields(
      draftConfig.aiReviewRecognitionMode,
      draftConfig,
      aiDefaults,
      targetScriptId
    );
  }

  function updateMagicDataListenModelFields(scriptId, listenModel) {
    const targetScriptId = isMagicDataScript(scriptId) ? scriptId : magicDataMinnanScriptId;
    const aiDefaults = getAsrVoiceAiDefaultsCached(targetScriptId).defaults || {};
    const draftConfig = getMagicDataSettingsDraftConfig(aiDefaults, targetScriptId);
    draftConfig.aiReviewListenModel = normalizeDataBakerListenModel(
      listenModel,
      getMagicDataMinnanListenModelDefault(aiDefaults)
    );
    applyMagicDataMinnanRecognitionModeFields(
      draftConfig.aiReviewRecognitionMode || "two_stage",
      draftConfig,
      aiDefaults,
      targetScriptId
    );
  }

  function updateMagicDataSingleModelFields(scriptId, singleModel) {
    const targetScriptId = isMagicDataScript(scriptId) ? scriptId : magicDataMinnanScriptId;
    const aiDefaults = getAsrVoiceAiDefaultsCached(targetScriptId).defaults || {};
    const draftConfig = getMagicDataSettingsDraftConfig(aiDefaults, targetScriptId);
    draftConfig.aiReviewSingleModel = normalizeDataBakerSingleModel(
      singleModel,
      getMagicDataMinnanSingleModelDefault(aiDefaults)
    );
    applyMagicDataMinnanRecognitionModeFields(
      draftConfig.aiReviewRecognitionMode || "omni_single",
      draftConfig,
      aiDefaults,
      targetScriptId
    );
  }

  function updateMagicDataCompareModelFields(scriptId, compareModel) {
    const targetScriptId = isMagicDataScript(scriptId) ? scriptId : magicDataMinnanScriptId;
    const aiDefaults = getAsrVoiceAiDefaultsCached(targetScriptId).defaults || {};
    const draftConfig = getMagicDataSettingsDraftConfig(aiDefaults, targetScriptId);
    draftConfig.aiReviewCompareModel = normalizeDataBakerCompareModel(
      compareModel,
      getMagicDataMinnanCompareModelDefault(aiDefaults, targetScriptId)
    );
    applyMagicDataMinnanRecognitionModeFields(
      draftConfig.aiReviewRecognitionMode || "two_stage",
      draftConfig,
      aiDefaults,
      targetScriptId
    );
  }

  function bindJudgementModelSelect(selectId, customInputId) {
    const selectNode = getElement(selectId);
    const customNode = getElement(customInputId);
    if (!(selectNode instanceof HTMLSelectElement) || !(customNode instanceof HTMLInputElement)) {
      return;
    }
    selectNode.addEventListener("change", function () {
      const useCustom = selectNode.value === "custom";
      customNode.classList.toggle("hidden", !useCustom);
      if (useCustom) {
        customNode.focus();
      }
    });
  }

  function isJudgementAiParamSupported(apiKey) {
    return judgementAiSupportedParams[String(apiKey || "")] === true;
  }

  function isJudgementSupportedParamFromDefaults(apiKey) {
    const payload = getAsrVoiceAiDefaultsCached(judgementProjectId);
    const supportedParams =
      payload && payload.supportedParams && typeof payload.supportedParams === "object"
        ? payload.supportedParams
        : {};
    if (hasOwn(supportedParams, apiKey)) {
      return supportedParams[apiKey] === true;
    }
    return isJudgementAiParamSupported(apiKey);
  }

  function normalizeOptionalNumberText(value, min, max, precision) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    const numericValue = Number(text);
    if (!Number.isFinite(numericValue)) {
      return "";
    }
    const clamped = Math.max(min, Math.min(max, numericValue));
    return String(
      typeof precision === "number" ? Number(clamped.toFixed(precision)) : clamped
    );
  }

  function normalizeOptionalIntegerText(value, min, max) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    const numericValue = Number(text);
    if (!Number.isFinite(numericValue)) {
      return "";
    }
    return String(Math.floor(Math.max(min, Math.min(max, numericValue))));
  }

  function normalizePromptText(value) {
    return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
  }

  function normalizeResponseFormat(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "json_object" || text === "text") {
      return text;
    }
    return String(fallback || "json_object").trim().toLowerCase() === "text"
      ? "text"
      : "json_object";
  }

  function normalizeStopSequencesText(value) {
    const source = String(value || "");
    if (!source.trim()) {
      return "";
    }
    const result = [];
    source
      .split(/\r?\n/)
      .map(function (item) {
        return String(item || "").trim().slice(0, 80);
      })
      .filter(Boolean)
      .forEach(function (item) {
        if (result.length >= 8) {
          return;
        }
        if (result.indexOf(item) >= 0) {
          return;
        }
        result.push(item);
      });
    return result.join("\n");
  }

  function toggleJudgementAiAdvancedFieldVisibility(inputId, supported) {
    const inputNode = getElement(inputId);
    if (!inputNode) {
      return;
    }
    const wrapper =
      typeof inputNode.closest === "function"
        ? inputNode.closest(".asr-ai-field")
        : inputNode.parentElement;
    if (!wrapper) {
      return;
    }
    wrapper.classList.toggle("hidden", supported !== true);
  }

  function applyJudgementAiAdvancedFieldVisibility() {
    toggleJudgementAiAdvancedFieldVisibility(
      "judgement-ai-suggestion-temperature",
      isJudgementAiParamSupported("temperature")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "judgement-ai-suggestion-top-p",
      isJudgementAiParamSupported("top_p")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "judgement-ai-suggestion-max-tokens",
      isJudgementAiParamSupported("max_tokens")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "judgement-ai-suggestion-max-completion-tokens",
      isJudgementAiParamSupported("max_completion_tokens")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "judgement-ai-suggestion-presence-penalty",
      isJudgementAiParamSupported("presence_penalty")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "judgement-ai-suggestion-frequency-penalty",
      isJudgementAiParamSupported("frequency_penalty")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "judgement-ai-suggestion-seed",
      isJudgementAiParamSupported("seed")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "judgement-ai-suggestion-stop-sequences",
      isJudgementAiParamSupported("stop")
    );
    const thinkingNode = getElement("judgement-ai-suggestion-enable-thinking");
    if (thinkingNode && thinkingNode.parentElement) {
      thinkingNode.parentElement.classList.toggle(
        "hidden",
        isJudgementAiParamSupported("enable_thinking") !== true
      );
    }
    const webSearchNode = getElement("judgement-ai-suggestion-web-search-enabled");
    if (webSearchNode && webSearchNode.parentElement) {
      webSearchNode.parentElement.classList.toggle(
        "hidden",
        isJudgementSupportedParamFromDefaults("web_search") !== true
      );
    }
  }

  function applyTranscriptionAiAdvancedFieldVisibility() {
    toggleJudgementAiAdvancedFieldVisibility(
      "transcription-ai-suggestion-temperature",
      isJudgementAiParamSupported("temperature")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "transcription-ai-suggestion-top-p",
      isJudgementAiParamSupported("top_p")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "transcription-ai-suggestion-max-tokens",
      isJudgementAiParamSupported("max_tokens")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "transcription-ai-suggestion-max-completion-tokens",
      isJudgementAiParamSupported("max_completion_tokens")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "transcription-ai-suggestion-presence-penalty",
      isJudgementAiParamSupported("presence_penalty")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "transcription-ai-suggestion-frequency-penalty",
      isJudgementAiParamSupported("frequency_penalty")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "transcription-ai-suggestion-seed",
      isJudgementAiParamSupported("seed")
    );
    toggleJudgementAiAdvancedFieldVisibility(
      "transcription-ai-suggestion-stop-sequences",
      isJudgementAiParamSupported("stop")
    );
    const thinkingNode = getElement("transcription-ai-suggestion-enable-thinking");
    if (thinkingNode && thinkingNode.parentElement) {
      thinkingNode.parentElement.classList.toggle(
        "hidden",
        isJudgementAiParamSupported("enable_thinking") !== true
      );
    }
  }

  function renderJudgementAiAdvancedPanel() {
    const panel = getElement("judgement-ai-advanced-panel");
    if (panel) {
      panel.classList.toggle("hidden", judgementAiAdvancedUnlocked !== true);
    }
    const statusNode = getElement("judgement-ai-advanced-unlock-status");
    if (!statusNode) {
      return;
    }
    statusNode.classList.toggle("hidden", judgementAiAdvancedUnlocked !== true);
    if (judgementAiAdvancedUnlocked) {
      statusNode.textContent = "AI 高级设置已显示；这些设置仅影响普通话语音判别脚本。";
    } else {
      statusNode.textContent = "";
    }
  }

  function unlockJudgementAiAdvancedPanel() {
    if (judgementAiAdvancedUnlocked) {
      return;
    }
    judgementAiAdvancedUnlocked = true;
    renderJudgementAiAdvancedPanel();
    setStatus(
      "judgement-status",
      "AI 高级设置已显示；这些设置仅影响普通话语音判别脚本。"
    );
  }

  function normalizeJudgementRateStep(value, fallback) {
    const allowedValues = [0.1, 0.25, 0.5, 1];
    const numericValue = Number(value);
    if (allowedValues.indexOf(numericValue) >= 0) {
      return numericValue;
    }

    return allowedValues.indexOf(fallback) >= 0 ? fallback : 0.25;
  }

  function normalizeJudgementSeekStep(value, fallback) {
    const allowedValues = [0.1, 0.25, 0.5, 1];
    const numericValue = Number(value);
    if (allowedValues.indexOf(numericValue) >= 0) {
      return numericValue;
    }

    return allowedValues.indexOf(fallback) >= 0 ? fallback : 0.5;
  }

  function normalizeTranscriptionRateStep(value, fallback) {
    const allowedValues = [0.1, 0.25, 0.5, 1];
    const numericValue = Number(value);
    if (allowedValues.indexOf(numericValue) >= 0) {
      return numericValue;
    }
    return allowedValues.indexOf(fallback) >= 0 ? fallback : 0.1;
  }

  function normalizeTranscriptionSeekStep(value, fallback) {
    const allowedValues = [0.5, 1, 2, 3, 5];
    const numericValue = Number(value);
    if (allowedValues.indexOf(numericValue) >= 0) {
      return numericValue;
    }
    return allowedValues.indexOf(fallback) >= 0 ? fallback : 1;
  }

  function hasOwn(target, key) {
    return Boolean(target) && Object.prototype.hasOwnProperty.call(target, key);
  }

  function formatBackendModeLabel(settings) {
    const currentMode = getBackendModeFromSettings(settings || {});
    return buildBackendModeDisplayText(currentMode, settings || {});
  }

  function isLabelxScript(scriptId) {
    return scriptId === transcriptionProjectId || scriptId === judgementProjectId;
  }

  function isDataBakerScript(scriptId) {
    return scriptId === dataBakerRoundOneQualityScriptId;
  }

  function isDataBakerCvpcScript(scriptId) {
    return scriptId === dataBakerCvpcLiuzhouScriptId;
  }

  function isBytedanceAidpScript(scriptId) {
    return (
      scriptId === bytedanceAidpSuzhouScriptId || scriptId === bytedanceAidpJinhuaScriptId
    );
  }

  function isMagicDataScript(scriptId) {
    return (
      scriptId === magicDataAnnotatorScriptId ||
      scriptId === magicDataMinnanScriptId ||
      scriptId === magicDataHangzhouScriptId
    );
  }

  function getScriptsByPlatformId(platformId) {
    return Object.keys(scriptLibrary || {})
      .map(function (scriptId) {
        const script = scriptLibrary[scriptId] || {};
        return {
          id: scriptId,
          platformId: script.platformId || null,
        };
      })
      .filter(function (item) {
        return item.platformId === platformId;
      });
  }

  function getPlatformScriptIds(platformId) {
    return getScriptsByPlatformId(platformId).map(function (item) {
      return item.id;
    });
  }

  function isExclusivePlatform(platformId) {
    return platformId === "magicData" || platformId === "aishellTech";
  }

  function isAbakaAiScript(scriptId) {
    return scriptId === abakaAiTaskPageCaptureScriptId;
  }

  function isHaitianUtransScript(scriptId) {
    return scriptId === haitianUtransAudioDownloadHelperScriptId;
  }

  function isAishellTechScript(scriptId) {
    return (
      scriptId === aishellTechMinnanScriptId ||
      scriptId === aishellTechVietnameseScriptId ||
      scriptId === aishellTechThaiScriptId ||
      scriptId === aishellTechCantoneseScriptId ||
      scriptId === aishellTechCnEnShortDramaScriptId
    );
  }

  function isAishellTechVietnameseScript(scriptId) {
    return scriptId === aishellTechVietnameseScriptId;
  }

  function isAishellTechThaiScript(scriptId) {
    return scriptId === aishellTechThaiScriptId;
  }

  function isJdTtsShanghaineseScript(scriptId) {
    return scriptId === jdTtsShanghaineseScriptId;
  }

  function isAishellTechCantoneseScript(scriptId) {
    return scriptId === aishellTechCantoneseScriptId;
  }

  function isAishellTechCnEnShortDramaScript(scriptId) {
    return scriptId === aishellTechCnEnShortDramaScriptId;
  }

  function supportsAsrVoiceAiSettings(scriptId) {
    return (
      scriptId === judgementProjectId ||
      scriptId === transcriptionProjectId ||
      scriptId === dataBakerRoundOneQualityScriptId ||
      scriptId === dataBakerCvpcLiuzhouScriptId ||
      isBytedanceAidpScript(scriptId) ||
      isMagicDataScript(scriptId) ||
      isJdTtsShanghaineseScript(scriptId) ||
      (isAishellTechScript(scriptId) && !isAishellTechCnEnShortDramaScript(scriptId))
    );
  }

  function getAsrVoiceAiStatusTargetId(scriptId) {
    if (scriptId === judgementProjectId) {
      return "judgement-status";
    }
    if (scriptId === transcriptionProjectId) {
      return "transcription-status";
    }
    if (scriptId === dataBakerRoundOneQualityScriptId) {
      return "data-baker-status";
    }
    if (scriptId === dataBakerCvpcLiuzhouScriptId) {
      return "data-baker-cvpc-status";
    }
    if (isBytedanceAidpScript(scriptId)) {
      return "bytedance-aidp-status";
    }
    if (isMagicDataScript(scriptId)) {
      return "magic-data-status";
    }
    if (isAishellTechScript(scriptId)) {
      if (isAishellTechCnEnShortDramaScript(scriptId)) {
        return "detail-status";
      }
      return isAishellTechVietnameseScript(scriptId)
        ? "aishell-tech-vietnamese-status"
        : isAishellTechThaiScript(scriptId)
          ? "aishell-tech-thai-status"
          : isAishellTechCantoneseScript(scriptId)
            ? "aishell-tech-cantonese-status"
        : "aishell-tech-status";
    }
    if (isJdTtsShanghaineseScript(scriptId)) {
      return "jd-tts-shanghainese-status";
    }
    return "detail-status";
  }

  function getAsrVoiceAiRevealState(scriptId) {
    const key = String(scriptId || "");
    if (!asrVoiceAiRevealStates[key]) {
      asrVoiceAiRevealStates[key] = {
        clickCount: 0,
        lastClickAt: 0,
        unlocked: false,
      };
    }
    return asrVoiceAiRevealStates[key];
  }

  function isAsrVoiceAiUnlocked(scriptId) {
    return supportsAsrVoiceAiSettings(scriptId);
  }

  function registerAsrVoiceAiRevealClick(scriptId) {
    return supportsAsrVoiceAiSettings(scriptId);
  }

  function isAbakaAiAdvancedUnlocked() {
    return true;
  }

  function registerAbakaAiAdvancedRevealClick() {
    abakaAiAdvancedUnlocked = true;
    return true;
  }

  function updateAbakaAiAdvancedTip() {
    const node = getElement("abaka-ai-advanced-tip");
    if (!node) {
      return;
    }
    node.textContent = "AI 设置默认常显，仅调试时修改。";
  }

  function getAsrVoiceAiDefaultsPath(scriptId) {
    if (scriptId === judgementProjectId) {
      return asrVoiceAiDefaultsPaths.judgement;
    }
    if (scriptId === transcriptionProjectId) {
      return asrVoiceAiDefaultsPaths.transcription;
    }
    if (scriptId === dataBakerRoundOneQualityScriptId) {
      return asrVoiceAiDefaultsPaths.dataBakerRoundOneQuality;
    }
    if (scriptId === dataBakerCvpcLiuzhouScriptId) {
      return asrVoiceAiDefaultsPaths.dataBakerCvpcLiuzhouAssistant;
    }
    if (scriptId === bytedanceAidpSuzhouScriptId) {
      return asrVoiceAiDefaultsPaths.bytedanceAidpSuzhouHelper;
    }
    if (scriptId === bytedanceAidpJinhuaScriptId) {
      return asrVoiceAiDefaultsPaths.bytedanceAidpJinhuaHelper;
    }
    if (scriptId === magicDataAnnotatorScriptId) {
      return asrVoiceAiDefaultsPaths.magicDataAnnotatorAiReview;
    }
    if (scriptId === magicDataMinnanScriptId) {
      return asrVoiceAiDefaultsPaths.magicDataMinnanAssistant;
    }
    if (scriptId === magicDataHangzhouScriptId) {
      return asrVoiceAiDefaultsPaths.magicDataHangzhouAssistant;
    }
    if (scriptId === aishellTechMinnanScriptId) {
      return asrVoiceAiDefaultsPaths.aishellTechMinnanAssistant;
    }
    if (scriptId === aishellTechVietnameseScriptId) {
      return asrVoiceAiDefaultsPaths.aishellTechVietnameseAssistant;
    }
    if (scriptId === aishellTechThaiScriptId) {
      return asrVoiceAiDefaultsPaths.aishellTechThaiAssistant;
    }
    if (scriptId === aishellTechCantoneseScriptId) {
      return asrVoiceAiDefaultsPaths.aishellTechCantoneseAssistant;
    }
    if (scriptId === jdTtsShanghaineseScriptId) {
      return asrVoiceAiDefaultsPaths.jdTtsShanghaineseAssistant;
    }
    return "";
  }

  function getAsrVoiceAiHealthPath(scriptId) {
    return isJdTtsShanghaineseScript(scriptId)
      ? asrVoiceAiHealthPaths.jdTtsShanghaineseAssistant
      : "";
  }


  function buildFallbackAsrVoiceAiDefaults(scriptId) {
    const isBytedanceAidpJinhua =
      scriptId ===
      (typeof bytedanceAidpJinhuaScriptId === "undefined"
        ? "bytedanceAidpJinhuaHelper"
        : bytedanceAidpJinhuaScriptId);
    const useDataBakerStyleDefaults =
      scriptId === dataBakerRoundOneQualityScriptId ||
      scriptId === dataBakerCvpcLiuzhouScriptId ||
      scriptId === bytedanceAidpSuzhouScriptId ||
      isBytedanceAidpJinhua ||
      isMagicDataScript(scriptId) ||
      isAishellTechScript(scriptId) ||
      isJdTtsShanghaineseScript(scriptId);
    const useDataBakerPromptDefaults =
      scriptId === dataBakerRoundOneQualityScriptId ||
      scriptId === dataBakerCvpcLiuzhouScriptId ||
      isAishellTechScript(scriptId) ||
      isJdTtsShanghaineseScript(scriptId);
    const baseDefaults = {
      listenModel: "qwen3.5-omni-flash",
      listenModelOptions:
        useDataBakerStyleDefaults
          ? clone(dataBakerListenModelOptions)
          : [],
      compareModel: "qwen3.5-plus",
      compareModelOptions:
        useDataBakerStyleDefaults
          ? clone(dataBakerCompareModelOptions)
          : [],
      singleModel: "qwen3.5-omni-flash",
      singleModelOptions:
        useDataBakerStyleDefaults
          ? clone(dataBakerSingleModelOptions)
          : [],
      funAsrModel: "fun-asr",
      omniModel: "qwen3.5-omni-flash",
      reviewModel: "",
      pipelineMode: useDataBakerStyleDefaults ? "two_stage" : "",
      supportedPipelineModes: [],
      timeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
      enableThinking: false,
      temperature: 0.1,
      top_p: 0.8,
      max_tokens: 1200,
      max_completion_tokens: "",
      presence_penalty: 0,
      frequency_penalty: 0,
      seed: "",
      stop: "",
      webSearchEnabled: scriptId === judgementProjectId,
      listenPrompt: useDataBakerPromptDefaults ? dataBakerDefaultListenPrompt : "",
      comparePrompt: useDataBakerPromptDefaults ? dataBakerDefaultComparePrompt : "",
      reviewPrompt: "",
    };
    const supportedParams = {
      temperature: true,
      top_p: true,
      max_tokens: true,
      max_completion_tokens: true,
      presence_penalty: true,
      frequency_penalty: true,
      seed: true,
      stop: true,
      enable_thinking: false,
      web_search: scriptId === judgementProjectId,
      reasoning_effort: false,
      response_format: false,
    };

    if (isMagicDataScript(scriptId)) {
      const defaultCompareModel =
        scriptId === magicDataMinnanScriptId ? "qwen3.5-plus" : "qwen3.5-flash";
      baseDefaults.reviewModel = defaultCompareModel;
      baseDefaults.compareModel = defaultCompareModel;
    }
    if (scriptId === aishellTechVietnameseScriptId) {
      baseDefaults.pipelineMode = "omni_single";
      baseDefaults.singlePrompt = aishellTechVietnameseDefaultSinglePrompt;
      baseDefaults.stages = {
        recognize: {
          model: "qwen3.5-omni-flash",
          modelOptions: clone(dataBakerSingleModelOptions),
          prompt: aishellTechVietnameseDefaultSinglePrompt,
          temperature: 0.1,
          top_p: 0.8,
          max_tokens: 1200,
          max_completion_tokens: "",
          presence_penalty: 0,
          frequency_penalty: 0,
          seed: "",
          stop: "",
        },
      };
      return {
        defaults: baseDefaults,
        supportedParams: supportedParams,
        loadedFromBackend: false,
        error: "",
      };
    }
    if (scriptId === aishellTechThaiScriptId) {
      baseDefaults.pipelineMode = "omni_single";
      baseDefaults.singlePrompt = aishellTechThaiDefaultSinglePrompt;
      baseDefaults.stages = {
        recognize: {
          model: "qwen3.5-omni-flash",
          modelOptions: clone(dataBakerSingleModelOptions),
          prompt: aishellTechThaiDefaultSinglePrompt,
          temperature: 0.1,
          top_p: 0.8,
          max_tokens: 1200,
          max_completion_tokens: "",
          presence_penalty: 0,
          frequency_penalty: 0,
          seed: "",
          stop: "",
        },
      };
      return {
        defaults: baseDefaults,
        supportedParams: supportedParams,
        loadedFromBackend: false,
        error: "",
      };
    }
    if (isJdTtsShanghaineseScript(scriptId)) {
      baseDefaults.pipelineMode = "omni_single";
      baseDefaults.singleModel = "qwen3.5-omni-plus";
      baseDefaults.singleModelOptions = [
        { value: "qwen3.5-omni-plus", label: "qwen3.5-omni-plus" },
        { value: "qwen3.5-omni-flash", label: "qwen3.5-omni-flash" },
      ];
      baseDefaults.singlePrompt = "";
      baseDefaults.stages = {
        recognize: {
          model: baseDefaults.singleModel,
          modelOptions: clone(baseDefaults.singleModelOptions),
          prompt: baseDefaults.singlePrompt,
        },
      };
      return { defaults: baseDefaults, supportedParams: supportedParams, loadedFromBackend: false, error: "" };
    }
    if (scriptId === aishellTechCantoneseScriptId) {
      baseDefaults.pipelineMode = "omni_single";
      baseDefaults.singleModel = "qwen3.5-omni-plus";
      baseDefaults.singleModelOptions = [
        { value: "qwen3.5-omni-plus", label: "qwen3.5-omni-plus" },
        { value: "qwen3.5-omni-flash", label: "qwen3.5-omni-flash" },
      ];
      baseDefaults.singlePrompt = constants.AISHELL_TECH_CANTONESE_DEFAULT_SINGLE_PROMPT || "";
      baseDefaults.stages = {
        recognize: {
          model: baseDefaults.singleModel,
          modelOptions: clone(baseDefaults.singleModelOptions),
          prompt: baseDefaults.singlePrompt,
        },
      };
      return { defaults: baseDefaults, supportedParams: supportedParams, loadedFromBackend: false, error: "" };
    }
    if (isAishellTechScript(scriptId)) {
      baseDefaults.compareFamily = "qwen";
      baseDefaults.stages = {
        convert: {
          model: "qwen3.5-plus",
          modelOptions: clone(dataBakerCompareModelOptions),
          prompt: "",
          temperature: 0.1,
          top_p: 0.8,
          max_tokens: 1200,
          max_completion_tokens: "",
          presence_penalty: 0,
          frequency_penalty: 0,
          seed: "",
          stop: "",
        },
        listen: {
          model: "qwen3.5-omni-flash",
          modelOptions: clone(dataBakerListenModelOptions),
          prompt: baseDefaults.listenPrompt,
          temperature: 0.1,
          top_p: 0.8,
          max_tokens: 1200,
          max_completion_tokens: "",
          presence_penalty: 0,
          frequency_penalty: 0,
          seed: "",
          stop: "",
        },
        compare: {
          family: "qwen",
          model: "qwen3.5-plus",
          qwenModelOptions: clone(dataBakerCompareModelOptions),
          omniModelOptions: clone(dataBakerSingleModelOptions),
          qwenPrompt: "",
          omniPrompt: "",
          adoptionThreshold: 0.75,
          temperature: 0.1,
          top_p: 0.8,
          max_tokens: 1200,
          max_completion_tokens: "",
          presence_penalty: 0,
          frequency_penalty: 0,
          seed: "",
          stop: "",
        },
      };
    }
    if (scriptId === dataBakerCvpcLiuzhouScriptId) {
      baseDefaults.listenModelOptions = clone(dataBakerCvpcListenModelOptions);
      baseDefaults.stages = {
        listen: {
          model: "qwen3.5-omni-flash",
          modelOptions: clone(dataBakerCvpcListenModelOptions),
          prompt: baseDefaults.listenPrompt,
          temperature: 0.1,
          top_p: 0.8,
          max_tokens: 1200,
          max_completion_tokens: "",
          presence_penalty: 0,
          frequency_penalty: 0,
          seed: "",
          stop: "",
        },
        refine: {
          model: "qwen3.5-plus",
          modelOptions: clone(dataBakerCompareModelOptions),
          prompt: baseDefaults.comparePrompt,
          temperature: 0.1,
          top_p: 0.8,
          max_tokens: 1200,
          max_completion_tokens: "",
          presence_penalty: 0,
          frequency_penalty: 0,
          seed: "",
          stop: "",
        },
      };
    }
    if (scriptId === bytedanceAidpSuzhouScriptId || isBytedanceAidpJinhua) {
      baseDefaults.listenModelOptions = clone(dataBakerCvpcListenModelOptions);
      baseDefaults.stages = {
        listen: {
          model: "qwen3.5-omni-flash",
          modelOptions: clone(dataBakerCvpcListenModelOptions),
          prompt: baseDefaults.listenPrompt,
          temperature: 0.1,
          top_p: 0.8,
          max_tokens: 1200,
          max_completion_tokens: "",
          presence_penalty: 0,
          frequency_penalty: 0,
          seed: "",
          stop: "",
        },
        refine: {
          model: "qwen3.5-plus",
          modelOptions: clone(dataBakerCompareModelOptions),
          prompt: baseDefaults.comparePrompt,
          temperature: 0.1,
          top_p: 0.8,
          max_tokens: 1200,
          max_completion_tokens: "",
          presence_penalty: 0,
          frequency_penalty: 0,
          seed: "",
          stop: "",
        },
      };
    }
    return {
      defaults: baseDefaults,
      supportedParams: supportedParams,
      loadedFromBackend: false,
      error: "",
    };
  }

  function normalizeAsrVoiceAiDefaultsPayload(payload, scriptId) {
    const fallback = buildFallbackAsrVoiceAiDefaults(scriptId);
    const source = payload && typeof payload === "object" ? payload : {};
    const defaults = source.defaults && typeof source.defaults === "object" ? source.defaults : {};
    const supportedParams =
      source.supportedParams && typeof source.supportedParams === "object"
        ? source.supportedParams
        : {};
    const normalizedDefaults = Object.assign({}, fallback.defaults, defaults, {
      enableThinking: false,
    });
    if (isJdTtsShanghaineseScript(scriptId)) {
      const aiOmni = defaults.aiOmni && typeof defaults.aiOmni === "object" ? defaults.aiOmni : {};
      const params = aiOmni.params && typeof aiOmni.params === "object" ? aiOmni.params : {};
      normalizedDefaults.pipelineMode = "omni_single";
      normalizedDefaults.singleModel = normalizeDataBakerSingleModel(
        aiOmni.model,
        fallback.defaults.singleModel || "qwen3.5-omni-plus"
      );
      normalizedDefaults.singlePrompt =
        normalizePromptText(aiOmni.prompt) || fallback.defaults.singlePrompt || "";
      normalizedDefaults.temperature = params.temperature ?? fallback.defaults.temperature;
      normalizedDefaults.top_p = params.top_p ?? fallback.defaults.top_p;
      normalizedDefaults.max_tokens = params.max_tokens ?? fallback.defaults.max_tokens;
      normalizedDefaults.max_completion_tokens =
        params.max_completion_tokens ?? fallback.defaults.max_completion_tokens;
      normalizedDefaults.presence_penalty =
        params.presence_penalty ?? fallback.defaults.presence_penalty;
      normalizedDefaults.frequency_penalty =
        params.frequency_penalty ?? fallback.defaults.frequency_penalty;
      normalizedDefaults.seed = params.seed ?? fallback.defaults.seed;
      normalizedDefaults.stop = params.stop ?? fallback.defaults.stop;
      normalizedDefaults.stages = Object.assign({}, fallback.defaults.stages || {});
      normalizedDefaults.stages.recognize = Object.assign(
        {},
        fallback.defaults.stages?.recognize || {},
        {
          model: normalizedDefaults.singleModel,
          prompt: normalizedDefaults.singlePrompt,
          temperature: normalizedDefaults.temperature,
          top_p: normalizedDefaults.top_p,
          max_tokens: normalizedDefaults.max_tokens,
          max_completion_tokens: normalizedDefaults.max_completion_tokens,
          presence_penalty: normalizedDefaults.presence_penalty,
          frequency_penalty: normalizedDefaults.frequency_penalty,
          seed: normalizedDefaults.seed,
          stop: normalizedDefaults.stop,
        }
      );
    } else if (isAishellTechCantoneseScript(scriptId)) {
      const aiOmni = defaults.aiOmni && typeof defaults.aiOmni === "object" ? defaults.aiOmni : {};
      const params = aiOmni.params && typeof aiOmni.params === "object" ? aiOmni.params : {};
      normalizedDefaults.pipelineMode = "omni_single";
      normalizedDefaults.singleModel = normalizeDataBakerSingleModel(
        aiOmni.model,
        fallback.defaults.singleModel || "qwen3.5-omni-plus"
      );
      normalizedDefaults.singlePrompt =
        normalizePromptText(aiOmni.prompt) || fallback.defaults.singlePrompt || "";
      normalizedDefaults.temperature = params.temperature ?? fallback.defaults.temperature;
      normalizedDefaults.top_p = params.top_p ?? fallback.defaults.top_p;
      normalizedDefaults.max_tokens = params.max_tokens ?? fallback.defaults.max_tokens;
      normalizedDefaults.max_completion_tokens =
        params.max_completion_tokens ?? fallback.defaults.max_completion_tokens;
      normalizedDefaults.presence_penalty =
        params.presence_penalty ?? fallback.defaults.presence_penalty;
      normalizedDefaults.frequency_penalty =
        params.frequency_penalty ?? fallback.defaults.frequency_penalty;
      normalizedDefaults.seed = params.seed ?? fallback.defaults.seed;
      normalizedDefaults.stop = params.stop ?? fallback.defaults.stop;
      normalizedDefaults.stages = Object.assign({}, fallback.defaults.stages || {});
      normalizedDefaults.stages.recognize = Object.assign(
        {},
        fallback.defaults.stages?.recognize || {},
        {
          model: normalizedDefaults.singleModel,
          prompt: normalizedDefaults.singlePrompt,
          temperature: normalizedDefaults.temperature,
          top_p: normalizedDefaults.top_p,
          max_tokens: normalizedDefaults.max_tokens,
          max_completion_tokens: normalizedDefaults.max_completion_tokens,
          presence_penalty: normalizedDefaults.presence_penalty,
          frequency_penalty: normalizedDefaults.frequency_penalty,
          seed: normalizedDefaults.seed,
          stop: normalizedDefaults.stop,
        }
      );
    } else if (isAishellTechVietnameseScript(scriptId)) {
      normalizedDefaults.stages = Object.assign({}, fallback.defaults.stages || {}, defaults.stages || {});
      normalizedDefaults.stages.recognize = Object.assign(
        {},
        fallback.defaults.stages?.recognize || {},
        defaults.stages?.recognize || {}
      );
    } else if (isAishellTechScript(scriptId)) {
      normalizedDefaults.stages = Object.assign({}, fallback.defaults.stages || {}, defaults.stages || {});
      normalizedDefaults.stages.convert = Object.assign(
        {},
        fallback.defaults.stages?.convert || {},
        defaults.stages?.convert || {}
      );
      normalizedDefaults.stages.listen = Object.assign(
        {},
        fallback.defaults.stages?.listen || {},
        defaults.stages?.listen || {}
      );
      normalizedDefaults.stages.compare = Object.assign(
        {},
        fallback.defaults.stages?.compare || {},
        defaults.stages?.compare || {}
      );
    } else if (isDataBakerCvpcScript(scriptId)) {
      normalizedDefaults.stages = Object.assign({}, fallback.defaults.stages || {}, defaults.stages || {});
      normalizedDefaults.stages.listen = Object.assign(
        {},
        fallback.defaults.stages?.listen || {},
        defaults.stages?.listen || {}
      );
      normalizedDefaults.stages.refine = Object.assign(
        {},
        fallback.defaults.stages?.refine || {},
        defaults.stages?.refine || {}
      );
    } else if (isBytedanceAidpScript(scriptId)) {
      normalizedDefaults.stages = Object.assign({}, fallback.defaults.stages || {}, defaults.stages || {});
      normalizedDefaults.stages.listen = Object.assign(
        {},
        fallback.defaults.stages?.listen || {},
        defaults.stages?.listen || {}
      );
      normalizedDefaults.stages.refine = Object.assign(
        {},
        fallback.defaults.stages?.refine || {},
        defaults.stages?.refine || {}
      );
    }
    return {
      defaults: normalizedDefaults,
      supportedParams: Object.assign({}, fallback.supportedParams, supportedParams, {
        enable_thinking: false,
      }),
      loadedFromBackend: source.success === true,
      error: "",
    };
  }

  function getAsrVoiceAiDefaultsCached(scriptId) {
    return asrVoiceAiDefaultsCache[String(scriptId || "")] || buildFallbackAsrVoiceAiDefaults(scriptId);
  }

  async function loadAsrVoiceAiDefaults(scriptId, settings) {
    const key = String(scriptId || "");
    if (asrVoiceAiDefaultsCache[key]) {
      return asrVoiceAiDefaultsCache[key];
    }
    if (asrVoiceAiDefaultsLoading[key]) {
      return asrVoiceAiDefaultsLoading[key];
    }
    const path = getAsrVoiceAiDefaultsPath(scriptId);
    if (!path) {
      const fallback = buildFallbackAsrVoiceAiDefaults(scriptId);
      asrVoiceAiDefaultsCache[key] = fallback;
      return fallback;
    }
    const request = (async function () {
      const pathCandidates = [path];
      try {
        const healthPath = getAsrVoiceAiHealthPath(scriptId);
        if (healthPath) {
          const healthResponse = await fetch(
            buildBackendUrl(healthPath, settings || currentSettings || {}),
            { method: "GET" }
          );
          const healthPayload = await healthResponse.json().catch(function () {
            return null;
          });
          if (!healthResponse.ok || !healthPayload || healthPayload.success !== true) {
            throw new Error("health-check-failed");
          }
        }
        for (const candidatePath of pathCandidates) {
          const endpoint = buildBackendUrl(candidatePath, settings || currentSettings || {});
          const response = await fetch(endpoint, { method: "GET" });
          const payload = await response.json().catch(function () {
            return null;
          });
          if (!response.ok || !payload || payload.success !== true) {
            continue;
          }
          const normalized = normalizeAsrVoiceAiDefaultsPayload(payload, scriptId);
          normalized.error = "";
          asrVoiceAiDefaultsCache[key] = normalized;
          return normalized;
        }
        throw new Error("defaults-fetch-failed");
      } catch (error) {
        const fallback = buildFallbackAsrVoiceAiDefaults(scriptId);
        fallback.error = isAishellTechVietnameseScript(scriptId)
          ? "Aishell 越南语后端默认配置读取失败，已回退到本地单阶段默认值。"
          : isAishellTechScript(scriptId)
            ? "Aishell 后端默认配置读取失败，已回退到本地三板块默认值。"
            : isDataBakerCvpcScript(scriptId)
              ? "CVPC 柳州话后端默认配置读取失败，已回退到本地两阶段默认值。"
              : isBytedanceAidpScript(scriptId)
                ? scriptId === bytedanceAidpJinhuaScriptId
                  ? "ByteDance AIDP 金华话后端默认配置读取失败，已回退到本地两阶段默认值。"
                  : "ByteDance AIDP 苏州话后端默认配置读取失败，已回退到本地两阶段默认值。"
              : isJdTtsShanghaineseScript(scriptId)
                ? "京东 TTS 上海话后端默认配置或健康检查读取失败，已使用本地默认值。"
                : "后端默认配置读取失败，已使用本地默认值。";
        asrVoiceAiDefaultsCache[key] = fallback;
        return fallback;
      } finally {
        delete asrVoiceAiDefaultsLoading[key];
      }
    })();
    asrVoiceAiDefaultsLoading[key] = request;
    return request;
  }

  function getAsrVoiceAiEffectiveText(overrideValue, defaultValue) {
    const overrideText = String(overrideValue || "").trim();
    if (overrideText) {
      return overrideText;
    }
    return String(defaultValue === undefined || defaultValue === null ? "" : defaultValue);
  }

  function updateAsrVoiceAiDefaultsTip(scriptId, defaultsPayload) {
    if (!supportsAsrVoiceAiSettings(scriptId) || !isAsrVoiceAiUnlocked(scriptId)) {
      return;
    }
    const node = getElement("asr-ai-defaults-tip");
    if (!node) {
      return;
    }
    const payload = defaultsPayload || getAsrVoiceAiDefaultsCached(scriptId);
    if (payload.error) {
      node.textContent = payload.error;
      return;
    }
    if (scriptId === magicDataAnnotatorScriptId) {
      node.textContent =
        "已读取后端默认配置。客家话50条评测建议默认：双模型 + 直接识别客家话 + qwen3.5-omni-flash + qwen3.5-flash（thinking 当前已全局固定关闭）。";
      return;
    }
    if (scriptId === dataBakerCvpcLiuzhouScriptId) {
      node.textContent = "已读取后端默认配置。柳州话脚本当前固定为两阶段：听音 + 文本修正。";
      return;
    }
    if (isBytedanceAidpScript(scriptId)) {
      node.textContent =
        scriptId === bytedanceAidpJinhuaScriptId
          ? "已读取后端默认配置。金华话脚本当前固定为两阶段：听音 + 普通话翻译收口。"
          : "已读取后端默认配置。苏州话脚本当前固定为两阶段：听音 + 普通话听写收口。";
      return;
    }
    node.textContent = "已读取后端默认配置；未单独覆盖的字段将沿用后端默认。";
  }

  function normalizeAiRequestTimeoutMs(value, fallback) {
    const number = Number(value);
    const fallbackNumber = Number(fallback);
    let resolved = Number.isFinite(number) ? number : fallbackNumber;
    if (!Number.isFinite(resolved)) {
      resolved = DEFAULT_AI_REQUEST_TIMEOUT_MS;
    }
    if (Math.round(resolved) === LEGACY_DEFAULT_AI_REQUEST_TIMEOUT_MS) {
      resolved = DEFAULT_AI_REQUEST_TIMEOUT_MS;
    }
    return Math.min(300000, Math.max(1000, Math.round(resolved)));
  }

  function normalizeDataBakerTimeoutMs(value) {
    return normalizeAiRequestTimeoutMs(value, DEFAULT_AI_REQUEST_TIMEOUT_MS);
  }

  function normalizeDataBakerCvpcSegmentSilenceThresholdDbfs(value, fallback) {
    const fallbackNumber = Number.isFinite(Number(fallback)) ? Math.round(Number(fallback)) : -27;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallbackNumber;
    }
    const rounded = Math.round(numeric);
    if (rounded < -80 || rounded > -5) {
      return fallbackNumber;
    }
    return rounded;
  }

  function normalizeDataBakerCvpcSegmentSilenceThresholdUnit(value, fallback) {
    const normalizedFallback =
      normalizeText(fallback || "").toLowerCase() === "ratio" ||
      normalizeText(fallback || "").toLowerCase() === "value"
        ? normalizeText(fallback || "").toLowerCase()
        : "db";
    const normalizedValue = normalizeText(value || "").toLowerCase();
    if (
      normalizedValue === "db" ||
      normalizedValue === "ratio" ||
      normalizedValue === "value"
    ) {
      return normalizedValue;
    }
    return normalizedFallback;
  }

  function normalizeDataBakerCvpcSegmentContextPaddingMs(value, fallback) {
    const fallbackNumber = Number.isFinite(Number(fallback)) ? Math.round(Number(fallback)) : 200;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallbackNumber;
    }
    const rounded = Math.round(numeric);
    if (rounded < 0 || rounded > 1500) {
      return fallbackNumber;
    }
    return rounded;
  }

  function normalizeBytedanceAidpSegmentContextPaddingMs(value, fallback) {
    const fallbackNumber = Number.isFinite(Number(fallback)) ? Math.round(Number(fallback)) : 300;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallbackNumber;
    }
    const rounded = Math.round(numeric);
    if (rounded < 0 || rounded > 500) {
      return fallbackNumber;
    }
    return rounded;
  }

  function normalizeBytedanceAidpSegmentSilenceThresholdDbfs(value, fallback) {
    const fallbackNumber = Number.isFinite(Number(fallback)) ? Math.round(Number(fallback)) : -31;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallbackNumber;
    }
    const rounded = Math.round(numeric);
    if (rounded < -80 || rounded > -5) {
      return fallbackNumber;
    }
    return rounded;
  }

  function normalizeBytedanceAidpPlaybackRate(value, fallback) {
    const fallbackNumber = Number.isFinite(Number(fallback)) ? Number(fallback) : 1;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallbackNumber;
    }
    const rounded = Number(numeric.toFixed(2));
    if (bytedanceAidpPlaybackRatePresets.indexOf(rounded) < 0) {
      return fallbackNumber;
    }
    return rounded;
  }

  function normalizeBytedanceAidpFixedWaveZoom(value, fallback) {
    const fallbackNumber = Number.isFinite(Number(fallback)) ? Number(fallback) : 2;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallbackNumber;
    }
    const rounded = Math.round(numeric);
    if (rounded !== numeric || bytedanceAidpFixedWaveZoomPresets.indexOf(rounded) < 0) {
      return fallbackNumber;
    }
    return rounded;
  }

  function convertDataBakerCvpcSegmentThresholdDbfsToDisplayValue(dbfs, unit) {
    const normalizedUnit = normalizeDataBakerCvpcSegmentSilenceThresholdUnit(unit, "db");
    const normalizedDbfs = normalizeDataBakerCvpcSegmentSilenceThresholdDbfs(dbfs, -27);
    if (normalizedUnit === "ratio") {
      return Number((100 * Math.pow(10, normalizedDbfs / 20)).toFixed(2));
    }
    if (normalizedUnit === "value") {
      return Math.max(1, Math.round(32768 * Math.pow(10, normalizedDbfs / 20)));
    }
    return normalizedDbfs;
  }

  function convertDataBakerCvpcSegmentThresholdDisplayValueToDbfs(value, unit, fallbackDbfs) {
    const normalizedUnit = normalizeDataBakerCvpcSegmentSilenceThresholdUnit(unit, "db");
    const normalizedFallback = normalizeDataBakerCvpcSegmentSilenceThresholdDbfs(
      fallbackDbfs,
      -27
    );
    if (normalizedUnit === "db") {
      return normalizeDataBakerCvpcSegmentSilenceThresholdDbfs(value, normalizedFallback);
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return normalizedFallback;
    }
    const dbfs =
      normalizedUnit === "ratio"
        ? 20 * Math.log10(numeric / 100)
        : 20 * Math.log10(numeric / 32768);
    return normalizeDataBakerCvpcSegmentSilenceThresholdDbfs(dbfs, normalizedFallback);
  }

  function getDataBakerCvpcSegmentThresholdInputProfile(unit) {
    const normalizedUnit = normalizeDataBakerCvpcSegmentSilenceThresholdUnit(unit, "db");
    if (normalizedUnit === "ratio") {
      return {
        min: "0.01",
        max: "100",
        step: "0.01",
      };
    }
    if (normalizedUnit === "value") {
      return {
        min: "1",
        max: "32768",
        step: "1",
      };
    }
    return {
      min: "-80",
      max: "-5",
      step: "1",
    };
  }

  function formatDataBakerCvpcSegmentThresholdDisplayValue(value, unit) {
    const normalizedUnit = normalizeDataBakerCvpcSegmentSilenceThresholdUnit(unit, "db");
    if (normalizedUnit === "ratio") {
      return String(Number(Number(value).toFixed(2)));
    }
    if (normalizedUnit === "value") {
      return String(Math.round(Number(value)));
    }
    return String(Math.round(Number(value)));
  }

  function buildDataBakerCvpcSegmentThresholdHelpText(unit, currentDisplayValue, currentDbfs) {
    const normalizedUnit = normalizeDataBakerCvpcSegmentSilenceThresholdUnit(unit, "db");
    const normalizedDbfs = normalizeDataBakerCvpcSegmentSilenceThresholdDbfs(currentDbfs, -27);
    if (normalizedUnit === "ratio") {
      return (
        "当前按 % 输入；例如 4.47% 约等于 -27 dB，当前值约等于 " +
        String(normalizedDbfs) +
        " dB。保存时统一换算成内部 dB 阈值。"
      );
    }
    if (normalizedUnit === "value") {
      return (
        "当前按 Val 输入；例如 1464 Val 约等于 -27 dB，当前值 " +
        String(Math.round(Number(currentDisplayValue) || 0)) +
        " Val 约等于 " +
        String(normalizedDbfs) +
        " dB。保存时统一换算成内部 dB 阈值。"
      );
    }
    return "当前按 dB 输入；保存时统一换算成内部 dB 阈值。";
  }

  function applyDataBakerCvpcSegmentThresholdFieldState(dbfs, unit) {
    const unitNode = getElement("data-baker-cvpc-segment-silence-threshold-unit");
    const valueNode = getElement("data-baker-cvpc-segment-silence-threshold-dbfs");
    const helpNode = getElement("data-baker-cvpc-segment-silence-threshold-help");
    if (!(valueNode instanceof HTMLInputElement)) {
      return;
    }
    const normalizedUnit = normalizeDataBakerCvpcSegmentSilenceThresholdUnit(unit, "db");
    const normalizedDbfs = normalizeDataBakerCvpcSegmentSilenceThresholdDbfs(dbfs, -27);
    const profile = getDataBakerCvpcSegmentThresholdInputProfile(normalizedUnit);
    const displayValue = convertDataBakerCvpcSegmentThresholdDbfsToDisplayValue(
      normalizedDbfs,
      normalizedUnit
    );
    if (unitNode instanceof HTMLSelectElement) {
      unitNode.value = normalizedUnit;
      unitNode.setAttribute("data-prev-unit", normalizedUnit);
    }
    valueNode.min = profile.min;
    valueNode.max = profile.max;
    valueNode.step = profile.step;
    valueNode.value = formatDataBakerCvpcSegmentThresholdDisplayValue(displayValue, normalizedUnit);
    valueNode.setAttribute("data-fallback-dbfs", String(normalizedDbfs));
    if (helpNode instanceof HTMLElement) {
      helpNode.textContent = buildDataBakerCvpcSegmentThresholdHelpText(
        normalizedUnit,
        displayValue,
        normalizedDbfs
      );
    }
  }

  function refreshDataBakerCvpcSegmentThresholdHelpFromForm() {
    const unitNode = getElement("data-baker-cvpc-segment-silence-threshold-unit");
    const valueNode = getElement("data-baker-cvpc-segment-silence-threshold-dbfs");
    const helpNode = getElement("data-baker-cvpc-segment-silence-threshold-help");
    if (
      !(unitNode instanceof HTMLSelectElement) ||
      !(valueNode instanceof HTMLInputElement) ||
      !(helpNode instanceof HTMLElement)
    ) {
      return;
    }
    const normalizedUnit = normalizeDataBakerCvpcSegmentSilenceThresholdUnit(unitNode.value, "db");
    const fallbackDbfs = valueNode.getAttribute("data-fallback-dbfs");
    const currentDbfs = convertDataBakerCvpcSegmentThresholdDisplayValueToDbfs(
      valueNode.value,
      normalizedUnit,
      fallbackDbfs
    );
    helpNode.textContent = buildDataBakerCvpcSegmentThresholdHelpText(
      normalizedUnit,
      valueNode.value,
      currentDbfs
    );
  }

  function normalizeDataBakerPipelineMode(value, fallback) {
    return normalizeDataBakerRecognitionMode(value, fallback);
  }

  function getDataBakerModelText(value) {
    if (value && typeof value === "object") {
      if (typeof value.value === "string") {
        return String(value.value || "").trim();
      }
      if (typeof value.label === "string") {
        return String(value.label || "").trim();
      }
      return "";
    }
    const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
    return text === "[object Object]" ? "" : text;
  }

  function normalizeDataBakerListenModel(value, fallback) {
    const allowed = dataBakerListenModelOptions
      .map(function (item) {
        return getDataBakerModelText(item && typeof item === "object" ? item.value : item);
      })
      .filter(Boolean);
    const normalizedFallback =
      getDataBakerModelText(fallback || "qwen3.5-omni-flash") || "qwen3.5-omni-flash";
    const normalizedValue = getDataBakerModelText(value);
    if (allowed.indexOf(normalizedValue) >= 0) {
      return normalizedValue;
    }
    if (allowed.indexOf(normalizedFallback) >= 0) {
      return normalizedFallback;
    }
    return allowed[0] || normalizedFallback;
  }

  function normalizeDataBakerCvpcListenModel(value, fallback) {
    const allowed = dataBakerCvpcListenModelOptions
      .map(function (item) {
        return getDataBakerModelText(item && typeof item === "object" ? item.value : item);
      })
      .filter(Boolean);
    const normalizedFallback =
      getDataBakerModelText(fallback || "qwen3.5-omni-flash") || "qwen3.5-omni-flash";
    const normalizedValue = getDataBakerModelText(value);
    if (allowed.indexOf(normalizedValue) >= 0) {
      return normalizedValue;
    }
    if (allowed.indexOf(normalizedFallback) >= 0) {
      return normalizedFallback;
    }
    return allowed[0] || normalizedFallback;
  }

  function normalizeDataBakerSingleModel(value, fallback) {
    const allowed = dataBakerSingleModelOptions
      .map(function (item) {
        return getDataBakerModelText(item && typeof item === "object" ? item.value : item);
      })
      .filter(Boolean);
    const normalizedFallback =
      getDataBakerModelText(fallback || "qwen3.5-omni-flash") || "qwen3.5-omni-flash";
    const normalizedValue = getDataBakerModelText(value);
    if (allowed.indexOf(normalizedValue) >= 0) {
      return normalizedValue;
    }
    if (allowed.indexOf(normalizedFallback) >= 0) {
      return normalizedFallback;
    }
    return allowed[0] || normalizedFallback;
  }

  function normalizeDataBakerCompareModel(value, fallback) {
    const allowed = dataBakerCompareModelOptions
      .map(function (item) {
        return getDataBakerModelText(item && typeof item === "object" ? item.value : item);
      })
      .filter(Boolean);
    const normalizedFallback = getDataBakerModelText(fallback || "qwen3.5-plus");
    const fallbackValue =
      allowed.indexOf(normalizedFallback) >= 0 ? normalizedFallback : "qwen3.5-plus";
    const normalizedValue = getDataBakerModelText(value);
    if (allowed.indexOf(normalizedValue) >= 0) {
      return normalizedValue;
    }
    return fallbackValue;
  }

  function normalizeBytedanceAidpJinhuaRefineModel(value, fallback) {
    const allowed = bytedanceAidpJinhuaRefineModelOptions
      .map(function (item) {
        return getDataBakerModelText(item && typeof item === "object" ? item.value : item);
      })
      .filter(Boolean);
    const normalizedFallback = getDataBakerModelText(fallback || "qwen3.5-plus");
    const fallbackValue =
      allowed.indexOf(normalizedFallback) >= 0 ? normalizedFallback : "qwen3.5-plus";
    const normalizedValue = getDataBakerModelText(value);
    if (allowed.indexOf(normalizedValue) >= 0) {
      return normalizedValue;
    }
    return fallbackValue;
  }

  function normalizeBytedanceAidpJinhuaModelMode(value, fallback) {
    const fallbackText = String(fallback || "two_stage").trim().toLowerCase();
    const normalizedFallback = fallbackText === "expert_omni_plus" ? "expert_omni_plus" : "two_stage";
    const text = String(value || "").trim().toLowerCase();
    return text === "expert_omni_plus" ? "expert_omni_plus" : normalizedFallback;
  }

  function dataBakerTimeoutMsToSeconds(value) {
    return Math.round(normalizeDataBakerTimeoutMs(value) / 1000);
  }

  function dataBakerTimeoutSecondsToMs(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds)) {
      return DEFAULT_AI_REQUEST_TIMEOUT_MS;
    }
    return Math.min(300, Math.max(1, Math.round(seconds))) * 1000;
  }

  function formatBytedanceAidpTimeoutSecondsValue(value) {
    const timeoutMs = Math.min(
      DEFAULT_AI_REQUEST_TIMEOUT_MS,
      normalizeDataBakerTimeoutMs(value, DEFAULT_AI_REQUEST_TIMEOUT_MS)
    );
    return String(Number((timeoutMs / 1000).toFixed(3)));
  }

  function normalizeBytedanceAidpTimeoutSecondsToMs(value) {
    const timeoutInput = String(value || "").trim();
    if (!timeoutInput) {
      return DEFAULT_AI_REQUEST_TIMEOUT_MS;
    }
    const seconds = Number(timeoutInput);
    if (!Number.isFinite(seconds)) {
      return DEFAULT_AI_REQUEST_TIMEOUT_MS;
    }
    return Math.min(
      DEFAULT_AI_REQUEST_TIMEOUT_MS,
      Math.max(1, Math.round(Number(timeoutInput || "0") * 1000))
    );
  }

  function normalizeDataBakerPageSize(value, fallback) {
    const text = String(value || "").replace(/\s+/g, "");
    const fallbackText = String(fallback || "50条/页").replace(/\s+/g, "");

    if (dataBakerPageSizeOptions.indexOf(text) >= 0) {
      return text;
    }
    if (dataBakerPageSizeOptions.indexOf(fallbackText) >= 0) {
      return fallbackText;
    }
    return "50条/页";
  }

  function normalizeNullableShortcut(shortcut) {
    const normalized = normalizeShortcut(shortcut);
    return normalized && (normalized.key || typeof normalized.button === "number")
      ? normalized
      : null;
  }

  function normalizeDataBakerShortcuts(shortcuts) {
    const source = shortcuts && typeof shortcuts === "object" ? shortcuts : {};
    const result = {};
    dataBakerShortcutActions.forEach(function (action) {
      result[action.key] = hasOwn(source, action.key)
        ? normalizeNullableShortcut(source[action.key])
        : null;
    });
    return result;
  }

  function normalizeBytedanceAidpShortcuts(shortcuts, fallback) {
    const source = shortcuts && typeof shortcuts === "object" ? shortcuts : {};
    const base = fallback && typeof fallback === "object" ? fallback : {};
    const result = {};
    bytedanceAidpShortcutActions.forEach(function (action) {
      if (hasOwn(source, action.key)) {
        result[action.key] = normalizeNullableShortcut(source[action.key]);
        return;
      }
      result[action.key] = normalizeNullableShortcut(base[action.key]);
    });
    return result;
  }

  function getAishellTechShortcutActions(scriptId) {
    if (isAishellTechCnEnShortDramaScript(scriptId)) {
      return aishellTechCnEnShortDramaShortcutActions;
    }
    return isAishellTechVietnameseScript(scriptId)
      ? aishellTechVietnameseShortcutActions
      : isAishellTechThaiScript(scriptId)
        ? aishellTechThaiShortcutActions
        : isAishellTechCantoneseScript(scriptId)
          ? constants.AISHELL_TECH_CANTONESE_SHORTCUT_ACTIONS || aishellTechThaiShortcutActions
        : aishellTechMinnanShortcutActions;
  }

  function normalizeAishellTechShortcuts(shortcuts, scriptId) {
    const source = shortcuts && typeof shortcuts === "object" ? shortcuts : {};
    const result = {};
    getAishellTechShortcutActions(scriptId).forEach(function (action) {
      result[action.key] = hasOwn(source, action.key)
        ? normalizeNullableShortcut(source[action.key])
        : null;
    });
    return result;
  }

  function normalizeMagicDataModel(value, fallback) {
    const text = String(value || "").replace(/[\r\n]+/g, " ").trim();
    if (!text) {
      return fallback;
    }
    return text.slice(0, 80);
  }

  function normalizeMagicDataReviewMode(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "listen_assisted" || text === "strict_review" || text === "rule_first") {
      return text;
    }
    return fallback || "rule_first";
  }

  function normalizeMagicDataShortcuts(shortcuts) {
    const source = shortcuts && typeof shortcuts === "object" ? shortcuts : {};
    const result = {};
    magicDataShortcutActions.forEach(function (action) {
      result[action.key] = hasOwn(source, action.key)
        ? normalizeNullableShortcut(source[action.key])
        : null;
    });
    return result;
  }

  function createAbakaAiEmptyShortcutMap() {
    const defaults = {};
    abakaAiTask21ShortcutActions.forEach(function (action) {
      defaults[action.key] = null;
    });
    return defaults;
  }

  function normalizeAbakaAiShortcuts(shortcuts, fallback) {
    const source = shortcuts && typeof shortcuts === "object" ? shortcuts : {};
    const base = fallback && typeof fallback === "object" ? fallback : createAbakaAiEmptyShortcutMap();
    const result = {};
    abakaAiTask21ShortcutActions.forEach(function (action) {
      if (hasOwn(source, action.key)) {
        result[action.key] = normalizeNullableShortcut(source[action.key]);
        return;
      }
      result[action.key] = normalizeNullableShortcut(base[action.key]);
    });
    return result;
  }

  function mapLegacyAbakaAiModelName(value) {
    const text = String(value || "").trim();
    const lower = text.toLowerCase();
    if (!text) {
      return "";
    }
    if (lower === "qwen3.6plus") {
      return "qwen3.6-plus";
    }
    if (lower === "qwen-vl-max-latest") {
      return "qwen-vl-max";
    }
    if (lower === "qwen-vl-plus-latest") {
      return "qwen-vl-plus";
    }
    if (lower === "qwen-vl-ocr-latest") {
      return "";
    }
    if (lower === "qvq-plus-latest") {
      return "qwen3.6-plus";
    }
    return text;
  }

  function normalizeAbakaAiModelByOptions(value, fallback, options) {
    const sourceOptions = Array.isArray(options) ? options : [];
    const allowed = sourceOptions
      .map(function (item) {
        return String(item?.value || "").trim();
      })
      .filter(Boolean);
    const rawFallback = fallback === undefined ? "qwen3.6-plus" : String(fallback || "");
    const fallbackModel = mapLegacyAbakaAiModelName(rawFallback).trim();
    const model = mapLegacyAbakaAiModelName(normalizeMagicDataModel(value, fallbackModel));
    if (allowed.length <= 0 || allowed.indexOf(model) >= 0) {
      return model;
    }
    if (fallbackModel && allowed.indexOf(fallbackModel) >= 0) {
      return fallbackModel;
    }
    return allowed.length > 0 ? allowed[0] : fallbackModel;
  }

  function normalizeAbakaAiAnalysisMode(value, fallback) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "single_model") {
      return "single_model";
    }
    if (text === "two_stage") {
      return "two_stage";
    }
    return String(fallback || "two_stage").trim().toLowerCase() === "single_model"
      ? "single_model"
      : "two_stage";
  }

  function normalizeAbakaAiModel(value, fallback, options) {
    return normalizeAbakaAiModelByOptions(value, fallback, options);
  }

  function normalizeAbakaAiTimeout(value, fallback) {
    return normalizeAiRequestTimeoutMs(value, fallback || DEFAULT_AI_REQUEST_TIMEOUT_MS);
  }

  function renderAbakaAiSelectOptions(selectId, selectedValue, options, fallbackValue) {
    const selectNode = getElement(selectId);
    if (!(selectNode instanceof HTMLSelectElement)) {
      return;
    }
    const renderedOptions = Array.isArray(options) ? options.slice() : [];
    if (renderedOptions.length <= 0) {
      renderedOptions.push({
          value: String(fallbackValue || "qwen3.6-plus"),
          label: String(fallbackValue || "qwen3.6-plus"),
        });
      }
      const normalizedSelected = normalizeAbakaAiModelByOptions(
        selectedValue,
        fallbackValue || renderedOptions[0]?.value || "qwen3.6-plus",
        renderedOptions
      );
    if (
      normalizedSelected &&
      !renderedOptions.find(function (item) {
        return String(item?.value || "").trim() === normalizedSelected;
      })
    ) {
      renderedOptions.push({
        value: normalizedSelected,
        label: normalizedSelected + "（已保存，待官方核对）",
      });
    }

    selectNode.innerHTML = renderedOptions
      .map(function (item) {
        const value = String(item?.value || "").trim();
        const label = String(item?.label || value || "").trim();
        return '<option value="' + escapeHtml(value) + '">' + escapeHtml(label || value) + "</option>";
      })
      .join("");
    selectNode.value = normalizedSelected;
    syncOptionsCustomSelectState(selectNode);
  }

  function isMagicDataPresetModel(modelName, presetList) {
    return Array.isArray(presetList) && presetList.indexOf(modelName) >= 0;
  }

  function applyMagicDataModelField(selectId, customInputId, modelName, presetList) {
    const selectNode = getElement(selectId);
    const customNode = getElement(customInputId);
    if (!(selectNode instanceof HTMLSelectElement) || !(customNode instanceof HTMLInputElement)) {
      return;
    }
    const normalizedModel = normalizeMagicDataModel(modelName, "");
    const useCustom = !normalizedModel || !isMagicDataPresetModel(normalizedModel, presetList);
    selectNode.value = useCustom ? "custom" : normalizedModel;
    customNode.value = useCustom ? normalizedModel : "";
    customNode.classList.toggle("hidden", !useCustom);
  }

  function readMagicDataModelField(selectId, customInputId, fallback, presetList) {
    const selectNode = getElement(selectId);
    const customNode = getElement(customInputId);
    if (!(selectNode instanceof HTMLSelectElement) || !(customNode instanceof HTMLInputElement)) {
      return normalizeMagicDataModel(fallback, fallback);
    }
    if (selectNode.value === "custom") {
      return normalizeMagicDataModel(customNode.value, fallback);
    }
    if (isMagicDataPresetModel(selectNode.value, presetList)) {
      return normalizeMagicDataModel(selectNode.value, fallback);
    }
    return normalizeMagicDataModel(fallback, fallback);
  }

  function bindMagicDataModelSelect(selectId, customInputId) {
    const selectNode = getElement(selectId);
    const customNode = getElement(customInputId);
    if (!(selectNode instanceof HTMLSelectElement) || !(customNode instanceof HTMLInputElement)) {
      return;
    }
    selectNode.addEventListener("change", function () {
      const useCustom = selectNode.value === "custom";
      customNode.classList.toggle("hidden", !useCustom);
      if (useCustom) {
        customNode.focus();
      }
    });
  }

  function getMagicDataConfig(settings, scriptId) {
    const targetScriptId = isMagicDataScript(scriptId) ? scriptId : magicDataAnnotatorScriptId;
    const isMinnanScript = targetScriptId === magicDataMinnanScriptId;
    const source = isMinnanScript
      ? settings?.platforms?.magicData?.scripts?.minnanHelper ||
        settings?.scriptCenter?.projects?.magicDataMinnanAssistant ||
        {}
      : targetScriptId === magicDataHangzhouScriptId
        ? settings?.platforms?.magicData?.scripts?.hangzhouHelper ||
          settings?.scriptCenter?.projects?.magicDataHangzhouAssistant ||
          {}
        : settings?.platforms?.magicData?.scripts?.hakkaHelper ||
          settings?.scriptCenter?.projects?.magicDataAnnotator ||
          {};
    const minnanRecognitionMode = normalizeMagicDataMinnanRecognitionMode(
      source.aiReviewRecognitionMode || source.aiReviewPipelineMode || source.pipelineMode,
      "two_stage"
    );
    const hasExplicitRecognitionStrategy =
      hasValidMagicDataRecognitionStrategy(source.aiReviewRecognitionStrategy) ||
      hasValidMagicDataRecognitionStrategy(source.recognitionStrategy);
    const hasExplicitModelMode = (function () {
      const text = String(source.aiReviewModelMode || "").trim().toLowerCase();
      return text === "two_stage" || text === "omni_single";
    })();
    const magicDataModelMode = hasExplicitModelMode
      ? normalizeMagicDataModelMode(source.aiReviewModelMode, "two_stage")
      : normalizeMagicDataModelMode(minnanRecognitionMode, "two_stage");
    const magicDataRecognitionStrategy = hasExplicitRecognitionStrategy
      ? resolveMagicDataRecognitionStrategyFromSource(source, "direct_dialect")
      : normalizeMagicDataRecognitionStrategy(minnanRecognitionMode, "direct_dialect");
    const minnanListenModel = normalizeDataBakerListenModel(
      source.aiReviewListenModel || source.listenModel,
      "qwen3.5-omni-flash"
    );
    const defaultCompareModel = isMinnanScript ? "qwen3.5-plus" : "qwen3.5-flash";
    const minnanCompareModel = normalizeDataBakerCompareModel(
      source.aiReviewCompareModel || source.reviewModel,
      defaultCompareModel
    );
    const minnanSingleModel = normalizeDataBakerSingleModel(
      source.aiReviewSingleModel ||
        (magicDataModelMode === "omni_single" ? source.listenModel : ""),
      "qwen3.5-omni-flash"
    );
    const minnanEnableThinking =
      typeof source.aiReviewEnableThinking === "boolean"
        ? source.aiReviewEnableThinking === true
        : source.enableThinking === true;
    return {
      enabled: source.enabled !== false,
      aiReviewEnabled: source.aiReviewEnabled !== false,
      aiReviewModelMode: magicDataModelMode,
      aiReviewRecognitionStrategy: magicDataRecognitionStrategy,
      aiReviewRecognitionMode: buildMagicDataLegacyRecognitionFields(
        magicDataModelMode,
        magicDataRecognitionStrategy
      ).aiReviewRecognitionMode,
      aiReviewListenModel: minnanListenModel,
      aiReviewCompareModel: minnanCompareModel,
      aiReviewSingleModel: minnanSingleModel,
      aiReviewEnableThinking: minnanEnableThinking,
      listenModel:
        isMinnanScript
          ? minnanListenModel
          : normalizeMagicDataModel(source.listenModel, magicDataDefaultSettings.listenModel),
      reviewModel:
        isMinnanScript
          ? minnanCompareModel
          : normalizeMagicDataModel(source.reviewModel, magicDataDefaultSettings.reviewModel),
      reviewMode: normalizeMagicDataReviewMode(source.reviewMode, magicDataDefaultSettings.reviewMode),
      showHeardText: source.showHeardText !== false,
      showEstimatedIncome: source.showEstimatedIncome !== false,
      enableThinking:
        minnanEnableThinking,
      aiReviewRequestTimeoutMs: normalizeAiRequestTimeoutMs(source.aiReviewRequestTimeoutMs, DEFAULT_AI_REQUEST_TIMEOUT_MS),
      aiReviewListenPrompt: normalizePromptText(source.aiReviewListenPrompt || ""),
      aiReviewComparePrompt: normalizePromptText(source.aiReviewComparePrompt || ""),
      aiReviewTemperature: normalizeOptionalNumberText(source.aiReviewTemperature, 0, 2, 3),
      aiReviewTopP: normalizeOptionalNumberText(source.aiReviewTopP, 0, 1, 3),
      aiReviewMaxTokens: normalizeOptionalIntegerText(source.aiReviewMaxTokens, 1, 8192),
      aiReviewMaxCompletionTokens: normalizeOptionalIntegerText(
        source.aiReviewMaxCompletionTokens,
        1,
        8192
      ),
      aiReviewPresencePenalty: normalizeOptionalNumberText(source.aiReviewPresencePenalty, -2, 2, 3),
      aiReviewFrequencyPenalty: normalizeOptionalNumberText(source.aiReviewFrequencyPenalty, -2, 2, 3),
      aiReviewSeed: normalizeOptionalIntegerText(source.aiReviewSeed, 0, 2147483647),
      aiReviewStopSequences: normalizeStopSequencesText(source.aiReviewStopSequences || ""),
      shortcuts: normalizeMagicDataShortcuts(source.shortcuts),
    };
  }

  function getLabelxActiveScriptId(settings) {
    return settings?.platforms?.alibabaLabelx?.scriptCenter?.activeProjectId || transcriptionProjectId;
  }

  function getMagicDataActiveScriptId(settings) {
    const candidate = String(settings?.platforms?.magicData?.activeScriptId || "").trim();
    if (
      candidate === magicDataAnnotatorScriptId ||
      candidate === magicDataMinnanScriptId ||
      candidate === magicDataHangzhouScriptId
    ) {
      return candidate;
    }
    return "";
  }

  function getBytedanceAidpActiveScriptId(settings) {
    const candidate = String(settings?.platforms?.bytedanceAidp?.activeScriptId || "").trim();
    if (candidate === bytedanceAidpSuzhouScriptId || candidate === bytedanceAidpJinhuaScriptId) {
      return candidate;
    }
    const suzhouConfig = getBytedanceAidpSuzhouConfig(settings);
    const jinhuaConfig = getBytedanceAidpJinhuaConfig(settings);
    const suzhouEnabled = suzhouConfig.enabled !== false;
    const jinhuaEnabled = jinhuaConfig.enabled !== false;
    if (suzhouEnabled && !jinhuaEnabled) {
      return bytedanceAidpSuzhouScriptId;
    }
    if (!suzhouEnabled && jinhuaEnabled) {
      return bytedanceAidpJinhuaScriptId;
    }
    return suzhouEnabled ? bytedanceAidpSuzhouScriptId : "";
  }

  function getAishellTechActiveScriptId(settings) {
    const candidate = String(settings?.platforms?.aishellTech?.activeScriptId || "").trim();
    if (
      candidate === aishellTechMinnanScriptId ||
      candidate === aishellTechVietnameseScriptId ||
      candidate === aishellTechThaiScriptId ||
      candidate === aishellTechCantoneseScriptId ||
      candidate === aishellTechCnEnShortDramaScriptId
    ) {
      return candidate;
    }
    const minnanConfig = settings?.platforms?.aishellTech?.scripts?.minnanHelper || {};
    const vietnameseConfig = settings?.platforms?.aishellTech?.scripts?.vietnameseHelper || {};
    const thaiConfig = settings?.platforms?.aishellTech?.scripts?.thaiHelper || {};
    const cantoneseConfig = settings?.platforms?.aishellTech?.scripts?.cantoneseHelper || {};
    const cnEnShortDramaConfig = settings?.platforms?.aishellTech?.scripts?.cnEnShortDrama || {};
    const minnanEnabled =
      minnanConfig.enabled !== false && minnanConfig.aiRecommendEnabled !== false;
    const vietnameseEnabled =
      vietnameseConfig.enabled !== false && vietnameseConfig.aiRecommendEnabled !== false;
    const thaiEnabled =
      thaiConfig.enabled !== false && thaiConfig.aiRecommendEnabled !== false;
    const cantoneseEnabled =
      cantoneseConfig.enabled !== false && cantoneseConfig.aiRecommendEnabled !== false;
    const cnEnShortDramaEnabled = cnEnShortDramaConfig.enabled !== false;
    if (minnanEnabled && !vietnameseEnabled && !thaiEnabled && !cnEnShortDramaEnabled) {
      return aishellTechMinnanScriptId;
    }
    if (!minnanEnabled && vietnameseEnabled && !thaiEnabled && !cnEnShortDramaEnabled) {
      return aishellTechVietnameseScriptId;
    }
    if (!minnanEnabled && !vietnameseEnabled && thaiEnabled && !cnEnShortDramaEnabled) {
      return aishellTechThaiScriptId;
    }
    if (!minnanEnabled && !vietnameseEnabled && !thaiEnabled && cantoneseEnabled && !cnEnShortDramaEnabled) {
      return aishellTechCantoneseScriptId;
    }
    if (!minnanEnabled && !vietnameseEnabled && !thaiEnabled && cnEnShortDramaEnabled) {
      return aishellTechCnEnShortDramaScriptId;
    }
    return minnanEnabled
      ? aishellTechMinnanScriptId
      : vietnameseEnabled
        ? aishellTechVietnameseScriptId
        : thaiEnabled
          ? aishellTechThaiScriptId
          : cantoneseEnabled
            ? aishellTechCantoneseScriptId
          : cnEnShortDramaEnabled
            ? aishellTechCnEnShortDramaScriptId
          : "";
  }

  function getDataBakerRoundOneConfig(settings) {
    const defaults =
      constants.DEFAULT_SETTINGS?.platforms?.dataBaker?.scripts?.roundOneQuality || {};
    const current =
      settings?.platforms?.dataBaker?.scripts?.roundOneQuality || {};

    const config = Object.assign(
        {
          id: dataBakerRoundOneQualityScriptId,
          enabled: true,
          aiRecommendEnabled: true,
          aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
          aiRecommendPipelineMode: "two_stage",
          aiQualifiedAutofillConcurrency: 5,
          aiQualifiedAutofillWaitAllBeforeFill: false,
          aiRecommendListenModel: "qwen3.5-omni-flash",
          aiRecommendCompareModel: "qwen3.5-plus",
          aiRecommendSingleModel: "qwen3.5-omni-flash",
          aiRecommendEnableThinking: false,
        aiRecommendListenPrompt: "",
        aiRecommendComparePrompt: "",
        aiRecommendTemperature: "",
        aiRecommendTopP: "",
        aiRecommendMaxTokens: "",
        aiRecommendMaxCompletionTokens: "",
        aiRecommendPresencePenalty: "",
        aiRecommendFrequencyPenalty: "",
        aiRecommendSeed: "",
        aiRecommendStopSequences: "",
        autoPageSizeEnabled: true,
        defaultPageSize: "50条/页",
        shortcuts: {},
      },
      defaults,
      current
    );

    config.aiRecommendRequestTimeoutMs = normalizeDataBakerTimeoutMs(
      config.aiRecommendRequestTimeoutMs
    );
      const defaultRecognitionMode = normalizeDataBakerRecognitionMode(
        defaults.aiRecommendPipelineMode,
        "two_stage"
      );
      const defaultListenModel = normalizeDataBakerListenModel(
        defaults.aiRecommendListenModel,
        "qwen3.5-omni-flash"
      );
      const defaultSingleModel = normalizeDataBakerSingleModel(
        defaults.aiRecommendSingleModel || defaults.aiRecommendListenModel,
        "qwen3.5-omni-flash"
      );
      const rawRecognitionMode = getDataBakerModelText(config.aiRecommendPipelineMode);
      const normalizedRecognitionMode = normalizeDataBakerRecognitionMode(
        config.aiRecommendPipelineMode,
        defaultRecognitionMode
      );
      config.aiRecommendListenModel = normalizeDataBakerListenModel(
        config.aiRecommendListenModel,
        rawRecognitionMode === "fun_asr_compare"
          ? "fun-asr"
          : normalizedRecognitionMode === "two_stage" &&
              isDataBakerFunAsrListenModel(config.aiRecommendListenModel)
            ? "fun-asr"
            : defaultListenModel
      );
      config.aiRecommendSingleModel = normalizeDataBakerSingleModel(
        config.aiRecommendSingleModel ||
          (normalizedRecognitionMode === "omni_single"
            ? isDataBakerFunAsrListenModel(config.aiRecommendListenModel)
              ? "qwen3.5-omni-flash"
              : config.aiRecommendListenModel
            : ""),
        defaultSingleModel
      );
      config.aiRecommendPipelineMode = normalizedRecognitionMode;
    config.aiQualifiedAutofillConcurrency = normalizeDataBakerAutofillConcurrency(
      config.aiQualifiedAutofillConcurrency,
      {
        aiRecommendPipelineMode: config.aiRecommendPipelineMode,
        aiRecommendListenModel: config.aiRecommendListenModel,
        aiRecommendSingleModel: config.aiRecommendSingleModel,
      }
    );
    config.aiQualifiedAutofillWaitAllBeforeFill =
      config.aiQualifiedAutofillWaitAllBeforeFill === true;
    config.aiRecommendCompareModel = normalizeDataBakerCompareModel(
      config.aiRecommendCompareModel,
      "qwen3.5-plus"
    );
    config.aiRecommendEnableThinking = config.aiRecommendEnableThinking === true;
    config.aiRecommendListenPrompt = normalizePromptText(config.aiRecommendListenPrompt || "");
    config.aiRecommendComparePrompt = normalizePromptText(config.aiRecommendComparePrompt || "");
    config.aiRecommendTemperature = normalizeOptionalNumberText(config.aiRecommendTemperature, 0, 2, 3);
    config.aiRecommendTopP = normalizeOptionalNumberText(config.aiRecommendTopP, 0, 1, 3);
    config.aiRecommendMaxTokens = normalizeOptionalIntegerText(config.aiRecommendMaxTokens, 1, 8192);
    config.aiRecommendMaxCompletionTokens = normalizeOptionalIntegerText(
      config.aiRecommendMaxCompletionTokens,
      1,
      8192
    );
    config.aiRecommendPresencePenalty = normalizeOptionalNumberText(
      config.aiRecommendPresencePenalty,
      -2,
      2,
      3
    );
    config.aiRecommendFrequencyPenalty = normalizeOptionalNumberText(
      config.aiRecommendFrequencyPenalty,
      -2,
      2,
      3
    );
    config.aiRecommendSeed = normalizeOptionalIntegerText(config.aiRecommendSeed, 0, 2147483647);
    config.aiRecommendStopSequences = normalizeStopSequencesText(config.aiRecommendStopSequences || "");
    config.autoPageSizeEnabled = config.autoPageSizeEnabled !== false;
    config.defaultPageSize = normalizeDataBakerPageSize(config.defaultPageSize, "50条/页");
    config.shortcuts = normalizeDataBakerShortcuts(config.shortcuts);
    return config;
  }

  function getDataBakerCvpcLiuzhouConfig(settings) {
    const defaults =
      constants.DEFAULT_SETTINGS?.platforms?.dataBakerCvpc?.scripts?.liuzhouAssistant || {};
    const current =
      settings?.platforms?.dataBakerCvpc?.scripts?.liuzhouAssistant || {};

    const config = Object.assign(
      {
        id: dataBakerCvpcLiuzhouScriptId,
        enabled: true,
        segmentPreviewEnabled: true,
        segmentPreviewAutoApplyEnabled: true,
        aiRecommendAutoFillEnabled: true,
        recommendationValidityAutoCorrectEnabled: true,
        segmentContextPaddingMs: 200,
        segmentSilenceThresholdDbfs: -27,
        segmentSilenceThresholdUnit: "db",
        blockNewTabEditingTips: true,
        blockPauseStateTips: true,
        segmentPreviewEndpoint:
          constants.DATA_BAKER_CVPC_SEGMENT_PREVIEW_SERVER_ENDPOINT ||
          String(defaultBackendBaseUrls.server || "").replace(/\/+$/, "") +
            "/api/data-baker-cvpc/liuzhou-helper/segment/preview",
        aiRecommendEnabled: true,
        aiRecommendEndpoint:
          constants.DATA_BAKER_CVPC_AI_RECOMMEND_SERVER_ENDPOINT ||
          String(defaultBackendBaseUrls.server || "").replace(/\/+$/, "") +
            "/api/data-baker-cvpc/liuzhou-helper/ai/recommend",
        aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
        aiRecommendListenModel: "qwen3.5-omni-flash",
        aiRecommendListenPrompt: "",
        aiRecommendListenIncludeLexiconReference: false,
        aiRecommendListenTemperature: "",
        aiRecommendListenTopP: "",
        aiRecommendListenMaxTokens: "",
        aiRecommendListenMaxCompletionTokens: "",
        aiRecommendListenPresencePenalty: "",
        aiRecommendListenFrequencyPenalty: "",
        aiRecommendListenSeed: "",
        aiRecommendListenStopSequences: "",
        aiRecommendRefineModel: "qwen3.5-plus",
        aiRecommendRefinePrompt: "",
        aiRecommendRefineTemperature: "",
        aiRecommendRefineTopP: "",
        aiRecommendRefineMaxTokens: "",
        aiRecommendRefineMaxCompletionTokens: "",
        aiRecommendRefinePresencePenalty: "",
        aiRecommendRefineFrequencyPenalty: "",
        aiRecommendRefineSeed: "",
        aiRecommendRefineStopSequences: "",
        contractMode: "dom-guarded",
        shortcuts: {},
      },
      clone(defaults),
      clone(current)
    );

    config.id = dataBakerCvpcLiuzhouScriptId;
    config.enabled = config.enabled !== false;
    config.segmentPreviewEnabled = config.segmentPreviewEnabled !== false;
    config.segmentPreviewAutoApplyEnabled =
      config.segmentPreviewAutoApplyEnabled === false ? false : true;
    config.aiRecommendAutoFillEnabled =
      config.aiRecommendAutoFillEnabled === false ? false : true;
    config.recommendationValidityAutoCorrectEnabled =
      config.recommendationValidityAutoCorrectEnabled === false ? false : true;
    config.segmentContextPaddingMs = normalizeDataBakerCvpcSegmentContextPaddingMs(
      config.segmentContextPaddingMs,
      defaults.segmentContextPaddingMs
    );
    config.segmentSilenceThresholdDbfs = normalizeDataBakerCvpcSegmentSilenceThresholdDbfs(
      config.segmentSilenceThresholdDbfs,
      defaults.segmentSilenceThresholdDbfs
    );
    config.segmentSilenceThresholdUnit = normalizeDataBakerCvpcSegmentSilenceThresholdUnit(
      config.segmentSilenceThresholdUnit,
      defaults.segmentSilenceThresholdUnit
    );
    config.blockNewTabEditingTips =
      config.blockNewTabEditingTips !== undefined
        ? config.blockNewTabEditingTips !== false
        : config.blockEditingTabTips !== false;
    config.blockPauseStateTips =
      config.blockPauseStateTips !== undefined
        ? config.blockPauseStateTips !== false
        : config.blockEditingTabTips !== false;
    delete config.blockEditingTabTips;
    config.aiRecommendEnabled = config.aiRecommendEnabled !== false;
    config.aiRecommendRequestTimeoutMs = normalizeDataBakerTimeoutMs(
      config.aiRecommendRequestTimeoutMs
    );
    config.aiRecommendListenModel = normalizeDataBakerListenModel(
      config.aiRecommendListenModel || config.aiRecommendModel,
      "qwen3.5-omni-flash"
    );
    config.aiRecommendListenPrompt = normalizePromptText(config.aiRecommendListenPrompt || "");
    config.aiRecommendListenIncludeLexiconReference =
      config.aiRecommendListenIncludeLexiconReference === true;
    normalizeAishellTechStageParamFields(config, "aiRecommendListen");
    config.aiRecommendRefineModel = normalizeDataBakerCompareModel(
      config.aiRecommendRefineModel,
      "qwen3.5-plus"
    );
    config.aiRecommendRefinePrompt = normalizePromptText(config.aiRecommendRefinePrompt || "");
    normalizeAishellTechStageParamFields(config, "aiRecommendRefine");
    delete config.aiRecommendModel;
    config.contractMode = normalizeText(config.contractMode || "dom-guarded") || "dom-guarded";
    config.segmentPreviewEndpoint = normalizeText(config.segmentPreviewEndpoint);
    config.aiRecommendEndpoint = normalizeText(config.aiRecommendEndpoint);
    config.shortcuts = config.shortcuts && typeof config.shortcuts === "object"
      ? clone(config.shortcuts)
      : {};
    return config;
  }

  function getBytedanceAidpConfigMeta(scriptId) {
    if (scriptId === bytedanceAidpJinhuaScriptId) {
      return {
        scriptId: bytedanceAidpJinhuaScriptId,
        scriptKey: "jinhuaHelper",
        aiRecommendPath:
          constants.BYTEDANCE_AIDP_JINHUA_AI_RECOMMEND_PATH ||
          "/api/bytedance-aidp/jinhua-helper/ai/recommend",
        defaultAiEnabled: false,
      };
    }
    return {
      scriptId: bytedanceAidpSuzhouScriptId,
      scriptKey: "suzhouHelper",
      aiRecommendPath:
        constants.BYTEDANCE_AIDP_SUZHOU_AI_RECOMMEND_PATH ||
        "/api/bytedance-aidp/suzhou-helper/ai/recommend",
      defaultAiEnabled: true,
    };
  }

  function getBytedanceAidpConfig(settings, scriptId) {
    const meta = getBytedanceAidpConfigMeta(scriptId);
    const defaults =
      constants.DEFAULT_SETTINGS?.platforms?.bytedanceAidp?.scripts?.[meta.scriptKey] || {};
    const current = settings?.platforms?.bytedanceAidp?.scripts?.[meta.scriptKey] || {};

    const config = Object.assign(
      {
        id: meta.scriptId,
        enabled: meta.scriptId === bytedanceAidpJinhuaScriptId ? false : true,
        platformAiEnabled: false,
        segmentContextPaddingMs: 300,
        segmentSilenceThresholdDbfs: -31,
        mergeContiguousSuggestedSegmentsEnabled: true,
        segmentPreviewAutoApplyEnabled: true,
        aiRecommendEnabled: meta.defaultAiEnabled,
        aiRecommendAutoFillEnabled: true,
        aiRecommendEndpoint: buildBackendUrl(
          meta.aiRecommendPath,
          currentSettings || settings || {}
        ),
        aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
        aiRecommendModelMode:
          meta.scriptId === bytedanceAidpJinhuaScriptId ? "two_stage" : undefined,
        aiRecommendListenModel: "qwen3.5-omni-flash",
        aiRecommendListenPrompt: "",
        aiRecommendListenTemperature: "",
        aiRecommendListenTopP: "",
        aiRecommendListenMaxTokens: "",
        aiRecommendListenMaxCompletionTokens: "",
        aiRecommendListenPresencePenalty: "",
        aiRecommendListenFrequencyPenalty: "",
        aiRecommendListenSeed: "",
        aiRecommendListenStopSequences: "",
        aiRecommendRefineModel: "qwen3.5-plus",
        aiRecommendRefinePrompt: "",
        aiRecommendRefineTemperature: "",
        aiRecommendRefineTopP: "",
        aiRecommendRefineMaxTokens: "",
        aiRecommendRefineMaxCompletionTokens: "",
        aiRecommendRefinePresencePenalty: "",
        aiRecommendRefineFrequencyPenalty: "",
        aiRecommendRefineSeed: "",
        aiRecommendRefineStopSequences: "",
        defaultPlaybackRate: 1,
        fixedWaveZoom: 2,
        contractMode: "dom-guarded",
        shortcuts: {},
      },
      clone(defaults),
      clone(current)
    );

    config.id = meta.scriptId;
    config.enabled = config.enabled !== false;
    config.platformAiEnabled = config.platformAiEnabled !== false;
    config.segmentContextPaddingMs = normalizeBytedanceAidpSegmentContextPaddingMs(
      config.segmentContextPaddingMs,
      defaults.segmentContextPaddingMs
    );
    config.segmentSilenceThresholdDbfs = normalizeBytedanceAidpSegmentSilenceThresholdDbfs(
      config.segmentSilenceThresholdDbfs,
      defaults.segmentSilenceThresholdDbfs
    );
    config.mergeContiguousSuggestedSegmentsEnabled =
      config.mergeContiguousSuggestedSegmentsEnabled === false ? false : true;
    config.segmentPreviewAutoApplyEnabled =
      config.segmentPreviewAutoApplyEnabled === false ? false : true;
    config.aiRecommendEnabled = config.aiRecommendEnabled !== false;
    config.aiRecommendAutoFillEnabled =
      config.aiRecommendAutoFillEnabled === false ? false : true;
    config.aiRecommendEndpoint = normalizeText(config.aiRecommendEndpoint);
    config.aiRecommendRequestTimeoutMs = Math.min(
      DEFAULT_AI_REQUEST_TIMEOUT_MS,
      normalizeDataBakerTimeoutMs(
        config.aiRecommendRequestTimeoutMs,
        defaults.aiRecommendRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS
      )
    );
    if (meta.scriptId === bytedanceAidpJinhuaScriptId) {
      config.aiRecommendModelMode = normalizeBytedanceAidpJinhuaModelMode(
        config.aiRecommendModelMode,
        defaults.aiRecommendModelMode || "two_stage"
      );
    }
    config.aiRecommendListenModel = normalizeDataBakerCvpcListenModel(
      config.aiRecommendListenModel,
      defaults.aiRecommendListenModel || "qwen3.5-omni-flash"
    );
    config.aiRecommendListenPrompt = normalizePromptText(config.aiRecommendListenPrompt || "");
    normalizeAishellTechStageParamFields(config, "aiRecommendListen");
    config.aiRecommendRefineModel = normalizeDataBakerCompareModel(
      config.aiRecommendRefineModel,
      defaults.aiRecommendRefineModel || "qwen3.5-plus"
    );
    config.aiRecommendRefinePrompt = normalizePromptText(config.aiRecommendRefinePrompt || "");
    normalizeAishellTechStageParamFields(config, "aiRecommendRefine");
    config.defaultPlaybackRate = normalizeBytedanceAidpPlaybackRate(
      config.defaultPlaybackRate,
      defaults.defaultPlaybackRate
    );
    config.fixedWaveZoom = normalizeBytedanceAidpFixedWaveZoom(
      config.fixedWaveZoom,
      defaults.fixedWaveZoom
    );
    config.contractMode = normalizeText(config.contractMode || "dom-guarded") || "dom-guarded";
    config.shortcuts = normalizeBytedanceAidpShortcuts(config.shortcuts, defaults.shortcuts);
    return config;
  }

  function getBytedanceAidpSuzhouConfig(settings) {
    return getBytedanceAidpConfig(settings, bytedanceAidpSuzhouScriptId);
  }

  function getBytedanceAidpJinhuaConfig(settings) {
    return getBytedanceAidpConfig(settings, bytedanceAidpJinhuaScriptId);
  }

  function getAishellTechMinnanConfig(settings) {
    const defaults =
      constants.DEFAULT_SETTINGS?.platforms?.aishellTech?.scripts?.minnanHelper || {};
    const current = settings?.platforms?.aishellTech?.scripts?.minnanHelper || {};

    const config = Object.assign(
      {
        id: aishellTechMinnanScriptId,
        enabled: true,
        aiRecommendEnabled: true,
        aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
        aiQualifiedAutofillConcurrency: 5,
        aiRecommendConvertModel: "qwen3.5-plus",
        aiRecommendConvertPrompt: "",
        aiRecommendConvertTemperature: "",
        aiRecommendConvertTopP: "",
        aiRecommendConvertMaxTokens: "",
        aiRecommendConvertMaxCompletionTokens: "",
        aiRecommendConvertPresencePenalty: "",
        aiRecommendConvertFrequencyPenalty: "",
        aiRecommendConvertSeed: "",
        aiRecommendConvertStopSequences: "",
        aiRecommendListenModel: "qwen3.5-omni-flash",
        aiRecommendListenPrompt: "",
        aiRecommendListenTemperature: "",
        aiRecommendListenTopP: "",
        aiRecommendListenMaxTokens: "",
        aiRecommendListenMaxCompletionTokens: "",
        aiRecommendListenPresencePenalty: "",
        aiRecommendListenFrequencyPenalty: "",
        aiRecommendListenSeed: "",
        aiRecommendListenStopSequences: "",
        aiRecommendCompareFamily: "qwen",
        aiRecommendCompareModel: "qwen3.5-plus",
        aiRecommendEnableThinking: false,
        aiRecommendCompareQwenPrompt: "",
        aiRecommendCompareOmniPrompt: "",
        aiRecommendCompareTemperature: "",
        aiRecommendCompareTopP: "",
        aiRecommendCompareMaxTokens: "",
        aiRecommendCompareMaxCompletionTokens: "",
        aiRecommendComparePresencePenalty: "",
        aiRecommendCompareFrequencyPenalty: "",
        aiRecommendCompareSeed: "",
        aiRecommendCompareStopSequences: "",
        aiRecommendCompareAdoptionThreshold: 0.75,
        shortcuts: {},
      },
      defaults,
      current
    );

    config.aiRecommendRequestTimeoutMs = normalizeDataBakerTimeoutMs(
      config.aiRecommendRequestTimeoutMs
    );
    config.aiRecommendConvertModel = normalizeDataBakerCompareModel(
      config.aiRecommendConvertModel,
      "qwen3.5-plus"
    );
    normalizeAishellTechStageParamFields(config, "aiRecommendConvert");
    config.aiRecommendConvertPrompt = normalizePromptText(config.aiRecommendConvertPrompt || "");
    config.aiRecommendListenModel = normalizeDataBakerListenModel(
      config.aiRecommendListenModel,
      "qwen3.5-omni-flash"
    );
    normalizeAishellTechStageParamFields(config, "aiRecommendListen");
    config.aiRecommendListenPrompt = normalizePromptText(config.aiRecommendListenPrompt || "");
    config.aiRecommendCompareFamily = normalizeAishellTechCompareFamily(
      config.aiRecommendCompareFamily,
      "qwen"
    );
    const defaultOmniCompareModel = normalizeDataBakerSingleModel(
      defaults.aiRecommendCompareFamily === "omni"
        ? defaults.aiRecommendCompareModel
        : defaults.aiRecommendListenModel,
      "qwen3.5-omni-flash"
    );
    const defaultQwenCompareModel = normalizeDataBakerCompareModel(
      defaults.aiRecommendCompareFamily === "qwen"
        ? defaults.aiRecommendCompareModel
        : defaults.aiRecommendConvertModel,
      "qwen3.5-plus"
    );
    config.aiRecommendCompareModel =
      config.aiRecommendCompareFamily === "omni"
        ? normalizeDataBakerSingleModel(
            config.aiRecommendCompareModel,
            defaultOmniCompareModel
          )
        : normalizeDataBakerCompareModel(
            config.aiRecommendCompareModel,
            defaultQwenCompareModel
          );
    normalizeAishellTechStageParamFields(config, "aiRecommendCompare");
    config.aiRecommendCompareQwenPrompt = normalizePromptText(
      config.aiRecommendCompareQwenPrompt || ""
    );
    config.aiRecommendCompareOmniPrompt = normalizePromptText(
      config.aiRecommendCompareOmniPrompt || ""
    );
    config.aiRecommendCompareAdoptionThreshold =
      normalizeOptionalNumberText(config.aiRecommendCompareAdoptionThreshold, 0, 1, 3) || "0.75";
    config.aiQualifiedAutofillConcurrency = normalizeDataBakerAutofillConcurrency(
      config.aiQualifiedAutofillConcurrency,
      getAishellTechConcurrencyModelConfig(config)
    );
    config.aiRecommendEnableThinking = false;
    config.shortcuts = normalizeAishellTechShortcuts(
      config.shortcuts,
      aishellTechMinnanScriptId
    );
    return config;
  }

  function getAishellTechVietnameseConfig(settings) {
    const defaults =
      constants.DEFAULT_SETTINGS?.platforms?.aishellTech?.scripts?.vietnameseHelper || {};
    const current = settings?.platforms?.aishellTech?.scripts?.vietnameseHelper || {};
    const config = Object.assign(
      {
        id: aishellTechVietnameseScriptId,
        enabled: false,
        aiRecommendEnabled: false,
        aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
        aiQualifiedAutofillConcurrency: 5,
        aiRecommendSingleModel: "qwen3.5-omni-flash",
        aiRecommendSinglePrompt: "",
        aiRecommendTemperature: "",
        aiRecommendTopP: "",
        aiRecommendMaxTokens: "",
        aiRecommendMaxCompletionTokens: "",
        aiRecommendPresencePenalty: "",
        aiRecommendFrequencyPenalty: "",
        aiRecommendSeed: "",
        aiRecommendStopSequences: "",
        shortcuts: {},
      },
      defaults,
      current
    );

    config.aiRecommendRequestTimeoutMs = normalizeDataBakerTimeoutMs(
      config.aiRecommendRequestTimeoutMs
    );
    config.aiRecommendSingleModel = normalizeDataBakerSingleModel(
      config.aiRecommendSingleModel,
      "qwen3.5-omni-flash"
    );
    config.aiRecommendSinglePrompt = normalizePromptText(config.aiRecommendSinglePrompt || "");
    normalizeAishellTechStageParamFields(config, "aiRecommend");
    config.aiQualifiedAutofillConcurrency = normalizeDataBakerAutofillConcurrency(
      config.aiQualifiedAutofillConcurrency,
      {
        aiRecommendPipelineMode: "omni_single",
        aiRecommendSingleModel: config.aiRecommendSingleModel,
      }
    );
    config.aiRecommendEnableThinking = false;
    config.shortcuts = normalizeAishellTechShortcuts(
      config.shortcuts,
      aishellTechVietnameseScriptId
    );
    return config;
  }

  function getAishellTechThaiConfig(settings) {
    const defaults =
      constants.DEFAULT_SETTINGS?.platforms?.aishellTech?.scripts?.thaiHelper || {};
    const current = settings?.platforms?.aishellTech?.scripts?.thaiHelper || {};
    const config = Object.assign(
      {
        id: aishellTechThaiScriptId,
        enabled: false,
        aiRecommendEnabled: false,
        aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
        aiQualifiedAutofillConcurrency: 5,
        aiRecommendSingleModel: "qwen3.5-omni-flash",
        aiRecommendSinglePrompt: "",
        aiRecommendTemperature: "",
        aiRecommendTopP: "",
        aiRecommendMaxTokens: "",
        aiRecommendMaxCompletionTokens: "",
        aiRecommendPresencePenalty: "",
        aiRecommendFrequencyPenalty: "",
        aiRecommendSeed: "",
        aiRecommendStopSequences: "",
        shortcuts: {},
      },
      defaults,
      current
    );

    config.aiRecommendRequestTimeoutMs = normalizeDataBakerTimeoutMs(
      config.aiRecommendRequestTimeoutMs
    );
    config.aiRecommendSingleModel = normalizeDataBakerSingleModel(
      config.aiRecommendSingleModel,
      "qwen3.5-omni-flash"
    );
    config.aiRecommendSinglePrompt = normalizePromptText(config.aiRecommendSinglePrompt || "");
    normalizeAishellTechStageParamFields(config, "aiRecommend");
    config.aiQualifiedAutofillConcurrency = normalizeDataBakerAutofillConcurrency(
      config.aiQualifiedAutofillConcurrency,
      {
        aiRecommendPipelineMode: "omni_single",
        aiRecommendSingleModel: config.aiRecommendSingleModel,
      }
    );
    config.aiRecommendEnableThinking = false;
    config.shortcuts = normalizeAishellTechShortcuts(
      config.shortcuts,
      aishellTechThaiScriptId
    );
    return config;
  }

  function getAishellTechCnEnShortDramaConfig(settings) {
    const defaults =
      constants.DEFAULT_SETTINGS?.platforms?.aishellTech?.scripts?.cnEnShortDrama || {};
    const current = settings?.platforms?.aishellTech?.scripts?.cnEnShortDrama || {};
    const config = Object.assign(
      {
        id: aishellTechCnEnShortDramaScriptId,
        enabled: false,
        aiRecommendEnabled: false,
        shortcuts: {},
      },
      defaults,
      current
    );

    config.id = aishellTechCnEnShortDramaScriptId;
    config.enabled = config.enabled === true;
    config.aiRecommendEnabled = false;
    config.shortcuts = normalizeAishellTechShortcuts(
      config.shortcuts,
      aishellTechCnEnShortDramaScriptId
    );
    return config;
  }

  function getAishellTechCantoneseConfig(settings) {
    const defaults =
      constants.DEFAULT_SETTINGS?.platforms?.aishellTech?.scripts?.cantoneseHelper || {};
    const current = settings?.platforms?.aishellTech?.scripts?.cantoneseHelper || {};
    const config = Object.assign(
      {
        id: aishellTechCantoneseScriptId,
        enabled: false,
        aiRecommendEnabled: false,
        aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
        aiQualifiedAutofillConcurrency: 5,
        aiRecommendSingleModel: "qwen3.5-omni-plus",
        aiRecommendSinglePrompt: constants.AISHELL_TECH_CANTONESE_DEFAULT_SINGLE_PROMPT || "",
        shortcuts: {},
      },
      defaults,
      current
    );
    config.id = aishellTechCantoneseScriptId;
    config.aiRecommendRequestTimeoutMs = DEFAULT_AI_REQUEST_TIMEOUT_MS;
    config.aiRecommendSingleModel = normalizeDataBakerSingleModel(
      config.aiRecommendSingleModel,
      "qwen3.5-omni-plus"
    );
    config.aiRecommendSinglePrompt =
      normalizePromptText(config.aiRecommendSinglePrompt) ||
      String(constants.AISHELL_TECH_CANTONESE_DEFAULT_SINGLE_PROMPT || "");
    normalizeAishellTechStageParamFields(config, "aiRecommend");
    config.aiQualifiedAutofillConcurrency = normalizeDataBakerAutofillConcurrency(
      config.aiQualifiedAutofillConcurrency,
      { aiRecommendPipelineMode: "omni_single", aiRecommendSingleModel: config.aiRecommendSingleModel }
    );
    config.aiRecommendEnableThinking = false;
    config.shortcuts = normalizeAishellTechShortcuts(config.shortcuts, aishellTechCantoneseScriptId);
    return config;
  }

  function getAishellTechConfig(settings, scriptId) {
    if (isAishellTechCnEnShortDramaScript(scriptId)) {
      return getAishellTechCnEnShortDramaConfig(settings);
    }
    if (isAishellTechCantoneseScript(scriptId)) {
      return getAishellTechCantoneseConfig(settings);
    }
    return isAishellTechVietnameseScript(scriptId)
      ? getAishellTechVietnameseConfig(settings)
      : isAishellTechThaiScript(scriptId)
        ? getAishellTechThaiConfig(settings)
        : getAishellTechMinnanConfig(settings);
  }

  function getAbakaAiTaskPageConfig(settings) {
    const defaults =
      constants.DEFAULT_SETTINGS?.platforms?.abakaAi?.scripts?.taskPageCapture || {};
    const current = settings?.platforms?.abakaAi?.scripts?.taskPageCapture || {};
    const merged = Object.assign(
      {
        id: abakaAiTaskPageCaptureScriptId,
        enabled: true,
          stage: "task21-inline-ai-analysis-debug",
          autoSelectSpecifyOnSameFontTrue: true,
          aiAnalysisMode: "two_stage",
          aiVisionModel: "qwen3.6-plus",
          aiOcrEnabled: false,
          aiOcrModel: "",
          aiReasoningModel: "qwen3.6-plus",
          aiSingleModel: "qwen3.6-plus",
          aiEnableThinking: false,
          aiRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
          shortcuts: createAbakaAiEmptyShortcutMap(),
      },
      defaults.aiRecommendListenModel,
      defaults,
      current
    );

    merged.id = abakaAiTaskPageCaptureScriptId;
    merged.enabled = merged.enabled !== false;
    merged.stage = String(merged.stage || "task21-inline-ai-analysis-debug");
    merged.autoSelectSpecifyOnSameFontTrue = merged.autoSelectSpecifyOnSameFontTrue !== false;
      const legacyDebugModel = normalizeAbakaAiModel(
        merged.aiDebugModel,
        "qwen3.6-plus",
        abakaAiTask21SingleModelOptions
      );
      merged.aiAnalysisMode = normalizeAbakaAiAnalysisMode(merged.aiAnalysisMode, "two_stage");
      merged.aiVisionModel = normalizeAbakaAiModel(
        merged.aiVisionModel,
        "qwen3.6-plus",
        abakaAiTask21VisionModelOptions
      );
      merged.aiOcrEnabled = merged.aiOcrEnabled === true;
      merged.aiOcrModel = normalizeAbakaAiModel(
        merged.aiOcrModel,
        "",
        abakaAiTask21OcrModelOptions
      );
      merged.aiReasoningModel = normalizeAbakaAiModel(
        merged.aiReasoningModel,
        "qwen3.6-plus",
        abakaAiTask21ReasoningModelOptions
      );
      merged.aiSingleModel = normalizeAbakaAiModel(
        merged.aiSingleModel || legacyDebugModel,
        "qwen3.6-plus",
        abakaAiTask21SingleModelOptions
      );
    merged.aiEnableThinking = merged.aiEnableThinking === true;
    merged.aiRequestTimeoutMs = normalizeAbakaAiTimeout(merged.aiRequestTimeoutMs, DEFAULT_AI_REQUEST_TIMEOUT_MS);
    merged.shortcuts = normalizeAbakaAiShortcuts(
      merged.shortcuts,
      createAbakaAiEmptyShortcutMap()
    );
    return merged;
  }

  function getHaitianUtransAudioDownloadHelperConfig(settings) {
    const defaults =
      constants.DEFAULT_SETTINGS?.platforms?.haitianUtrans?.scripts?.audioDownloadHelper || {};
    const current =
      settings?.platforms?.haitianUtrans?.scripts?.audioDownloadHelper || {};
    const currentEnabled =
      settings?.platforms?.haitianUtrans?.scripts?.audioDownloadHelper?.enabled !== false;
    const merged = Object.assign(
      {
        id: haitianUtransAudioDownloadHelperScriptId,
        enabled: true,
      },
      clone(defaults),
      clone(current)
    );

    merged.id = haitianUtransAudioDownloadHelperScriptId;
    merged.enabled = currentEnabled && merged.enabled !== false;
    return merged;
  }

  function getTranscriptionAiConfig(settings) {
    const projectState =
      settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.[transcriptionProjectId] || {};
    const asrConfig = projectState.asrConfig || {};
    const defaults = constants.DEFAULT_JUDGEMENT_ASR_CONFIG || {};
    return {
      aiSuggestionRequestTimeoutMs: clampNumber(
        asrConfig.aiSuggestionRequestTimeoutMs,
        defaults.aiSuggestionRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS,
        1000,
        180000,
        0
      ),
      aiSuggestionListenModel: normalizeJudgementAiModelText(
        asrConfig.aiSuggestionListenModel,
        defaults.aiSuggestionListenModel || "qwen3.5-omni-flash"
      ),
      aiSuggestionCompareModel: normalizeJudgementAiModelText(
        asrConfig.aiSuggestionCompareModel || asrConfig.aiSuggestionModel,
        defaults.aiSuggestionCompareModel || defaults.aiSuggestionModel || "qwen3.5-plus"
      ),
      aiSuggestionListenPrompt: normalizePromptText(asrConfig.aiSuggestionListenPrompt || ""),
      aiSuggestionComparePrompt: normalizePromptText(asrConfig.aiSuggestionComparePrompt || ""),
      aiSuggestionTemperature: normalizeOptionalNumberText(asrConfig.aiSuggestionTemperature, 0, 2, 3),
      aiSuggestionTopP: normalizeOptionalNumberText(asrConfig.aiSuggestionTopP, 0, 1, 3),
      aiSuggestionMaxTokens: normalizeOptionalIntegerText(asrConfig.aiSuggestionMaxTokens, 1, 8192),
      aiSuggestionMaxCompletionTokens: normalizeOptionalIntegerText(
        asrConfig.aiSuggestionMaxCompletionTokens,
        1,
        8192
      ),
      aiSuggestionPresencePenalty: normalizeOptionalNumberText(
        asrConfig.aiSuggestionPresencePenalty,
        -2,
        2,
        3
      ),
      aiSuggestionFrequencyPenalty: normalizeOptionalNumberText(
        asrConfig.aiSuggestionFrequencyPenalty,
        -2,
        2,
        3
      ),
      aiSuggestionSeed: normalizeOptionalIntegerText(asrConfig.aiSuggestionSeed, 0, 2147483647),
      aiSuggestionResponseFormat: normalizeResponseFormat(
        asrConfig.aiSuggestionResponseFormat,
        "json_object"
      ),
      aiSuggestionStopSequences: normalizeStopSequencesText(asrConfig.aiSuggestionStopSequences || ""),
      aiSuggestionEnableThinking: asrConfig.aiSuggestionEnableThinking === true,
    };
  }

  function buildAsrVoiceAiHeader(scriptId) {
    const scriptLabel = scriptLibrary[scriptId]?.label || scriptId;
    const titleMarkup = isBytedanceAidpScript(scriptId)
      ? '<span>AI 设置</span>' + buildInlineHelpDotMarkup(getBytedanceAidpAiSettingsHelpText(scriptId))
      : "AI 设置";
    const headerCopy =
      isBytedanceAidpScript(scriptId)
        ? ""
        : '<p class="asr-ai-copy">这些设置仅影响当前脚本的 AI 辅助能力。普通用户无需修改；后端地址仍由首页顶部“后端接口地址”统一控制。</p>';
    const parts = [
      '<div class="asr-ai-head">',
      '<div class="asr-ai-title">',
      "<strong" + (isBytedanceAidpScript(scriptId) ? ' class="asr-ai-label-row"' : "") + ">" + titleMarkup + "</strong>",
      headerCopy,
      "</div>",
      "</div>",
    ];
    if (!isBytedanceAidpScript(scriptId)) {
      parts.splice(parts.length - 1, 0, '<span class="asr-ai-pill">' + escapeHtml(scriptLabel) + "</span>");
    }
    return parts.join("");
  }

  function getBytedanceAidpAiSettingsHelpText(scriptId) {
    return scriptId === bytedanceAidpJinhuaScriptId
      ? "已读取后端默认配置。金华话脚本当前固定为两阶段：听音 + 普通话翻译收口。thinking 已全局固定关闭；金华话脚本不允许开启 Omni 思考模式。"
      : "已读取后端默认配置。苏州话脚本当前固定为两阶段：听音 + 普通话听写收口。thinking 已全局固定关闭；苏州话脚本不允许开启 Omni 思考模式。";
  }

  function buildInlineHelpDotMarkup(text, dotId) {
    const normalized = normalizeText(text);
    if (!normalized) {
      return "";
    }
    const idMarkup = normalizeText(dotId) ? ' id="' + escapeHtml(dotId) + '"' : "";
    return [
      '<span class="inline-help-dot"',
      idMarkup,
      ' tabindex="0" data-help-text="',
      escapeHtml(normalized),
      '">?</span>',
    ].join("");
  }

  function buildAsrAiLabelMarkup(label, helpText, dotId) {
    return (
      '<span class="asr-ai-label-row"><span>' +
      escapeHtml(label) +
      "</span>" +
      buildInlineHelpDotMarkup(helpText, dotId) +
      "</span>"
    );
  }

  function buildSwitchBooleanMarkup(id, options) {
    const onText =
      typeof options === "object" && options
        ? normalizeText(options.onText || "") || "开启"
        : normalizeText(options) || "开启";
    const offText =
      typeof options === "object" && options
        ? normalizeText(options.offText || "") || "关闭"
        : "关闭";
    const preserveSwitchText =
      typeof options === "object" && options && options.preserveText === true;
    const preserveSwitchTextAttr = preserveSwitchText
      ? ' data-preserve-switch-text="true"'
      : "";
    return (
      '<label class="asr-ai-boolean switch-boolean"><input id="' +
      escapeHtml(id) +
      '" type="checkbox" data-on-text="' +
      escapeHtml(onText) +
      '" data-off-text="' +
      escapeHtml(offText) +
      '"' +
      preserveSwitchTextAttr +
      ' /><span class="switch-slider" aria-hidden="true"></span><span class="switch-text">' +
      escapeHtml(onText) +
      "</span></label>"
    );
  }

  function syncSwitchFieldText(inputNode) {
    if (!(inputNode instanceof HTMLInputElement) || inputNode.type !== "checkbox") {
      return;
    }
    const wrapper =
      typeof inputNode.closest === "function"
        ? inputNode.closest(".switch-field, .switch-boolean")
        : null;
    if (!(wrapper instanceof HTMLElement)) {
      return;
    }
    const textNode = wrapper.querySelector(".switch-text");
    if (!(textNode instanceof HTMLElement)) {
      return;
    }
    const onText = normalizeText(inputNode.getAttribute("data-on-text")) || "开启";
    const offText = normalizeText(inputNode.getAttribute("data-off-text")) || "关闭";
    textNode.textContent = inputNode.checked ? onText : offText;
  }

  function bindSwitchFieldText(scope) {
    const root =
      scope instanceof HTMLElement ||
      (typeof Document === "function" && scope instanceof Document)
        ? scope
        : document;
    Array.from(root.querySelectorAll('.switch-field input[type="checkbox"], .switch-boolean input[type="checkbox"]')).forEach(function (inputNode) {
      if (!(inputNode instanceof HTMLInputElement)) {
        return;
      }
      syncSwitchFieldText(inputNode);
      if (inputNode.getAttribute("data-switch-text-bound") === "true") {
        return;
      }
      inputNode.setAttribute("data-switch-text-bound", "true");
      inputNode.addEventListener("change", function () {
        syncSwitchFieldText(inputNode);
      });
    });
  }

  function getInlineHelpText(node) {
    return normalizeText(
      node?.getAttribute?.("data-help-text") || node?.getAttribute?.("title") || ""
    );
  }

  function closeInlineHelpAnchor(anchor) {
    if (!(anchor instanceof HTMLElement)) {
      return;
    }
    anchor.setAttribute("data-hover", "");
    anchor.setAttribute("data-open", "");
    if (activeInlineHelpAnchor === anchor) {
      activeInlineHelpAnchor = null;
    }
    if (hoveredInlineHelpAnchor === anchor) {
      hoveredInlineHelpAnchor = null;
    }
    if (!(activeInlineHelpAnchor instanceof HTMLElement)) {
      hideInlineHelpPopover();
    }
  }

  function ensureGlobalInlineHelpPopover() {
    if (inlineHelpPopoverNode instanceof HTMLElement && inlineHelpPopoverNode.isConnected) {
      return inlineHelpPopoverNode;
    }
    if (typeof document === "undefined" || !document.body) {
      return null;
    }
    inlineHelpPopoverNode = document.createElement("div");
    inlineHelpPopoverNode.id = "global-inline-help-popover";
    inlineHelpPopoverNode.className = "inline-help-popover global-inline-help-popover";
    document.body.appendChild(inlineHelpPopoverNode);
    return inlineHelpPopoverNode;
  }

  function positionInlineHelpPopover(anchor) {
    if (!(anchor instanceof HTMLElement)) {
      return;
    }
    const popover = ensureGlobalInlineHelpPopover();
    if (!(popover instanceof HTMLElement)) {
      return;
    }
    const target = anchor.querySelector(".inline-help-dot") || anchor;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const rect = target.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const maxWidth = Math.min(360, Math.max(220, viewportWidth - 24));
    popover.style.maxWidth = String(maxWidth) + "px";
    popover.style.left = "12px";
    popover.style.top = Math.round(rect.bottom + 10) + "px";
    const measuredWidth = popover.offsetWidth || Math.min(maxWidth, 320);
    const left = Math.max(
      12,
      Math.min(rect.left + rect.width / 2 - measuredWidth / 2, viewportWidth - measuredWidth - 12)
    );
    popover.style.left = Math.round(left) + "px";
  }

  function showInlineHelpPopover(anchor, text) {
    const popover = ensureGlobalInlineHelpPopover();
    if (!(popover instanceof HTMLElement)) {
      return;
    }
    popover.textContent = normalizeText(text);
    popover.classList.add("visible");
    positionInlineHelpPopover(anchor);
  }

  function hideInlineHelpPopover() {
    const popover = ensureGlobalInlineHelpPopover();
    if (!(popover instanceof HTMLElement)) {
      return;
    }
    popover.classList.remove("visible");
  }

  function setInlineHelpText(node, text) {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const normalized = normalizeText(text);
    node.setAttribute("data-help-text", normalized);
    if (node.hasAttribute("title")) {
      node.removeAttribute("title");
    }
    const anchor =
      node.parentElement instanceof HTMLElement &&
      node.parentElement.classList.contains("inline-help-anchor")
        ? node.parentElement
        : null;
    if (anchor instanceof HTMLElement) {
      anchor.setAttribute("data-help-text", normalized);
      if (
        activeInlineHelpAnchor === anchor ||
        (hoveredInlineHelpAnchor === anchor && !(activeInlineHelpAnchor instanceof HTMLElement))
      ) {
        showInlineHelpPopover(anchor, normalized);
      }
    }
    node.classList.toggle("hidden", !normalized);
  }

  function ensureInlineHelpDots(scope) {
    const root =
      scope instanceof HTMLElement ||
      (typeof Document === "function" && scope instanceof Document)
        ? scope
        : document;
    const dots = Array.from(root.querySelectorAll(".inline-help-dot"));
    if (!dots.length) {
      return;
    }
    if (!inlineHelpListenersBound) {
      document.addEventListener("click", function (event) {
        if (!(activeInlineHelpAnchor instanceof HTMLElement)) {
          return;
        }
        if (activeInlineHelpAnchor.contains(event.target)) {
          return;
        }
        closeInlineHelpAnchor(activeInlineHelpAnchor);
      });
      window.addEventListener(
        "resize",
        function () {
          const targetAnchor =
            activeInlineHelpAnchor instanceof HTMLElement
              ? activeInlineHelpAnchor
              : hoveredInlineHelpAnchor instanceof HTMLElement
                ? hoveredInlineHelpAnchor
                : null;
          if (!(targetAnchor instanceof HTMLElement)) {
            hideInlineHelpPopover();
            return;
          }
          positionInlineHelpPopover(targetAnchor);
        },
        true
      );
      window.addEventListener(
        "scroll",
        function () {
          const targetAnchor =
            activeInlineHelpAnchor instanceof HTMLElement
              ? activeInlineHelpAnchor
              : hoveredInlineHelpAnchor instanceof HTMLElement
                ? hoveredInlineHelpAnchor
                : null;
          if (!(targetAnchor instanceof HTMLElement)) {
            hideInlineHelpPopover();
            return;
          }
          positionInlineHelpPopover(targetAnchor);
        },
        true
      );
      inlineHelpListenersBound = true;
    }
    dots.forEach(function (dot) {
      if (!(dot instanceof HTMLElement)) {
        return;
      }
      const helpText = getInlineHelpText(dot);
      if (!helpText) {
        dot.classList.add("hidden");
        return;
      }
      dot.classList.remove("hidden");
      if (dot.hasAttribute("title")) {
        dot.removeAttribute("title");
      }
      if (
        dot.parentElement instanceof HTMLElement &&
        dot.parentElement.classList.contains("inline-help-anchor")
      ) {
        setInlineHelpText(dot, helpText);
        return;
      }
      const parent = dot.parentElement;
      if (!(parent instanceof HTMLElement)) {
        return;
      }
      const anchor = document.createElement("span");
      anchor.className = "inline-help-anchor";
      anchor.setAttribute("data-hover", "");
      anchor.setAttribute("data-open", "");
      anchor.setAttribute("data-help-text", helpText);
      parent.insertBefore(anchor, dot);
      anchor.appendChild(dot);
      anchor.addEventListener("mouseenter", function () {
        hoveredInlineHelpAnchor = anchor;
        anchor.setAttribute("data-hover", "true");
        if (!(activeInlineHelpAnchor instanceof HTMLElement) || activeInlineHelpAnchor === anchor) {
          showInlineHelpPopover(anchor, getInlineHelpText(dot));
        }
      });
      anchor.addEventListener("mouseleave", function () {
        if (hoveredInlineHelpAnchor === anchor) {
          hoveredInlineHelpAnchor = null;
        }
        anchor.setAttribute("data-hover", "");
        if (activeInlineHelpAnchor !== anchor) {
          hideInlineHelpPopover();
        }
      });
      dot.addEventListener("click", function (event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        if (event && typeof event.stopPropagation === "function") {
          event.stopPropagation();
        }
        const isOpen = anchor.getAttribute("data-open") === "true";
        if (activeInlineHelpAnchor && activeInlineHelpAnchor !== anchor) {
          closeInlineHelpAnchor(activeInlineHelpAnchor);
        }
        if (isOpen) {
          closeInlineHelpAnchor(anchor);
          return;
        }
        anchor.setAttribute("data-open", "true");
        activeInlineHelpAnchor = anchor;
        showInlineHelpPopover(anchor, getInlineHelpText(dot));
      });
      dot.addEventListener("keydown", function (event) {
        const key = normalizeText(event?.key);
        if (key !== "Enter" && key !== " ") {
          return;
        }
        if (typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        dot.click();
      });
    });
  }

  function getAidpLineMeasureSeedCount(value) {
    if (value === "") {
      return 0;
    }
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .split("\n").length;
  }

  function getAidpLineNumberTextareaDefaultRows(textarea) {
    const rawValue = Number(textarea?.getAttribute("data-aidp-default-rows") || 0);
    return Math.max(1, Math.round(rawValue || 1));
  }

  function getAidpLineNumberTextareaMaxRows(textarea) {
    const mode = normalizeText(textarea?.getAttribute("data-aidp-lined-textarea")) || "prompt";
    return mode === "compact" ? 12 : 24;
  }

  function getAidpLineNumberTextareaController(textarea) {
    return textarea instanceof HTMLTextAreaElement
      ? aidpLineNumberTextareaControllers.get(textarea) || null
      : null;
  }

  function syncAidpLineNumberMeasure(controller) {
    if (!controller) {
      return;
    }
    const computedStyle = window.getComputedStyle(controller.textarea);
    controller.measure.style.width = controller.textarea.clientWidth + "px";
    controller.measure.style.paddingTop = computedStyle.paddingTop;
    controller.measure.style.paddingRight = computedStyle.paddingRight;
    controller.measure.style.paddingBottom = computedStyle.paddingBottom;
    controller.measure.style.paddingLeft = computedStyle.paddingLeft;
    controller.measure.style.font = computedStyle.font;
    controller.measure.style.fontFamily = computedStyle.fontFamily;
    controller.measure.style.fontSize = computedStyle.fontSize;
    controller.measure.style.fontWeight = computedStyle.fontWeight;
    controller.measure.style.fontStyle = computedStyle.fontStyle;
    controller.measure.style.letterSpacing = computedStyle.letterSpacing;
    controller.measure.style.lineHeight = computedStyle.lineHeight;
    controller.measure.style.tabSize = computedStyle.tabSize;
  }

  function buildAidpVisibleLineNumberEntries(textarea) {
    const controller = getAidpLineNumberTextareaController(textarea);
    if (!controller) {
      return [];
    }
    const value = String(controller.textarea.value || "").replace(/\r\n?/g, "\n");
    if (getAidpLineMeasureSeedCount(value) === 0) {
      controller.measure.innerHTML = "";
      return [];
    }
    syncAidpLineNumberMeasure(controller);
    controller.measure.innerHTML = "";
    const logicalLines = value.split("\n");
    logicalLines.forEach(function (lineText, index) {
      const lineNode = document.createElement("span");
      lineNode.className = "aidp-lined-textarea-measure-line";
      lineNode.setAttribute("data-blank", lineText === "" ? "true" : "false");
      lineNode.textContent = lineText === "" ? "\u200b" : lineText;
      controller.measure.appendChild(lineNode);
      if (index < logicalLines.length - 1) {
        controller.measure.appendChild(document.createElement("br"));
      }
    });
    let visibleLineNumber = 0;
    return Array.from(
      controller.measure.querySelectorAll(".aidp-lined-textarea-measure-line")
    ).reduce(function (entries, lineNode) {
      const rectCount = Math.max(1, lineNode.getClientRects().length || 1);
      const isBlank = lineNode.getAttribute("data-blank") === "true";
      for (let index = 0; index < rectCount; index += 1) {
        if (isBlank) {
          entries.push("");
        } else {
          visibleLineNumber += 1;
          entries.push(String(visibleLineNumber));
        }
      }
      return entries;
    }, []);
  }

  function syncAidpLineNumberSliderValue(textarea) {
    const controller = getAidpLineNumberTextareaController(textarea);
    if (!controller) {
      return;
    }
    const computedStyle = window.getComputedStyle(controller.textarea);
    const lineHeight = parseFloat(computedStyle.lineHeight) || 22.4;
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
    const height = controller.textarea.clientHeight - paddingTop - paddingBottom;
    const rows = Math.max(1, Math.round(height / Math.max(lineHeight, 1)));
    controller.slider.value = String(
      Math.min(getAidpLineNumberTextareaMaxRows(controller.textarea), rows)
    );
  }

  function applyAidpLineNumberTextareaRows(textarea, nextRows) {
    const controller = getAidpLineNumberTextareaController(textarea);
    if (!controller) {
      return;
    }
    const maxRows = getAidpLineNumberTextareaMaxRows(controller.textarea);
    const defaultRows = getAidpLineNumberTextareaDefaultRows(controller.textarea);
    const rows = Math.max(1, Math.min(maxRows, Math.round(Number(nextRows) || defaultRows)));
    const computedStyle = window.getComputedStyle(controller.textarea);
    const lineHeight = parseFloat(computedStyle.lineHeight) || 22.4;
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
    const nextHeight = Math.ceil(lineHeight * rows + paddingTop + paddingBottom);
    controller.textarea.rows = rows;
    controller.textarea.setAttribute("data-aidp-visible-rows", String(rows));
    controller.textarea.style.height = nextHeight + "px";
    controller.textarea.style.minHeight = nextHeight + "px";
    controller.wrapper.style.minHeight = nextHeight + "px";
    controller.wrapper.setAttribute("data-visible-rows", String(rows));
    controller.slider.value = String(rows);
  }

  function syncAidpLineNumberTextarea(textarea) {
    const controller = getAidpLineNumberTextareaController(textarea);
    if (!controller) {
      return;
    }
    const visibleEntries = buildAidpVisibleLineNumberEntries(controller.textarea);
    controller.gutter.textContent = visibleEntries.join("\n");
    controller.gutter.scrollTop = controller.textarea.scrollTop;
    controller.wrapper.setAttribute(
      "data-has-line-numbers",
      visibleEntries.length > 0 ? "true" : "false"
    );
    syncAidpLineNumberSliderValue(controller.textarea);
  }

  function ensureAidpLineNumberTextarea(textarea) {
    if (!(textarea instanceof HTMLTextAreaElement)) {
      return;
    }
    let controller = getAidpLineNumberTextareaController(textarea);
    if (
      controller &&
      (!controller.wrapper.isConnected || !controller.wrapper.contains(textarea))
    ) {
      controller = null;
      aidpLineNumberTextareaControllers.delete(textarea);
    }
    const mode = normalizeText(textarea.getAttribute("data-aidp-lined-textarea")) || "prompt";
    if (!controller) {
      let wrapper = textarea.closest(".aidp-lined-textarea");
      let gutter = wrapper instanceof HTMLElement ? wrapper.querySelector(".aidp-lined-textarea-gutter") : null;
      let shell = wrapper instanceof HTMLElement ? wrapper.querySelector(".aidp-lined-textarea-shell") : null;
      let measure =
        wrapper instanceof HTMLElement ? wrapper.querySelector(".aidp-lined-textarea-measure") : null;
      let slider =
        wrapper instanceof HTMLElement ? wrapper.querySelector(".aidp-lined-textarea-slider") : null;
      if (
        !(wrapper instanceof HTMLElement) ||
        !(gutter instanceof HTMLElement) ||
        !(shell instanceof HTMLElement) ||
        !(measure instanceof HTMLElement) ||
        !(slider instanceof HTMLInputElement)
      ) {
        const parent = textarea.parentElement;
        if (!(parent instanceof HTMLElement)) {
          return;
        }
        wrapper = document.createElement("div");
        wrapper.className = "aidp-lined-textarea aidp-lined-textarea-" + mode;
        gutter = document.createElement("div");
        gutter.className = "aidp-lined-textarea-gutter";
        gutter.setAttribute("aria-hidden", "true");
        shell = document.createElement("div");
        shell.className = "aidp-lined-textarea-shell";
        measure = document.createElement("div");
        measure.className = "aidp-lined-textarea-measure";
        measure.setAttribute("aria-hidden", "true");
        slider = document.createElement("input");
        slider.type = "range";
        slider.className = "aidp-lined-textarea-slider";
        slider.min = "1";
        slider.max = String(getAidpLineNumberTextareaMaxRows(textarea));
        slider.step = "1";
        slider.setAttribute("aria-label", "调整显示行数");
        parent.insertBefore(wrapper, textarea);
        wrapper.appendChild(gutter);
        wrapper.appendChild(shell);
        wrapper.appendChild(slider);
        shell.appendChild(textarea);
        shell.appendChild(measure);
      }
      controller = {
        textarea,
        wrapper,
        gutter,
        shell,
        measure,
        slider,
      };
      aidpLineNumberTextareaControllers.set(textarea, controller);
    }

    controller.wrapper.className = "aidp-lined-textarea aidp-lined-textarea-" + mode;
    controller.slider.max = String(getAidpLineNumberTextareaMaxRows(textarea));

    if (textarea.getAttribute("data-aidp-line-numbers-bound") !== "true") {
      textarea.setAttribute("data-aidp-line-numbers-bound", "true");
      applyAidpLineNumberTextareaRows(textarea, getAidpLineNumberTextareaDefaultRows(textarea));
      textarea.addEventListener("input", function () {
        syncAidpLineNumberTextarea(textarea);
      });
      textarea.addEventListener("scroll", function () {
        syncAidpLineNumberTextarea(textarea);
      });
      textarea.addEventListener("mouseup", function () {
        syncAidpLineNumberTextarea(textarea);
      });
      textarea.addEventListener("keyup", function () {
        syncAidpLineNumberTextarea(textarea);
      });
      controller.slider.addEventListener("input", function () {
        applyAidpLineNumberTextareaRows(textarea, controller.slider.value);
        syncAidpLineNumberTextarea(textarea);
      });
    } else {
      applyAidpLineNumberTextareaRows(
        textarea,
        textarea.getAttribute("data-aidp-visible-rows") ||
          getAidpLineNumberTextareaDefaultRows(textarea)
      );
    }

    if (!aidpLineNumberWindowListenerBound) {
      window.addEventListener("resize", function () {
        syncAidpLineNumberTextareas(document);
      });
      aidpLineNumberWindowListenerBound = true;
    }

    syncAidpLineNumberTextarea(textarea);
  }

  function syncAidpLineNumberTextareas(scope) {
    return scope;
  }

  function getBytedanceAidpSuzhouStageParamHelpElementId(stagePrefix, definition) {
    return getBytedanceAidpSuzhouStageParamElementId(stagePrefix, definition) + "-help";
  }

  function getBytedanceAidpSuzhouStageParamExplanation(definition) {
    const helpMap = {
      temperature: "控制结果随机度，数值越低越稳定；通常只做小幅调节。",
      top_p: "控制采样候选范围；通常与 temperature 二选一微调即可。",
      max_tokens: "限制当前阶段输出长度，避免结果过长。",
      max_completion_tokens: "限制补全文本长度；模型不支持时由后端按兼容策略处理。",
      presence_penalty: "控制是否鼓励新内容；通常保持默认值即可。",
      frequency_penalty: "控制重复惩罚；通常保持默认值即可。",
      seed: "固定随机种子；留空表示不固定。",
      stop: "每行一个停止序列；留空表示不额外设置。",
    };
    return helpMap[String(definition?.apiKey || "").trim()] || "";
  }

  function getBytedanceAidpSuzhouStageParamLabel(definition) {
    const labelMap = {
      temperature: "temperature",
      top_p: "top_p",
      max_tokens: "max_tokens",
      max_completion_tokens: "max_completion_tokens",
      presence_penalty: "presence_penalty",
      frequency_penalty: "frequency_penalty",
      seed: "seed",
      stop: "stop sequences",
    };
    return labelMap[String(definition?.apiKey || "").trim()] || String(definition?.domSuffix || "");
  }

  function buildBytedanceAidpSuzhouStageParamFieldsMarkup(stagePrefix) {
    return aishellTechStageParamDefinitions
      .map(function (definition) {
        const fieldId = getBytedanceAidpSuzhouStageParamElementId(stagePrefix, definition);
        const helpId = getBytedanceAidpSuzhouStageParamHelpElementId(stagePrefix, definition);
        const labelMarkup = buildAsrAiLabelMarkup(
          getBytedanceAidpSuzhouStageParamLabel(definition),
          getBytedanceAidpSuzhouStageParamExplanation(definition),
          helpId
        );
        const controlMarkup =
          definition.type === "stop"
            ? '<textarea id="' +
              fieldId +
              '" maxlength="960"></textarea>'
            : '<input id="' +
              fieldId +
              '" type="number" min="' +
              String(definition.min) +
              '" max="' +
              String(definition.max) +
              '" step="' +
              String(
                definition.type === "integer"
                  ? 1
                  : definition.apiKey === "top_p"
                    ? 0.05
                    : 0.1
              ) +
              '" />';
        return (
          '<label class="asr-ai-field"><span>' +
          labelMarkup +
          '</span>' +
          controlMarkup +
          "</label>"
        );
      })
      .join("");
  }

  function buildAishellTechStageParamFieldsMarkup(stagePrefix, includeThresholdField) {
    const prefix = "aishell-tech-ai-" + String(stagePrefix || "").trim();
    return [
      includeThresholdField
        ? '<label class="asr-ai-field" id="aishell-tech-ai-compare-adoption-threshold-field"><span>采纳阈值</span><input id="aishell-tech-ai-compare-adoption-threshold" type="number" min="0" max="1" step="0.001" /><span class="asr-ai-help" id="aishell-tech-ai-compare-adoption-threshold-help">默认 0.75。低于阈值时优先保留听音文本，并提示人工复核。</span></label>'
        : "",
      '<label class="asr-ai-field"><span>temperature</span><input id="' +
        prefix +
        '-temperature" type="number" min="0" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>top_p</span><input id="' +
        prefix +
        '-top-p" type="number" min="0" max="1" step="0.05" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>max_tokens</span><input id="' +
        prefix +
        '-max-tokens" type="number" min="1" max="8192" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>max_completion_tokens</span><input id="' +
        prefix +
        '-max-completion-tokens" type="number" min="1" max="8192" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>presence_penalty</span><input id="' +
        prefix +
        '-presence-penalty" type="number" min="-2" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>frequency_penalty</span><input id="' +
        prefix +
        '-frequency-penalty" type="number" min="-2" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>seed</span><input id="' +
        prefix +
        '-seed" type="number" min="0" max="2147483647" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>stop sequences</span><textarea id="' +
        prefix +
        '-stop-sequences" maxlength="960"></textarea><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
    ].join("");
  }

  function buildDataBakerCvpcStageParamFieldsMarkup(stagePrefix) {
    const prefix = "data-baker-cvpc-ai-" + String(stagePrefix || "").trim();
    return [
      '<label class="asr-ai-field"><span>temperature</span><input id="' +
        prefix +
        '-temperature" type="number" min="0" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>top_p</span><input id="' +
        prefix +
        '-top-p" type="number" min="0" max="1" step="0.05" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>max_tokens</span><input id="' +
        prefix +
        '-max-tokens" type="number" min="1" max="8192" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>max_completion_tokens</span><input id="' +
        prefix +
        '-max-completion-tokens" type="number" min="1" max="8192" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>presence_penalty</span><input id="' +
        prefix +
        '-presence-penalty" type="number" min="-2" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>frequency_penalty</span><input id="' +
        prefix +
        '-frequency-penalty" type="number" min="-2" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>seed</span><input id="' +
        prefix +
        '-seed" type="number" min="0" max="2147483647" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
      '<label class="asr-ai-field"><span>stop sequences</span><textarea id="' +
        prefix +
        '-stop-sequences" maxlength="960"></textarea><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
    ].join("");
  }

  function renderAishellTechAiSettingsSection(panel, headerHtml, defaultsTipId) {
    panel.innerHTML = [
      '<div class="asr-ai-panel">',
      headerHtml,
      '<div class="asr-ai-note" id="' + defaultsTipId + '"></div>',
      '<div class="asr-ai-block"><strong>基础设置</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>启用 AI 推荐文本</span><label class="asr-ai-boolean"><input id="aishell-tech-ai-recommend-enabled" type="checkbox" /><span>关闭后不显示当前条推荐与批量保存面板</span></label></label>',
      renderSharedAsrAutofillConcurrencyField(aishellTechMinnanScriptId),
      '<label class="asr-ai-field"><span>请求超时时间（ms）</span><input id="aishell-tech-ai-timeout" type="number" min="1000" max="300000" step="1000" /></label>',
      '<label class="asr-ai-field"><span>思考开关</span><label class="asr-ai-boolean"><input id="aishell-tech-ai-enable-thinking" type="checkbox" /><span>thinking 已全局固定关闭，以避免请求链路拖慢。</span></label></label>',
      "</div></div>",
      '<div class="asr-ai-block"><strong>转换</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>转换模型</span><select id="aishell-tech-ai-convert-model-select" data-options-custom-select="true"></select><span class="asr-ai-help">默认先走词表规则替换；只有命中歧义词或切分冲突时，才会调用这里的模型兜底。</span></label>',
      '<label class="asr-ai-field"><span>转换 Prompt（可选）</span><textarea id="aishell-tech-ai-convert-prompt" maxlength="8000"></textarea><span class="asr-ai-help">留空或恢复默认时，使用后端默认 Prompt。</span></label>',
      '</div><div class="asr-ai-grid three">' +
        buildAishellTechStageParamFieldsMarkup("convert", false) +
        "</div></div>",
      '<div class="asr-ai-block"><strong>听音</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>听音模型</span><select id="aishell-tech-ai-listen-model-select" data-options-custom-select="true"></select><span class="asr-ai-help" id="aishell-tech-ai-listen-model-help"></span></label>',
      '<label class="asr-ai-field"><span>听音 Prompt（可选）</span><textarea id="aishell-tech-ai-listen-prompt" maxlength="8000"></textarea><span class="asr-ai-help">留空或恢复默认时，使用后端默认 Prompt。</span></label>',
      '<div class="asr-ai-field" id="aishell-tech-ai-listen-model-note"><span class="asr-ai-help"></span></div>',
      '</div><div class="asr-ai-grid three">' +
        buildAishellTechStageParamFieldsMarkup("listen", false) +
        "</div></div>",
      '<div class="asr-ai-block"><strong>比较</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>比较方式</span><select id="aishell-tech-ai-compare-family-select" data-options-custom-select="true"></select><span class="asr-ai-help" id="aishell-tech-ai-compare-family-help">Qwen 只做文本比较；Omni 会在比较阶段再次听音频。</span></label>',
      '<label class="asr-ai-field"><span>比较模型</span><select id="aishell-tech-ai-compare-model-select" data-options-custom-select="true"></select><span class="asr-ai-help" id="aishell-tech-ai-compare-model-help"></span></label>',
      '<label class="asr-ai-field" id="aishell-tech-ai-compare-qwen-prompt-field"><span>Qwen 比较 Prompt（可选）</span><textarea id="aishell-tech-ai-compare-qwen-prompt" maxlength="8000"></textarea><span class="asr-ai-help">用于纯文本比对，不再二次听音。</span></label>',
      '<label class="asr-ai-field" id="aishell-tech-ai-compare-omni-prompt-field"><span>Omni 比较 Prompt（可选）</span><textarea id="aishell-tech-ai-compare-omni-prompt" maxlength="8000"></textarea><span class="asr-ai-help">用于比较阶段再次听音并综合判断。</span></label>',
      '</div><div class="asr-ai-grid three">' +
        buildAishellTechStageParamFieldsMarkup("compare", true) +
        "</div></div>",
      "</div>",
    ].join("");

    const listenNode = getElement("aishell-tech-ai-listen-model-select");
    const compareFamilyNode = getElement("aishell-tech-ai-compare-family-select");
    if (listenNode instanceof HTMLSelectElement) {
      listenNode.addEventListener("change", function (event) {
        updateAishellTechListenModelFields(event?.target?.value);
      });
    }
    if (compareFamilyNode instanceof HTMLSelectElement) {
      compareFamilyNode.addEventListener("change", function (event) {
        updateAishellTechCompareFamilyFields(event?.target?.value);
      });
    }
    syncOptionsCustomSelects(panel);
    panel.classList.remove("hidden");
  }

  function renderAishellTechVietnameseAiSettingsSection(panel, headerHtml, defaultsTipId) {
    panel.innerHTML = [
      '<div class="asr-ai-panel">',
      headerHtml,
      '<div class="asr-ai-note" id="' + defaultsTipId + '"></div>',
      '<div class="asr-ai-block"><strong>基础设置</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>启用 AI 识别文本</span><label class="asr-ai-boolean"><input id="aishell-tech-ai-recommend-enabled" type="checkbox" /><span>关闭后不显示当前条识别与批量保存面板</span></label></label>',
      renderSharedAsrAutofillConcurrencyField(aishellTechVietnameseScriptId),
      '<label class="asr-ai-field"><span>请求超时时间（ms）</span><input id="aishell-tech-ai-timeout" type="number" min="1000" max="300000" step="1000" /></label>',
      '<label class="asr-ai-field"><span>思考开关</span><label class="asr-ai-boolean"><input id="aishell-tech-ai-enable-thinking" type="checkbox" /><span>thinking 已全局固定关闭，以避免请求链路拖慢。</span></label></label>',
      "</div></div>",
      '<div class="asr-ai-block"><strong>单阶段 Omni 识别</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>识别模型</span><select id="aishell-tech-ai-single-model-select" data-options-custom-select="true"></select><span class="asr-ai-help">默认 `qwen3.5-omni-flash`，可在 Omni 模型列表中切换。</span></label>',
      '<label class="asr-ai-field"><span>识别 Prompt（可选）</span><textarea id="aishell-tech-ai-single-prompt" maxlength="8000"></textarea><span class="asr-ai-help">留空或恢复默认时，使用后端默认 Prompt。</span></label>',
      '</div><div class="asr-ai-grid three">' +
        buildAishellTechStageParamFieldsMarkup("single", false) +
        "</div></div>",
      "</div>",
    ].join("");
    syncOptionsCustomSelects(panel);
    panel.classList.remove("hidden");
  }

  function renderAishellTechThaiAiSettingsSection(panel, headerHtml, defaultsTipId) {
    panel.innerHTML = [
      '<div class="asr-ai-panel">',
      headerHtml,
      '<div class="asr-ai-note" id="' + defaultsTipId + '"></div>',
      '<div class="asr-ai-block"><strong>基础设置</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>启用 AI 文本与语速识别</span><label class="asr-ai-boolean"><input id="aishell-tech-ai-recommend-enabled" type="checkbox" /><span>关闭后不显示当前条识别与批量保存面板</span></label></label>',
      renderSharedAsrAutofillConcurrencyField(aishellTechThaiScriptId),
      '<label class="asr-ai-field"><span>请求超时时间（ms）</span><input id="aishell-tech-ai-timeout" type="number" min="1000" max="300000" step="1000" /></label>',
      '<label class="asr-ai-field"><span>思考开关</span><label class="asr-ai-boolean"><input id="aishell-tech-ai-enable-thinking" type="checkbox" /><span>thinking 已全局固定关闭，以避免请求链路拖慢。</span></label></label>',
      "</div></div>",
      '<div class="asr-ai-block"><strong>单阶段 Omni 识别</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>识别模型</span><select id="aishell-tech-ai-single-model-select" data-options-custom-select="true"></select><span class="asr-ai-help">默认 `qwen3.5-omni-flash`，同时输出泰语文本与语速建议。</span></label>',
      '<label class="asr-ai-field"><span>识别 Prompt（可选）</span><textarea id="aishell-tech-ai-single-prompt" maxlength="8000"></textarea><span class="asr-ai-help">留空或恢复默认时，使用后端默认 Prompt。</span></label>',
      '</div><div class="asr-ai-grid three">' +
        buildAishellTechStageParamFieldsMarkup("single", false) +
        "</div></div>",
      "</div>",
    ].join("");
    syncOptionsCustomSelects(panel);
    panel.classList.remove("hidden");
  }

  function getJdTtsShanghaineseConfig(settings) {
    const defaults =
      constants.DEFAULT_SETTINGS?.platforms?.jdTtsAnnotation?.scripts?.shanghaineseHelper || {};
    const current = settings?.platforms?.jdTtsAnnotation?.scripts?.shanghaineseHelper || {};
    const config = Object.assign(
      {
        id: jdTtsShanghaineseScriptId,
        enabled: false,
        aiRecommendEnabled: false,
        aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
        aiRecommendSingleModel: "qwen3.5-omni-plus",
        aiRecommendSinglePrompt: "",
        aiRecommendTemperature: "",
        aiRecommendTopP: "",
        aiRecommendMaxTokens: "",
        aiRecommendMaxCompletionTokens: "",
        aiRecommendPresencePenalty: "",
        aiRecommendFrequencyPenalty: "",
        aiRecommendSeed: "",
        aiRecommendStopSequences: "",
      },
      defaults,
      current
    );
    config.id = jdTtsShanghaineseScriptId;
    config.enabled = config.enabled === true;
    config.aiRecommendEnabled = config.aiRecommendEnabled === true;
    config.aiRecommendRequestTimeoutMs = DEFAULT_AI_REQUEST_TIMEOUT_MS;
    config.aiRecommendSingleModel = normalizeDataBakerSingleModel(
      config.aiRecommendSingleModel,
      "qwen3.5-omni-plus"
    );
    config.aiRecommendSinglePrompt = normalizePromptText(config.aiRecommendSinglePrompt || "");
    normalizeAishellTechStageParamFields(config, "aiRecommend");
    config.aiRecommendEnableThinking = false;
    delete config.aiOmni;
    return config;
  }

  function renderAishellTechCantoneseAiSettingsSection(panel, headerHtml, defaultsTipId) {
    panel.innerHTML = [
      '<div class="asr-ai-panel">',
      headerHtml,
      '<div class="asr-ai-note" id="' + defaultsTipId + '"></div>',
      '<div class="asr-ai-block"><strong>基础设置</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>启用 AI 粤语原始听写</span><label class="asr-ai-boolean"><input id="aishell-tech-ai-recommend-enabled" type="checkbox" /><span>关闭后不显示当前条原始听写与批量保存面板</span></label></label>',
      renderSharedAsrAutofillConcurrencyField(aishellTechCantoneseScriptId),
      '<div class="asr-ai-field"><span>请求超时时间</span><span class="asr-ai-help">60000ms（固定）</span></div>',
      '<label class="asr-ai-field"><span>思考开关</span><label class="asr-ai-boolean"><input id="aishell-tech-ai-enable-thinking" type="checkbox" /><span>thinking 已全局固定关闭，以避免请求链路拖慢。</span></label></label>',
      "</div></div>",
      '<div class="asr-ai-block"><strong>单阶段 Omni 粤语原始听写</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>原始听写模型</span><select id="aishell-tech-ai-single-model-select" data-options-custom-select="true"></select><span class="asr-ai-help">默认 `qwen3.5-omni-plus`，仅返回繁体粤语口语原文 listenText。</span></label>',
      '<label class="asr-ai-field"><span>原始听写 Prompt（可选）</span><textarea id="aishell-tech-ai-single-prompt" maxlength="8000"></textarea><span class="asr-ai-help">留空或恢复默认时，使用后端默认 Prompt。</span></label>',
      '</div><div class="asr-ai-grid three">' +
        buildAishellTechStageParamFieldsMarkup("single", false) +
        "</div></div>",
      "</div>",
    ].join("");
    syncOptionsCustomSelects(panel);
    panel.classList.remove("hidden");
  }

  function renderJdTtsShanghaineseAiSettingsSection(panel, headerHtml, defaultsTipId) {
    const parameterFields = aishellTechStageParamDefinitions
      .map(function (definition) {
        const id = "jd-tts-ai-single-" + definition.domSuffix;
        const type = definition.type === "stop" ? "textarea" : "input";
        const control =
          type === "textarea"
            ? '<textarea id="' + id + '" maxlength="960"></textarea>'
            : '<input id="' + id + '" type="number" />';
        return '<label class="asr-ai-field"><span>' + definition.apiKey + "</span>" + control + "</label>";
      })
      .join("");
    panel.innerHTML = [
      '<div class="asr-ai-panel">',
      headerHtml,
      '<div class="asr-ai-note" id="' + defaultsTipId + '"></div>',
      '<div class="asr-ai-block"><strong>基础设置</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>启用 AI 识别</span><label class="asr-ai-boolean"><input id="jd-tts-ai-recommend-enabled" type="checkbox" /><span>仅识别并填入当前文本框，不保存或提交</span></label></label>',
      '<div class="asr-ai-field"><span>请求超时时间</span><span class="asr-ai-help">60000ms（固定）</span></div>',
      '<label class="asr-ai-field"><span>思考开关</span><label class="asr-ai-boolean"><input id="jd-tts-ai-enable-thinking" type="checkbox" disabled aria-disabled="true" /><span>thinking 已固定关闭</span></label></label>',
      '</div></div>',
      '<div class="asr-ai-block"><strong>单阶段 Omni 上海话识别</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>识别模型</span><select id="jd-tts-ai-single-model-select" data-options-custom-select="true"></select></label>',
      '<label class="asr-ai-field"><span>识别 Prompt（可选）</span><textarea id="jd-tts-ai-single-prompt" maxlength="8000"></textarea><span class="asr-ai-help">留空时使用后端默认 Prompt。</span></label>',
      '</div><div class="asr-ai-grid three">' + parameterFields + "</div></div>",
      "</div>",
    ].join("");
    syncOptionsCustomSelects(panel);
    panel.classList.remove("hidden");
  }

  function renderDataBakerCvpcAiSettingsSection(panel, headerHtml, defaultsTipId) {
    panel.innerHTML = [
      '<div class="asr-ai-panel">',
      headerHtml,
      '<div class="asr-ai-note" id="' + defaultsTipId + '"></div>',
      '<div class="asr-ai-block"><strong>基础设置</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>启用 AI 推荐文本</span><label class="asr-ai-boolean"><input id="data-baker-cvpc-ai-recommend-enabled" type="checkbox" /><span>关闭后不显示当前段 AI 推荐结果</span></label></label>',
      '<label class="asr-ai-field"><span>请求超时时间（ms）</span><input id="data-baker-cvpc-ai-timeout" type="number" min="1000" max="300000" step="1000" /></label>',
      '<label class="asr-ai-field"><span>思考开关</span><label class="asr-ai-boolean"><input id="data-baker-cvpc-ai-enable-thinking" type="checkbox" /><span>thinking 已全局固定关闭，以避免请求链路拖慢。</span></label></label>',
      "</div></div>",
      '<div class="asr-ai-block"><strong>听音</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>听音模型</span><select id="data-baker-cvpc-ai-listen-model-select" data-options-custom-select="true"></select><span class="asr-ai-help" id="data-baker-cvpc-ai-listen-model-help"></span></label>',
      '<label class="asr-ai-field"><span>听音 Prompt（可选）</span><textarea id="data-baker-cvpc-ai-listen-prompt" maxlength="8000"></textarea><span class="asr-ai-help">留空或恢复默认时，使用后端默认 Prompt。</span></label>',
      '<label class="asr-ai-field"><span>附带词表参考（听音辅助）</span><label class="asr-ai-boolean"><input id="data-baker-cvpc-ai-listen-include-lexicon-reference" type="checkbox" /><span>默认关闭。关闭后 listen 只按当前段音频听写；开启后才附带词表参考片段。</span></label></label>',
      '</div><div class="asr-ai-grid three">' +
        buildDataBakerCvpcStageParamFieldsMarkup("listen") +
        "</div></div>",
      '<div class="asr-ai-block"><strong>文本修正</strong><div class="asr-ai-grid two">',
      '<label class="asr-ai-field"><span>文本修正模型</span><select id="data-baker-cvpc-ai-refine-model-select" data-options-custom-select="true"></select><span class="asr-ai-help">结合听音结果、普通话文本和字词表修正柳州话文本。</span></label>',
      '<label class="asr-ai-field"><span>文本修正 Prompt（可选）</span><textarea id="data-baker-cvpc-ai-refine-prompt" maxlength="8000"></textarea><span class="asr-ai-help">留空或恢复默认时，使用后端默认 Prompt。</span></label>',
      '</div><div class="asr-ai-grid three">' +
        buildDataBakerCvpcStageParamFieldsMarkup("refine") +
        "</div></div>",
      "</div>",
    ].join("");

    const listenNode = getElement("data-baker-cvpc-ai-listen-model-select");
    if (listenNode instanceof HTMLSelectElement) {
      listenNode.addEventListener("change", function (event) {
        const aiDefaults = getAsrVoiceAiDefaultsCached(dataBakerCvpcLiuzhouScriptId).defaults || {};
        const draftConfig = getDataBakerCvpcSettingsDraftConfig(aiDefaults);
        draftConfig.aiRecommendListenModel = normalizeDataBakerCvpcListenModel(
          event?.target?.value,
          getDataBakerCvpcStageDefaults(aiDefaults).listen.model
        );
        applyDataBakerCvpcStageFields(draftConfig, aiDefaults);
      });
    }

    syncOptionsCustomSelects(panel);
    panel.classList.remove("hidden");
  }

  function renderBytedanceAidpSuzhouAiSettingsSection(
    panel,
    headerHtml,
    defaultsTipId,
    scriptId
  ) {
    closeOptionsCustomSelects(null);
    const activeScriptId =
      scriptId === bytedanceAidpJinhuaScriptId
        ? bytedanceAidpJinhuaScriptId
        : bytedanceAidpSuzhouScriptId;
    const resultLabel =
      activeScriptId === bytedanceAidpJinhuaScriptId ? "普通话翻译" : "普通话听写";
    const resultHelpText =
      activeScriptId === bytedanceAidpJinhuaScriptId
        ? "把听音草稿收口成普通话翻译，不做语义润色。"
        : "把听音草稿收口成普通话听写稿，不做语义润色。";
    panel.innerHTML = [
      '<div class="asr-ai-panel">',
      headerHtml,
      '<div class="asr-ai-block"><strong>基础设置</strong><div class="asr-ai-grid two aidp-ai-controls aidp-ai-controls-two">',
      '<label class="asr-ai-field"><span>' +
        buildAsrAiLabelMarkup(
          "识别完成后自动填入",
          "单段识别成功后直接填入对应输入框，不主动走平台暂存请求。"
        ) +
        "</span>" +
        buildSwitchBooleanMarkup("bytedance-aidp-ai-recommend-auto-fill-enabled", {
          onText: "开启",
          offText: "关闭",
        }) +
        "</label>",
      '<label class="asr-ai-field"><span>' +
        buildAsrAiLabelMarkup(
          "思考开关",
          activeScriptId === bytedanceAidpJinhuaScriptId
            ? "thinking 已全局固定关闭；金华话脚本不允许开启 Omni 思考模式。"
            : "thinking 已全局固定关闭；苏州话脚本不允许开启 Omni 思考模式。"
        ) +
        "</span>" +
        buildSwitchBooleanMarkup("bytedance-aidp-ai-enable-thinking", {
          onText: "固定关闭",
          offText: "固定关闭",
          preserveText: true,
        }) +
        "</label>",
      '<label class="asr-ai-field"><span>' +
        buildAsrAiLabelMarkup("请求超时时间（秒）", "最小精度 0.001 秒，即 1ms。留空时使用后端默认值。") +
        '</span><input id="bytedance-aidp-ai-timeout" type="number" min="0.001" max="60" step="0.001" /></label>',
      activeScriptId === bytedanceAidpJinhuaScriptId
        ? '<label class="asr-ai-field"><span>' +
            buildAsrAiLabelMarkup(
              "模型模式",
              "普通模式沿用听音模型 + 收口模型；专家模式实际调用时两阶段都使用 qwen3.5-omni-plus。"
            ) +
            '</span><select id="bytedance-aidp-jinhua-model-mode-select" data-options-custom-select="true" data-options-placeholder="请选择模型模式"></select></label>'
        : "",
      "</div></div>",
      '<div class="asr-ai-block"><strong>听音</strong><div class="asr-ai-grid one">',
      '<label class="asr-ai-field"><span>' +
        buildAsrAiLabelMarkup(
          "听音模型",
          "听音阶段只根据当前段音频生成保守的原始听写草稿，不做" +
            resultLabel +
            "收口。"
        ) +
        '</span><select id="bytedance-aidp-ai-listen-model-select" data-options-custom-select="true" data-options-placeholder="请选择听音模型"></select></label>',
      '</div><div class="asr-ai-grid one">',
      '<label class="asr-ai-field"><span>' +
        buildAsrAiLabelMarkup(
          "听音 Prompt",
          "普通话不截取、未知实体用 `##名称##`、抖音音效和唱歌不截取。"
        ) +
        '</span><textarea id="bytedance-aidp-ai-listen-prompt" maxlength="8000"></textarea></label>',
      '</div><div class="asr-ai-grid two aidp-ai-stage-params">' +
        buildBytedanceAidpSuzhouStageParamFieldsMarkup("listen") +
        "</div></div>",
      '<div class="asr-ai-block"><strong>' +
        resultLabel +
        '收口</strong><div class="asr-ai-grid one">',
      '<label class="asr-ai-field"><span>' +
        buildAsrAiLabelMarkup("收口模型", resultHelpText) +
        '</span><select id="bytedance-aidp-ai-refine-model-select" data-options-custom-select="true" data-options-placeholder="请选择收口模型"></select></label>',
      '</div><div class="asr-ai-grid one">',
      '<label class="asr-ai-field"><span>' +
        buildAsrAiLabelMarkup(
          "收口 Prompt",
          "限制为 `，。？！`、未知实体用 `##名称##`、阿拉伯数字转汉字数字。"
        ) +
        '</span><textarea id="bytedance-aidp-ai-refine-prompt" maxlength="8000"></textarea></label>',
      '</div><div class="asr-ai-grid two aidp-ai-stage-params">' +
        buildBytedanceAidpSuzhouStageParamFieldsMarkup("refine") +
        "</div></div>",
      "</div>",
    ].join("");

    const aiDefaults = getAsrVoiceAiDefaultsCached(activeScriptId).defaults || {};
    const stageDefaults = getBytedanceAidpSuzhouStageDefaults(aiDefaults, activeScriptId);
    bindBytedanceAidpSuzhouStageParamHelp("listen", stageDefaults.listen);
    bindBytedanceAidpSuzhouStageParamHelp("refine", stageDefaults.refine);

    const modelModeNode = getElement("bytedance-aidp-jinhua-model-mode-select");
    if (modelModeNode instanceof HTMLSelectElement) {
      modelModeNode.addEventListener("change", function () {
        const aiDefaults = getAsrVoiceAiDefaultsCached(activeScriptId).defaults || {};
        const draftConfig = getBytedanceAidpSuzhouSettingsDraftConfig(
          aiDefaults,
          activeScriptId,
          getBytedanceAidpJinhuaConfig(currentSettings || {})
        );
        applyBytedanceAidpSuzhouStageFields(draftConfig, aiDefaults, activeScriptId);
      });
    }

    const listenNode = getElement("bytedance-aidp-ai-listen-model-select");
    if (listenNode instanceof HTMLSelectElement) {
      listenNode.addEventListener("change", function (event) {
        const aiDefaults = getAsrVoiceAiDefaultsCached(activeScriptId).defaults || {};
        const draftConfig = getBytedanceAidpSuzhouSettingsDraftConfig(
          aiDefaults,
          activeScriptId,
          activeScriptId === bytedanceAidpJinhuaScriptId
            ? getBytedanceAidpJinhuaConfig(currentSettings || {})
            : getBytedanceAidpSuzhouConfig(currentSettings || {})
        );
        draftConfig.aiRecommendListenModel = normalizeDataBakerCvpcListenModel(
          event?.target?.value,
          getBytedanceAidpSuzhouStageDefaults(aiDefaults, activeScriptId).listen.model
        );
        applyBytedanceAidpSuzhouStageFields(draftConfig, aiDefaults, activeScriptId);
      });
    }

    syncOptionsCustomSelects(panel);
    syncAidpLineNumberTextareas(panel);
    bindSwitchFieldText(panel);
    panel.classList.remove("hidden");
  }

  function shouldShowBytedanceAidpAiSettingsSection(settings, scriptId) {
    return getBytedanceAidpConfig(settings, scriptId).aiRecommendEnabled !== false;
  }

  function renderAsrVoiceAiSettingsSection(settings, scriptId) {
    const panel = getElement("detail-shared-asr-ai-panel");
    if (!panel) {
      return;
    }
    if (!supportsAsrVoiceAiSettings(scriptId) || !isAsrVoiceAiUnlocked(scriptId)) {
      panel.classList.add("hidden");
      panel.innerHTML = "";
      return;
    }

    const headerHtml = buildAsrVoiceAiHeader(scriptId);
    const defaultsTipId = "asr-ai-defaults-tip";
    if (scriptId === judgementProjectId || scriptId === transcriptionProjectId) {
      const prefix = scriptId === judgementProjectId ? "judgement-ai-suggestion" : "transcription-ai-suggestion";
      panel.innerHTML = [
        '<div class="asr-ai-panel">',
        headerHtml,
        '<div class="asr-ai-note" id="' + defaultsTipId + '"></div>',
        '<div class="asr-ai-block"><strong>基础模型</strong><div class="asr-ai-grid two">',
        '<label class="asr-ai-field"><span>听音模型</span><select id="' + prefix + '-listen-model-select" data-options-custom-select="true"></select></label>',
        '<label class="asr-ai-field"><span>比较模型</span><select id="' + prefix + '-compare-model-select" data-options-custom-select="true"></select></label>',
        '<label class="asr-ai-field"><span>听音模型自定义</span><input id="' + prefix + '-listen-model-custom" type="text" class="hidden" autocomplete="off" /></label>',
        '<label class="asr-ai-field"><span>比较模型自定义</span><input id="' + prefix + '-compare-model-custom" type="text" class="hidden" autocomplete="off" /></label>',
        '<label class="asr-ai-field"><span>请求超时时间（ms）</span><input id="' + prefix + '-timeout" type="number" min="1000" max="180000" step="1000" /></label>',
        '<label class="asr-ai-field"><span>思考开关</span><label class="asr-ai-boolean"><input id="' + prefix + '-enable-thinking" type="checkbox" /><span>thinking 已全局固定关闭，以避免 Omni 思考模式拖慢请求。</span></label></label>',
        scriptId === judgementProjectId
          ? '<label class="asr-ai-field"><span>联网搜索</span><label class="asr-ai-boolean"><input id="' + prefix + '-web-search-enabled" type="checkbox" /><span>启用 Web Search 联网搜索（专有名词/实体词消歧）</span></label></label>'
          : "",
        "</div></div>",
        '<div class="asr-ai-block"><strong>Prompt</strong><div class="asr-ai-grid">',
        '<label class="asr-ai-field"><span>听音 Prompt（可选）</span><textarea id="' + prefix + '-listen-prompt" maxlength="8000"></textarea><span class="asr-ai-help">留空或恢复默认时，使用后端默认 Prompt。</span></label>',
        '<label class="asr-ai-field"><span>比较 Prompt（可选）</span><textarea id="' + prefix + '-compare-prompt" maxlength="8000"></textarea><span class="asr-ai-help">留空或恢复默认时，使用后端默认 Prompt。</span></label>',
        "</div></div>",
        '<div class="asr-ai-block"><strong>生成参数</strong><div class="asr-ai-grid three">',
        '<label class="asr-ai-field"><span>temperature</span><input id="' + prefix + '-temperature" type="number" min="0" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>top_p</span><input id="' + prefix + '-top-p" type="number" min="0" max="1" step="0.05" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>max_tokens</span><input id="' + prefix + '-max-tokens" type="number" min="1" max="8192" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>max_completion_tokens</span><input id="' + prefix + '-max-completion-tokens" type="number" min="1" max="8192" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>presence_penalty</span><input id="' + prefix + '-presence-penalty" type="number" min="-2" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>frequency_penalty</span><input id="' + prefix + '-frequency-penalty" type="number" min="-2" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>seed</span><input id="' + prefix + '-seed" type="number" min="0" max="2147483647" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>stop sequences</span><textarea id="' + prefix + '-stop-sequences" maxlength="960"></textarea><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        "</div></div>",
        "</div>",
      ].join("");
      syncOptionsCustomSelects(panel);
      panel.classList.remove("hidden");
      return;
    }

    if (isAishellTechScript(scriptId)) {
      if (isAishellTechCnEnShortDramaScript(scriptId)) {
        panel.classList.add("hidden");
        panel.innerHTML = "";
        return;
      }
      if (isAishellTechVietnameseScript(scriptId)) {
        renderAishellTechVietnameseAiSettingsSection(panel, headerHtml, defaultsTipId);
      } else if (isAishellTechCantoneseScript(scriptId)) {
        renderAishellTechCantoneseAiSettingsSection(panel, headerHtml, defaultsTipId);
      } else if (isAishellTechThaiScript(scriptId)) {
        renderAishellTechThaiAiSettingsSection(panel, headerHtml, defaultsTipId);
      } else {
        renderAishellTechAiSettingsSection(panel, headerHtml, defaultsTipId);
      }
      return;
    }

    if (isJdTtsShanghaineseScript(scriptId)) {
      renderJdTtsShanghaineseAiSettingsSection(panel, headerHtml, defaultsTipId);
      return;
    }

    if (isDataBakerCvpcScript(scriptId)) {
      renderDataBakerCvpcAiSettingsSection(panel, headerHtml, defaultsTipId);
      return;
    }

    if (isBytedanceAidpScript(scriptId)) {
      if (!shouldShowBytedanceAidpAiSettingsSection(settings, scriptId)) {
        panel.classList.add("hidden");
        panel.innerHTML = "";
        return;
      }
      renderBytedanceAidpSuzhouAiSettingsSection(panel, headerHtml, defaultsTipId, scriptId);
      return;
    }

    if (scriptId === dataBakerRoundOneQualityScriptId || isMagicDataScript(scriptId)) {
      const panelSpec = buildSharedAsrAiPanelSpec(scriptId);
      const isDataBakerPanel = scriptId === dataBakerRoundOneQualityScriptId;
      const isMagicDataPanel = isMagicDataScript(scriptId);
      const useRecognitionStrategy = panelSpec.showRecognitionStrategy === true;
      const usePipelineModels = panelSpec.showPipelineMode === true;
      const prefix =
        panelSpec.prefix ||
        (isDataBakerPanel
          ? "data-baker-ai"
          : "magic-data-ai");
      const modelLabel = panelSpec.modelLabel || (usePipelineModels ? "比较模型" : "质检模型");
      const recognitionStrategyHelpText =
        scriptId === magicDataHangzhouScriptId
          ? "直接识别：以音频实际读音为准，词表只辅助杭州话转普通话，不从普通话反推杭州话。识别转换：会先识别普通话再按词表反推杭州话，结果可能不同于实际读音。"
          : "直接识别方言文本，或先识别普通话再按字词表转换为方言文本。";
      const modelFieldMarkup = {
        enabled: isDataBakerPanel
          ? '<label class="asr-ai-field"><span>启用 AI 推荐文本</span><label class="asr-ai-boolean"><input id="data-baker-ai-recommend-enabled" type="checkbox" /><span>关闭后不显示 AI 推荐工具卡</span></label></label>'
          : '<label class="asr-ai-field"><span>启用 AI 质检助手</span><label class="asr-ai-boolean"><input id="magic-data-enabled" type="checkbox" /><span>关闭后不显示 AI 质检建议</span></label></label>',
        pipelineMode:
          '<label class="asr-ai-field' +
          (usePipelineModels ? "" : " hidden") +
          '" id="' +
          prefix +
          '-pipeline-mode-field"><span>模型方案</span><select id="' +
          prefix +
          '-pipeline-mode-select" data-options-custom-select="true"></select><span class="asr-ai-help">模型方案：双模型或单模型。</span></label>',
        recognitionStrategy:
          '<label class="asr-ai-field' +
          (useRecognitionStrategy ? "" : " hidden") +
          '" id="' +
          prefix +
          '-recognition-strategy-field"><span>识别策略</span><select id="' +
          prefix +
          '-recognition-strategy-select" data-options-custom-select="true"></select><span class="asr-ai-help">' +
          recognitionStrategyHelpText +
          "</span></label>",
        listenModel:
          '<label class="asr-ai-field' +
          (usePipelineModels ? "" : " hidden") +
          '" id="' +
          prefix +
          '-listen-model-field"><span id="' +
          prefix +
          '-listen-model-label">听音模型</span><select id="' +
          prefix +
          '-listen-model-select" data-options-custom-select="true"></select><span class="asr-ai-help" id="' +
          prefix +
          '-listen-model-help"></span></label>',
        listenModelNote:
          '<div class="asr-ai-field hidden" id="' +
          prefix +
          '-listen-model-note"><span class="asr-ai-help">Fun-ASR 默认通过统一后端 REST provider 调用；只有显式切换时才会走 Python fallback。候选转写模型先结合页面原文与词表上下文生成词表转写文本，再由差异比较模型判断哪些差异需要采纳。</span></div>',
        singleModel:
          '<label class="asr-ai-field' +
          (usePipelineModels ? "" : " hidden") +
          '" id="' +
          prefix +
          '-single-model-field"><span>AI 模型</span><select id="' +
          prefix +
          '-single-model-select" data-options-custom-select="true"></select><span class="asr-ai-help">单模型只支持当前 Omni 模型列表，不调用 compare。</span></label>',
        compareModel:
          '<label class="asr-ai-field' +
          (usePipelineModels ? "" : " hidden") +
          '" id="' +
          prefix +
          '-compare-model-field"><span id="' +
          prefix +
          '-compare-model-label">' +
          modelLabel +
          '</span><select id="' +
          prefix +
          '-compare-model-select" data-options-custom-select="true"></select></label>',
        autofillConcurrency: renderSharedAsrAutofillConcurrencyField(scriptId),
        timeout:
          '<label class="asr-ai-field"><span>请求超时时间（ms）</span><input id="' +
          prefix +
          '-timeout" type="number" min="1000" max="300000" step="1000" /></label>',
        thinking:
          '<label class="asr-ai-field"><span>思考开关</span><label class="asr-ai-boolean"><input id="' +
          prefix +
          '-enable-thinking" type="checkbox" /><span>thinking 已全局固定关闭，以避免 Omni 思考模式拖慢请求。</span></label></label>',
        showHeardText: isMagicDataPanel
          ? '<label class="asr-ai-field"><label class="asr-ai-boolean"><input id="magic-data-show-heard-text" type="checkbox" /><span>显示 AI 听音文本</span></label></label>'
          : "",
        showEstimatedIncome: isMagicDataPanel
          ? '<label class="asr-ai-field"><label class="asr-ai-boolean"><input id="magic-data-show-estimated-income" type="checkbox" /><span>显示预计金额</span></label></label>'
          : "",
      };
      const orderedModelFields = (
        Array.isArray(panelSpec.modelFieldOrder) && panelSpec.modelFieldOrder.length > 0
          ? panelSpec.modelFieldOrder
          : Object.keys(modelFieldMarkup)
      )
        .map(function (fieldKey) {
          return modelFieldMarkup[fieldKey] || "";
        })
        .join("");
      panel.innerHTML = [
        '<div class="asr-ai-panel">',
        headerHtml,
        '<div class="asr-ai-note" id="' + defaultsTipId + '"></div>',
        '<div class="asr-ai-block"><strong>基础模型</strong><div class="asr-ai-grid two">',
        orderedModelFields,
        '<label class="asr-ai-field hidden" id="' + prefix + '-listen-model-custom-field"><span id="' + prefix + '-listen-model-custom-label">听音模型自定义</span><input id="' + prefix + '-listen-model-custom" type="text" class="hidden" autocomplete="off" /></label>',
        '<label class="asr-ai-field hidden" id="' + prefix + '-compare-model-custom-field"><span id="' + prefix + '-compare-model-custom-label">' + modelLabel + '自定义</span><input id="' + prefix + '-compare-model-custom" type="text" class="hidden" autocomplete="off" /></label>',
        "</div></div>",
        '<div class="asr-ai-block"><strong>Prompt</strong><div class="asr-ai-grid">',
        '<label class="asr-ai-field"><span>听音 Prompt（可选）</span><textarea id="' + prefix + '-listen-prompt" maxlength="8000"></textarea><span class="asr-ai-help">留空或恢复默认时，使用后端默认 Prompt。</span></label>',
        '<label class="asr-ai-field"><span id="' + prefix + '-compare-prompt-label">' + modelLabel + ' Prompt（可选）</span><textarea id="' + prefix + '-compare-prompt" maxlength="8000"></textarea><span class="asr-ai-help" id="' + prefix + '-compare-prompt-help">留空或恢复默认时，使用后端默认 Prompt。</span></label>',
        "</div></div>",
        '<div class="asr-ai-block"><strong>生成参数</strong><div class="asr-ai-grid three">',
        '<label class="asr-ai-field"><span>temperature</span><input id="' + prefix + '-temperature" type="number" min="0" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>top_p</span><input id="' + prefix + '-top-p" type="number" min="0" max="1" step="0.05" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>max_tokens</span><input id="' + prefix + '-max-tokens" type="number" min="1" max="8192" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>max_completion_tokens</span><input id="' + prefix + '-max-completion-tokens" type="number" min="1" max="8192" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>presence_penalty</span><input id="' + prefix + '-presence-penalty" type="number" min="-2" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>frequency_penalty</span><input id="' + prefix + '-frequency-penalty" type="number" min="-2" max="2" step="0.1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>seed</span><input id="' + prefix + '-seed" type="number" min="0" max="2147483647" step="1" /><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        '<label class="asr-ai-field"><span>stop sequences</span><textarea id="' + prefix + '-stop-sequences" maxlength="960"></textarea><span class="asr-ai-help">清空后使用后端默认值。</span></label>',
        "</div></div>",
        "</div>",
      ].join("");
      if (isDataBakerPanel) {
        const recognitionNode = getElement("data-baker-ai-pipeline-mode-select");
        const listenNode = getElement("data-baker-ai-listen-model-select");
        const singleNode = getElement("data-baker-ai-single-model-select");
        if (recognitionNode instanceof HTMLSelectElement) {
          recognitionNode.addEventListener("change", function (event) {
            updateDataBakerRecognitionModeFields(event?.target?.value);
          });
        }
        if (listenNode instanceof HTMLSelectElement) {
          listenNode.addEventListener("change", function (event) {
            updateDataBakerListenModelFields(event?.target?.value);
          });
        }
        if (singleNode instanceof HTMLSelectElement) {
          singleNode.addEventListener("change", function (event) {
            updateDataBakerSingleModelFields(event?.target?.value);
          });
        }
      } else if (isMagicDataPanel) {
        const magicDataScriptId = isMagicDataScript(scriptId)
          ? scriptId
          : magicDataAnnotatorScriptId;
        const recognitionNode = getElement("magic-data-ai-pipeline-mode-select");
        const strategyNode = getElement("magic-data-ai-recognition-strategy-select");
        const listenNode = getElement("magic-data-ai-listen-model-select");
        const compareNode = getElement("magic-data-ai-compare-model-select");
        const singleNode = getElement("magic-data-ai-single-model-select");
        if (recognitionNode instanceof HTMLSelectElement) {
          recognitionNode.addEventListener("change", function (event) {
            updateMagicDataRecognitionModeFields(magicDataScriptId, event?.target?.value);
          });
        }
        if (strategyNode instanceof HTMLSelectElement) {
          strategyNode.addEventListener("change", function (event) {
            updateMagicDataRecognitionStrategyFields(magicDataScriptId, event?.target?.value);
          });
        }
        if (listenNode instanceof HTMLSelectElement) {
          listenNode.addEventListener("change", function (event) {
            updateMagicDataListenModelFields(magicDataScriptId, event?.target?.value);
          });
        }
        if (compareNode instanceof HTMLSelectElement) {
          compareNode.addEventListener("change", function (event) {
            updateMagicDataCompareModelFields(magicDataScriptId, event?.target?.value);
          });
        }
        if (singleNode instanceof HTMLSelectElement) {
          singleNode.addEventListener("change", function (event) {
            updateMagicDataSingleModelFields(magicDataScriptId, event?.target?.value);
          });
        }
      } else {
        bindJudgementModelSelect(prefix + "-listen-model-select", prefix + "-listen-model-custom");
        bindJudgementModelSelect(prefix + "-compare-model-select", prefix + "-compare-model-custom");
      }
      syncOptionsCustomSelects(panel);
      panel.classList.remove("hidden");
      return;
    }

    panel.classList.add("hidden");
    panel.innerHTML = "";
  }

  function isScriptEnabled(settings, scriptId) {
    if (scriptId === lightwheelScriptId) {
      return Boolean(
        settings?.platforms?.lightwheel?.enabled &&
          settings?.platforms?.lightwheel?.scripts?.viewPanel?.enabled
      );
    }

    if (isDataBakerCvpcScript(scriptId)) {
      const config = getDataBakerCvpcLiuzhouConfig(settings);
      return Boolean(
        settings?.platforms?.dataBakerCvpc?.enabled !== false &&
          config.enabled !== false
      );
    }

    if (isBytedanceAidpScript(scriptId)) {
      const config = getBytedanceAidpConfig(settings, scriptId);
      const activeScriptId = getBytedanceAidpActiveScriptId(settings);
      return Boolean(
        settings?.platforms?.bytedanceAidp?.enabled !== false &&
          config.enabled !== false &&
          activeScriptId === scriptId
      );
    }

    if (isDataBakerScript(scriptId)) {
      const config = getDataBakerRoundOneConfig(settings);
      return Boolean(settings?.platforms?.dataBaker?.enabled !== false && config.enabled !== false);
    }

    if (isAishellTechScript(scriptId)) {
      const config = getAishellTechConfig(settings, scriptId);
      const activeScriptId = getAishellTechActiveScriptId(settings);
      return Boolean(
        settings?.platforms?.aishellTech?.enabled !== false &&
          config.enabled !== false &&
          (!activeScriptId || activeScriptId === scriptId)
      );
    }

    if (isMagicDataScript(scriptId)) {
      const config = getMagicDataConfig(settings, scriptId);
      const platformEnabled = settings?.platforms?.magicData?.enabled !== false;
      if (!platformEnabled || config.enabled === false || config.aiReviewEnabled === false) {
        return false;
      }
      const activeScriptId = getMagicDataActiveScriptId(settings);
      if (!activeScriptId) {
        return true;
      }
      return activeScriptId === scriptId;
    }

    if (isAbakaAiScript(scriptId)) {
      const config = getAbakaAiTaskPageConfig(settings);
      return Boolean(
        settings?.platforms?.abakaAi?.enabled !== false &&
          config.enabled !== false
      );
    }

    if (isHaitianUtransScript(scriptId)) {
      const config = getHaitianUtransAudioDownloadHelperConfig(settings);
      return Boolean(
        settings?.platforms?.haitianUtrans?.enabled !== false &&
          config.enabled !== false
      );
    }

    if (isJdTtsShanghaineseScript(scriptId)) {
      return Boolean(
        settings?.platforms?.jdTtsAnnotation?.enabled === true &&
          settings?.platforms?.jdTtsAnnotation?.activeScriptId === jdTtsShanghaineseScriptId &&
          settings?.platforms?.jdTtsAnnotation?.scripts?.shanghaineseHelper?.enabled === true &&
          settings?.platforms?.jdTtsAnnotation?.scripts?.shanghaineseHelper?.aiRecommendEnabled === true
      );
    }

    if (isLabelxScript(scriptId)) {
      return Boolean(
        settings?.platforms?.alibabaLabelx?.enabled &&
          getLabelxActiveScriptId(settings) === scriptId
      );
    }

    return false;
  }

  function getScriptStatus(settings, scriptId) {
    if (scriptId === lightwheelScriptId) {
      return isScriptEnabled(settings, scriptId)
        ? { text: "已启用", tone: "enabled" }
        : { text: "未启用", tone: "disabled" };
    }

    if (isDataBakerCvpcScript(scriptId)) {
      const config = getDataBakerCvpcLiuzhouConfig(settings);
      if (!isScriptEnabled(settings, scriptId)) {
        return { text: "未启用", tone: "disabled" };
      }
      if (config.segmentPreviewEnabled === false && config.aiRecommendEnabled === false) {
        return { text: "脚本已启用，建议入口已关闭", tone: "pending" };
      }
      if (config.segmentPreviewEnabled === false) {
        return { text: "脚本已启用，画段建议已关闭", tone: "pending" };
      }
      if (config.aiRecommendEnabled === false) {
        return { text: "脚本已启用，AI 推荐已关闭", tone: "pending" };
      }
      return { text: "已启用", tone: "enabled" };
    }

    if (isBytedanceAidpScript(scriptId)) {
      const config = getBytedanceAidpConfig(settings, scriptId);
      const activeScriptId = getBytedanceAidpActiveScriptId(settings);
      if (!isScriptEnabled(settings, scriptId)) {
        if (activeScriptId && activeScriptId !== scriptId) {
          const activeScript = scriptLibrary[activeScriptId] || {};
          return {
            text:
              "同平台当前为 " +
              String(activeScript.shortLabel || activeScript.label || activeScriptId),
            tone: "pending",
          };
        }
        return { text: "未启用", tone: "disabled" };
      }
      return config.platformAiEnabled === false
        ? { text: "脚本已启用，平台 AI 已隐藏", tone: "pending" }
        : { text: "已启用", tone: "enabled" };
    }

    if (isDataBakerScript(scriptId)) {
      const config = getDataBakerRoundOneConfig(settings);
      if (!isScriptEnabled(settings, scriptId)) {
        return { text: "未启用", tone: "disabled" };
      }
      return config.aiRecommendEnabled === false
        ? { text: "脚本已启用，AI 推荐已关闭", tone: "pending" }
        : { text: "已启用", tone: "enabled" };
    }

    if (isAishellTechScript(scriptId)) {
      const config = getAishellTechConfig(settings, scriptId);
      const activeScriptId = getAishellTechActiveScriptId(settings);
      if (!isScriptEnabled(settings, scriptId)) {
        if (activeScriptId && activeScriptId !== scriptId) {
          const activeScript = scriptLibrary[activeScriptId] || {};
          return {
            text:
              "同平台当前为 " +
              String(activeScript.shortLabel || activeScript.label || activeScriptId),
            tone: "pending",
          };
        }
        return { text: "未启用", tone: "disabled" };
      }
      return config.aiRecommendEnabled === false
        ? { text: "脚本已启用，AI 推荐已关闭", tone: "pending" }
        : { text: "已启用", tone: "enabled" };
    }

    if (isMagicDataScript(scriptId)) {
      const config = getMagicDataConfig(settings, scriptId);
      const activeScriptId = getMagicDataActiveScriptId(settings);
      if (!isScriptEnabled(settings, scriptId)) {
        if (activeScriptId && activeScriptId !== scriptId) {
          const activeScript = scriptLibrary[activeScriptId] || {};
          return {
            text:
              "同平台当前为 " +
              String(activeScript.shortLabel || activeScript.label || activeScriptId),
            tone: "pending",
          };
        }
        return { text: "未启用", tone: "disabled" };
      }
      return config.aiReviewEnabled === false
        ? { text: "脚本已启用，AI 质检已关闭", tone: "pending" }
        : { text: "已启用", tone: "enabled" };
    }

    if (isAbakaAiScript(scriptId)) {
      return isScriptEnabled(settings, scriptId)
        ? { text: "已启用（Task21 快捷键）", tone: "enabled" }
        : { text: "未启用", tone: "disabled" };
    }

    if (isHaitianUtransScript(scriptId)) {
      return isScriptEnabled(settings, scriptId)
        ? { text: "已启用", tone: "enabled" }
        : { text: "未启用", tone: "disabled" };
    }

    if (isJdTtsShanghaineseScript(scriptId)) {
      return isScriptEnabled(settings, scriptId)
        ? { text: "已启用", tone: "enabled" }
        : { text: "未启用", tone: "disabled" };
    }

    const labelxEnabled = Boolean(settings?.platforms?.alibabaLabelx?.enabled);
    const activeScriptId = getLabelxActiveScriptId(settings);

    if (!labelxEnabled) {
      return { text: "未启用", tone: "disabled" };
    }

    if (activeScriptId === scriptId) {
      return { text: "当前生效", tone: "enabled" };
    }

    const activeScript = scriptLibrary[activeScriptId] || {};
    return {
      text: "同平台当前为 " + String(activeScript.shortLabel || activeScript.label || activeScriptId),
      tone: "pending",
    };
  }

  function getScriptHostText(scriptId) {
    if (scriptId === lightwheelScriptId) {
      return "https://label-cloud.lightwheel.net/w/video3/index.html?access=1";
    }

    if (isDataBakerCvpcScript(scriptId)) {
      return "https://cvpc.data-baker.com/app/editor/asr/?project_id=...&task_id=...&process_id=...";
    }

    if (isDataBakerScript(scriptId)) {
      return "https://datafactory.data-baker.com/v2/#/quality/roundOneCollect?collectId=...&checkType=0";
    }

    if (isAishellTechScript(scriptId)) {
      return "https://mark.aishelltech.com/mytask/mark?taskId=...&packageId=...";
    }

    if (isMagicDataScript(scriptId)) {
      return "https://work.magicdatatech.com/#/asrmark?taskItemId=...";
    }

    if (isAbakaAiScript(scriptId)) {
      return "http://abao.fortidyndns.com:30473/items?taskId=...";
    }

    return "https://labelx.alibaba-inc.com/corpora/labeling/*";
  }

  function setScriptStatusNode(node, status) {
    node.textContent = status.text;
    node.className = "script-pill " + status.tone;
  }

  function normalizeTranscriptionConfig(settings) {
    const projectState =
      settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.[transcriptionProjectId] || {};
    const asrConfig = projectState.asrConfig || {};
    const defaults = constants.DEFAULT_ASR_CONFIG || {
      autoPlay: true,
      defaultValid: false,
      fillOnValid: true,
      clearOnInvalid: true,
      playbackRateValue: 1.5,
      resetRateValue: 1.5,
      rateStepValue: 0.25,
      seekStepSeconds: 0.5,
      volumeValue: 100,
      shortcutPlayPause: null,
      shortcutValid: null,
      shortcutInvalid: null,
      shortcutFill: null,
      shortcutRemoveSpaces: null,
      shortcutConvertNum: null,
      shortcutToggleFocus: null,
      shortcutBackward: null,
      shortcutForward: null,
      shortcutSpeedDown: null,
      shortcutSpeedUp: null,
      shortcutResetSpeed: null,
      shortcutVolDown: null,
      shortcutVolUp: null,
      shortcutResetVol: null,
      shortcutCopyDuration: null,
      shortcutUploadStats: null,
      shortcutSubmitTask: null,
      shortcutSubmitTaskAndFinish: null,
      shortcutAiSuggest: null,
      shortcutApplyAiSuggestion: null,
      statsUploadEnabled: true,
      statsUploadTimes: ["10:00", "16:00"],
      statsUploadJitterMinutes: 10,
      statsAutoUploadOnSchedule: true,
      statsUploadRequestTimeoutMs: 20000,
    };

    const shortcuts = {};
    transcriptionShortcutActions.forEach(function (action) {
      const sourceShortcut = hasOwn(asrConfig, action.key)
        ? asrConfig[action.key]
        : hasOwn(defaults, action.key)
          ? defaults[action.key]
          : null;
      shortcuts[action.key] = normalizeShortcut(sourceShortcut);
    });

    const resetRateValue = clampNumber(
      hasOwn(asrConfig, "resetRateValue")
        ? asrConfig.resetRateValue
        : hasOwn(asrConfig, "playbackRateValue")
          ? asrConfig.playbackRateValue
          : defaults.resetRateValue || defaults.playbackRateValue || 1,
      defaults.resetRateValue || defaults.playbackRateValue || 1,
      0.25,
      5,
      2
    );

    return {
      autoPlay: asrConfig.autoPlay === true,
      defaultValid: asrConfig.defaultValid === true,
      fillOnValid: asrConfig.fillOnValid !== false,
      clearOnInvalid: asrConfig.clearOnInvalid !== false,
      playbackRateValue: clampNumber(
        hasOwn(asrConfig, "playbackRateValue") ? asrConfig.playbackRateValue : resetRateValue,
        resetRateValue,
        0.25,
        5,
        2
      ),
      resetRateValue: resetRateValue,
      rateStepValue: normalizeTranscriptionRateStep(
        asrConfig.rateStepValue,
        defaults.rateStepValue || 0.25
      ),
      seekStepSeconds: normalizeTranscriptionSeekStep(
        asrConfig.seekStepSeconds,
        defaults.seekStepSeconds || 0.5
      ),
      volumeValue: clampNumber(
        asrConfig.volumeValue,
        defaults.volumeValue || 100,
        0,
        1000,
        0
      ),
      shortcuts: shortcuts,
      statsUploadEnabled: true,
      statsUploadTimes: normalizeTimeList(asrConfig.statsUploadTimes, defaults.statsUploadTimes),
      statsUploadJitterMinutes: clampNumber(
        asrConfig.statsUploadJitterMinutes,
        defaults.statsUploadJitterMinutes || 10,
        0,
        120,
        0
      ),
      statsAutoUploadOnSchedule: true,
      statsUploadRequestTimeoutMs: clampNumber(
        asrConfig.statsUploadRequestTimeoutMs,
        defaults.statsUploadRequestTimeoutMs || 20000,
        1000,
        120000,
        0
      ),
    };
  }

  function normalizeJudgementConfig(settings) {
    const projectState =
      settings?.platforms?.alibabaLabelx?.scriptCenter?.projects?.[judgementProjectId] || {};
    const asrConfig = projectState.asrConfig || {};
    const defaults = constants.DEFAULT_JUDGEMENT_ASR_CONFIG || {
      autoPlay: true,
      autoResetRate: true,
      resetRateValue: 2.0,
      playbackRateValue: 2.0,
      rateStepValue: 0.25,
      seekStepSeconds: 0.5,
      volumeValue: 100,
      itemsPerPage: "50 条/页",
      virtualWindowEnabled: false,
      asrDiffViewEnabled: true,
      asrDiffColors: {
        changeBackground: "#fef3c7",
        gapBackground: "#fee2e2",
        punctuationBackground: "#ede9fe",
      },
      compactCardEnabled: true,
      thunderQuestionEnabled: true,
      autoAdvanceAfterChoice: false,
      statsUploadEnabled: true,
      statsScheduleUrl: "",
      statsUploadTimes: ["10:00", "16:00"],
      statsUploadJitterMinutes: 10,
      statsAutoUploadOnSubtaskOpen: false,
      statsAutoUploadOnSchedule: true,
      statsUploadRequestTimeoutMs: 20000,
      aiSuggestionEnabled: true,
      aiSuggestionRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
      aiSuggestionListenModel: "qwen3.5-omni-flash",
      aiSuggestionCompareModel: "qwen3.5-plus",
      aiSuggestionListenPrompt: "",
      aiSuggestionComparePrompt: "",
      aiSuggestionTemperature: "",
      aiSuggestionTopP: "",
      aiSuggestionMaxTokens: "",
      aiSuggestionMaxCompletionTokens: "",
      aiSuggestionPresencePenalty: "",
      aiSuggestionFrequencyPenalty: "",
      aiSuggestionSeed: "",
      aiSuggestionResponseFormat: "json_object",
      aiSuggestionReasoningEffort: "",
      aiSuggestionStopSequences: "",
      aiSuggestionEnableThinking: false,
      aiSuggestionWebSearchEnabled: true,
      aiSuggestionModel: "qwen3.5-plus",
      aiSuggestionAvailableModels: judgementAiCompareModels.slice(),
      shortcuts: {
        volumeUp: {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          key: "[",
          button: null,
        },
        volumeDown: {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          key: "]",
          button: null,
        },
        volumeReset: {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          key: "\\",
          button: null,
        },
        seekBackward: {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          key: "ArrowLeft",
          button: null,
        },
        seekForward: {
          ctrl: false,
          alt: false,
          shift: false,
          meta: false,
          key: "ArrowRight",
          button: null,
        },
      },
    };
    const shortcuts = {};
    const asrDiffColors = normalizeJudgementDiffColors(
      asrConfig.asrDiffColors,
      defaults.asrDiffColors
    );

    judgementShortcutActions.forEach(function (action) {
      const shortcut = hasOwn(asrConfig.shortcuts || {}, action.key)
        ? asrConfig.shortcuts[action.key]
        : hasOwn(defaults.shortcuts || {}, action.key)
        ? defaults.shortcuts[action.key]
        : null;
      shortcuts[action.key] = normalizeShortcut(shortcut);
    });

    const defaultPlaybackRate = clampNumber(
      hasOwn(asrConfig, "resetRateValue") ? asrConfig.resetRateValue : asrConfig.playbackRateValue,
      defaults.resetRateValue || defaults.playbackRateValue || 1,
      0.25,
      5,
      2
    );

    return {
      autoPlay: asrConfig.autoPlay !== false,
      autoResetRate: true,
      resetRateValue: defaultPlaybackRate,
      playbackRateValue: defaultPlaybackRate,
      rateStepValue: normalizeJudgementRateStep(
        asrConfig.rateStepValue,
        defaults.rateStepValue || 0.25
      ),
      seekStepSeconds: normalizeJudgementSeekStep(
        asrConfig.seekStepSeconds,
        defaults.seekStepSeconds || 0.5
      ),
      volumeValue:
        typeof asrConfig.volumeValue === "number" && asrConfig.volumeValue >= 0
          ? asrConfig.volumeValue
          : defaults.volumeValue,
      itemsPerPage: normalizeJudgementItemsPerPage(
        asrConfig.itemsPerPage,
        defaults.itemsPerPage || "50 条/页"
      ),
      virtualWindowEnabled: false,
      asrDiffViewEnabled: asrConfig.asrDiffViewEnabled !== false,
      asrDiffColors: asrDiffColors,
      compactCardEnabled: asrConfig.compactCardEnabled !== false,
      thunderQuestionEnabled: asrConfig.thunderQuestionEnabled !== false,
      autoAdvanceAfterChoice: asrConfig.autoAdvanceAfterChoice === true,
      statsUploadEnabled: true,
      statsScheduleUrl:
        typeof asrConfig.statsScheduleUrl === "string" ? asrConfig.statsScheduleUrl.trim() : "",
      statsUploadTimes: normalizeTimeList(
        asrConfig.statsUploadTimes,
        defaults.statsUploadTimes
      ),
      statsUploadJitterMinutes: clampNumber(
        asrConfig.statsUploadJitterMinutes,
        defaults.statsUploadJitterMinutes || 10,
        0,
        120,
        0
      ),
      statsAutoUploadOnSubtaskOpen: false,
      statsAutoUploadOnSchedule: true,
      statsUploadRequestTimeoutMs: clampNumber(
        asrConfig.statsUploadRequestTimeoutMs,
        defaults.statsUploadRequestTimeoutMs || 20000,
        1000,
        120000,
        0
      ),
      aiSuggestionEnabled: true,
      aiSuggestionRequestTimeoutMs: clampNumber(
        asrConfig.aiSuggestionRequestTimeoutMs,
        defaults.aiSuggestionRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS,
        1000,
        180000,
        0
      ),
      aiSuggestionAvailableModels: normalizeJudgementAiAvailableModels(
        asrConfig.aiSuggestionAvailableModels,
        defaults.aiSuggestionAvailableModels
      ),
      aiSuggestionListenModel: normalizeJudgementAiModelText(
        asrConfig.aiSuggestionListenModel,
        defaults.aiSuggestionListenModel || "qwen3.5-omni-flash"
      ),
      aiSuggestionCompareModel: normalizeJudgementAiModelText(
        asrConfig.aiSuggestionCompareModel || asrConfig.aiSuggestionModel,
        defaults.aiSuggestionCompareModel || defaults.aiSuggestionModel || "qwen3.5-plus"
      ),
      aiSuggestionListenPrompt: normalizePromptText(asrConfig.aiSuggestionListenPrompt || ""),
      aiSuggestionComparePrompt: normalizePromptText(asrConfig.aiSuggestionComparePrompt || ""),
      aiSuggestionTemperature: normalizeOptionalNumberText(
        asrConfig.aiSuggestionTemperature,
        0,
        2,
        3
      ),
      aiSuggestionTopP: normalizeOptionalNumberText(asrConfig.aiSuggestionTopP, 0, 1, 3),
      aiSuggestionMaxTokens: normalizeOptionalIntegerText(asrConfig.aiSuggestionMaxTokens, 1, 8192),
      aiSuggestionMaxCompletionTokens: normalizeOptionalIntegerText(
        asrConfig.aiSuggestionMaxCompletionTokens,
        1,
        8192
      ),
      aiSuggestionPresencePenalty: normalizeOptionalNumberText(
        asrConfig.aiSuggestionPresencePenalty,
        -2,
        2,
        3
      ),
      aiSuggestionFrequencyPenalty: normalizeOptionalNumberText(
        asrConfig.aiSuggestionFrequencyPenalty,
        -2,
        2,
        3
      ),
      aiSuggestionSeed: normalizeOptionalIntegerText(asrConfig.aiSuggestionSeed, 0, 2147483647),
      aiSuggestionResponseFormat: normalizeResponseFormat(
        asrConfig.aiSuggestionResponseFormat,
        defaults.aiSuggestionResponseFormat || "json_object"
      ),
      aiSuggestionReasoningEffort: "",
      aiSuggestionStopSequences: normalizeStopSequencesText(asrConfig.aiSuggestionStopSequences),
      aiSuggestionEnableThinking: asrConfig.aiSuggestionEnableThinking === true,
      aiSuggestionWebSearchEnabled: asrConfig.aiSuggestionWebSearchEnabled !== false,
      aiSuggestionModel: normalizeJudgementAiModelText(
        asrConfig.aiSuggestionCompareModel || asrConfig.aiSuggestionModel,
        defaults.aiSuggestionCompareModel || defaults.aiSuggestionModel || "qwen3.5-plus"
      ),
      shortcuts: shortcuts,
    };
  }

  function normalizeShortcut(shortcut) {
    if (!shortcut || typeof shortcut !== "object") {
      return null;
    }

    const hasKey = typeof shortcut.key === "string" && shortcut.key.length > 0;
    const hasButton = typeof shortcut.button === "number";
    if (!hasKey && !hasButton) {
      return null;
    }

    return {
      ctrl: shortcut.ctrl === true,
      alt: shortcut.alt === true,
      shift: shortcut.shift === true,
      meta: shortcut.meta === true,
      key: hasKey ? shortcut.key : null,
      button: hasButton ? shortcut.button : null,
    };
  }

  function normalizeKeyName(key) {
    if (key === " ") {
      return "Space";
    }
    return String(key || "");
  }

  function formatShortcut(shortcut) {
    const normalized = normalizeShortcut(shortcut);
    if (!normalized) {
      return "未设置";
    }

    const parts = [];
    if (normalized.ctrl) {
      parts.push("Ctrl");
    }
    if (normalized.alt) {
      parts.push("Alt");
    }
    if (normalized.shift) {
      parts.push("Shift");
    }
    if (normalized.meta) {
      parts.push("Meta");
    }

    if (typeof normalized.button === "number") {
      parts.push(mouseButtonLabels[normalized.button] || "Mouse" + normalized.button);
    } else {
      parts.push(normalizeKeyName(normalized.key));
    }

    return parts.join(" + ");
  }

  function renderSharedShortcutGrid(container, options) {
    if (!container) {
      return;
    }
    if (typeof sharedShortcutPanel.renderShortcutGrid === "function") {
      sharedShortcutPanel.renderShortcutGrid(container, options);
      return;
    }
    container.innerHTML = "";
  }

  function bindSharedShortcutButtons(grid, attributeName, handler) {
    if (!grid || !attributeName || typeof handler !== "function") {
      return;
    }
    Array.from(grid.querySelectorAll("[" + attributeName + "]")).forEach(function (button) {
      button.addEventListener("click", function () {
        handler(button.getAttribute(attributeName));
      });
    });
  }

  function renderRecordableShortcutGrid(config) {
    const options = config && typeof config === "object" ? config : {};
    const grid = getElement(options.gridId);
    if (!grid) {
      return;
    }

    renderSharedShortcutGrid(grid, {
      mode: "recordable",
      actions: options.actions,
      values: options.values,
      recordingKey: options.recordingKey,
      formatShortcut: formatShortcut,
      recordAttrName: options.recordAttrName,
      clearAttrName: options.clearAttrName,
    });

    bindSharedShortcutButtons(grid, options.recordAttrName, options.onRecord);
    bindSharedShortcutButtons(grid, options.clearAttrName, options.onClear);
  }

  function renderReadonlyShortcutGrid(config) {
    const options = config && typeof config === "object" ? config : {};
    const grid = getElement(options.gridId);
    if (!grid) {
      return;
    }

    renderSharedShortcutGrid(grid, {
      mode: "readonly",
      actions: options.actions,
      values: options.values,
      formatShortcut: formatShortcut,
    });
  }

  function ensureDataBakerCvpcShortcutDraft() {
    dataBakerCvpcShortcutActions.forEach(function (action) {
      if (!hasOwn(dataBakerCvpcShortcutsDraft, action.key)) {
        dataBakerCvpcShortcutsDraft[action.key] = null;
      }
    });
  }

  function renderDataBakerCvpcShortcutGrid() {
    ensureDataBakerCvpcShortcutDraft();
    renderRecordableShortcutGrid({
      gridId: "data-baker-cvpc-shortcut-grid",
      actions: dataBakerCvpcShortcutActions,
      values: dataBakerCvpcShortcutsDraft,
      recordingKey: dataBakerCvpcRecordingKey,
      recordAttrName: "data-record-data-baker-cvpc-shortcut",
      clearAttrName: "data-clear-data-baker-cvpc-shortcut",
      onRecord: function (key) {
        startDataBakerCvpcShortcutRecording(key);
      },
      onClear: function (key) {
        dataBakerCvpcShortcutsDraft[key] = null;
        if (dataBakerCvpcRecordingKey === key) {
          stopDataBakerCvpcShortcutRecording("快捷键录制已取消。");
          return;
        }
        setDataBakerCvpcRecordingStatus("快捷键已删除，保存后生效。");
        renderDataBakerCvpcShortcutGrid();
      },
    });
  }

  function setDataBakerCvpcRecordingStatus(text) {
    const node = getElement("data-baker-cvpc-recording-status");
    if (!node) {
      return;
    }
    const value = String(text || "").trim();
    node.textContent = value;
    node.classList.toggle("hidden", !value);
  }

  function stopDataBakerCvpcShortcutRecording(statusText) {
    if (typeof stopDataBakerCvpcRecordingListeners === "function") {
      stopDataBakerCvpcRecordingListeners();
      stopDataBakerCvpcRecordingListeners = null;
    }
    dataBakerCvpcRecordingKey = null;
    setDataBakerCvpcRecordingStatus(statusText || "");
    renderDataBakerCvpcShortcutGrid();
  }

  function applyRecordedDataBakerCvpcShortcut(shortcut) {
    if (!dataBakerCvpcRecordingKey || shortcut === false) {
      return;
    }
    if (!shortcut) {
      stopDataBakerCvpcShortcutRecording("已取消快捷键录制。");
      return;
    }
    dataBakerCvpcShortcutsDraft[dataBakerCvpcRecordingKey] = normalizeNullableShortcut(shortcut);
    stopDataBakerCvpcShortcutRecording("快捷键已录制，保存后生效。");
  }

  function startDataBakerCvpcShortcutRecording(actionKey) {
    if (!actionKey) {
      return;
    }
    if (typeof stopDataBakerCvpcRecordingListeners === "function") {
      stopDataBakerCvpcRecordingListeners();
    }
    dataBakerCvpcRecordingKey = actionKey;
    const action = dataBakerCvpcShortcutActions.find(function (item) {
      return item.key === actionKey;
    });
    setDataBakerCvpcRecordingStatus(
      "正在录制「" + String(action?.label || actionKey) + "」：按键盘组合，Esc 取消。"
    );

    const keydownListener = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      applyRecordedDataBakerCvpcShortcut(shortcutFromKeyboardEvent(event));
    };

    window.addEventListener("keydown", keydownListener, true);
    stopDataBakerCvpcRecordingListeners = function () {
      window.removeEventListener("keydown", keydownListener, true);
      stopDataBakerCvpcRecordingListeners = null;
    };
    renderDataBakerCvpcShortcutGrid();
  }

  function ensureBytedanceAidpShortcutDraft() {
    bytedanceAidpShortcutActions.forEach(function (action) {
      if (!hasOwn(bytedanceAidpShortcutsDraft, action.key)) {
        bytedanceAidpShortcutsDraft[action.key] = null;
      }
    });
  }

  function renderBytedanceAidpShortcutGrid() {
    ensureBytedanceAidpShortcutDraft();
    renderRecordableShortcutGrid({
      gridId: "bytedance-aidp-shortcut-grid",
      actions: bytedanceAidpShortcutActions,
      values: bytedanceAidpShortcutsDraft,
      recordingKey: bytedanceAidpRecordingKey,
      recordAttrName: "data-record-bytedance-aidp-shortcut",
      clearAttrName: "data-clear-bytedance-aidp-shortcut",
      onRecord: function (key) {
        startBytedanceAidpShortcutRecording(key);
      },
      onClear: function (key) {
        bytedanceAidpShortcutsDraft[key] = null;
        if (bytedanceAidpRecordingKey === key) {
          showTopToast("已取消快捷键录制。", "info", 1000);
          stopBytedanceAidpShortcutRecording("");
          return;
        }
        showTopToast("快捷键已删除，保存后生效。", "success", 1000);
        setBytedanceAidpRecordingStatus("");
        renderBytedanceAidpShortcutGrid();
      },
    });
  }

  function setBytedanceAidpRecordingStatus(text) {
    const node = getElement("bytedance-aidp-recording-status");
    if (!node) {
      return;
    }
    const value = String(text || "").trim();
    node.textContent = value;
    node.classList.toggle("hidden", !value);
  }

  function stopBytedanceAidpShortcutRecording(statusText) {
    if (typeof stopBytedanceAidpRecordingListeners === "function") {
      stopBytedanceAidpRecordingListeners();
      stopBytedanceAidpRecordingListeners = null;
    }
    bytedanceAidpRecordingKey = null;
    setBytedanceAidpRecordingStatus(statusText || "");
    renderBytedanceAidpShortcutGrid();
  }

  function applyRecordedBytedanceAidpShortcut(shortcut) {
    if (!bytedanceAidpRecordingKey || shortcut === false) {
      return;
    }
    if (!shortcut) {
      showTopToast("已取消快捷键录制。", "info", 1000);
      stopBytedanceAidpShortcutRecording("");
      return;
    }
    bytedanceAidpShortcutsDraft[bytedanceAidpRecordingKey] = normalizeNullableShortcut(shortcut);
    showTopToast("快捷键已录制，保存后生效。", "success", 1000);
    stopBytedanceAidpShortcutRecording("");
  }

  function startBytedanceAidpShortcutRecording(actionKey) {
    if (!actionKey) {
      return;
    }
    if (typeof stopBytedanceAidpRecordingListeners === "function") {
      stopBytedanceAidpRecordingListeners();
    }
    bytedanceAidpRecordingKey = actionKey;
    const action = bytedanceAidpShortcutActions.find(function (item) {
      return item.key === actionKey;
    });
    showTopToast(
      "正在录制「" + String(action?.label || actionKey) + "」：按键盘组合，Esc 取消。",
      "info",
      0
    );
    setBytedanceAidpRecordingStatus("");

    const keydownListener = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      applyRecordedBytedanceAidpShortcut(shortcutFromKeyboardEvent(event));
    };

    window.addEventListener("keydown", keydownListener, true);
    stopBytedanceAidpRecordingListeners = function () {
      window.removeEventListener("keydown", keydownListener, true);
      stopBytedanceAidpRecordingListeners = null;
    };
    renderBytedanceAidpShortcutGrid();
  }

  function isModifierOnlyKey(key) {
    return ["Control", "Alt", "Shift", "Meta"].indexOf(key) >= 0;
  }

  function shortcutFromKeyboardEvent(event) {
    if (event.key === "Escape") {
      return null;
    }

    if (isModifierOnlyKey(event.key)) {
      return false;
    }

    return {
      ctrl: event.ctrlKey === true,
      alt: event.altKey === true,
      shift: event.shiftKey === true,
      meta: event.metaKey === true,
      key: event.key === " " ? "Space" : String(event.key),
      button: null,
    };
  }

  function shortcutFromMouseEvent(event) {
    return {
      ctrl: event.ctrlKey === true,
      alt: event.altKey === true,
      shift: event.shiftKey === true,
      meta: event.metaKey === true,
      key: null,
      button: event.button,
    };
  }

  function ensureShortcutDraft() {
    judgementShortcutActions.forEach(function (action) {
      if (!Object.prototype.hasOwnProperty.call(judgementShortcutsDraft, action.key)) {
        judgementShortcutsDraft[action.key] = null;
      }
    });
  }

  function renderJudgementShortcutGrid() {
    ensureShortcutDraft();
    renderRecordableShortcutGrid({
      gridId: "judgement-shortcut-grid",
      actions: judgementShortcutActions,
      values: judgementShortcutsDraft,
      recordingKey: judgementRecordingKey,
      recordAttrName: "data-record-judgement-shortcut",
      clearAttrName: "data-clear-judgement-shortcut",
      onRecord: function (key) {
        startJudgementShortcutRecording(key);
      },
      onClear: function (key) {
        judgementShortcutsDraft[key] = null;
        if (judgementRecordingKey === key) {
          stopJudgementShortcutRecording("快捷键录制已取消。");
          return;
        }
        setJudgementRecordingStatus("快捷键已删除，保存后生效。");
        renderJudgementShortcutGrid();
      },
    });
  }

  function setJudgementRecordingStatus(text) {
    const node = getElement("judgement-recording-status");
    if (!node) {
      return;
    }

    node.textContent = text || "";
    node.classList.toggle("hidden", !text);
  }

  function stopJudgementShortcutRecording(statusText) {
    if (typeof stopJudgementRecordingListeners === "function") {
      stopJudgementRecordingListeners();
      stopJudgementRecordingListeners = null;
    }

    judgementRecordingKey = null;
    setJudgementRecordingStatus(statusText || "");
    renderJudgementShortcutGrid();
  }

  function applyRecordedJudgementShortcut(shortcut) {
    if (!judgementRecordingKey || shortcut === false) {
      return;
    }

    if (!shortcut) {
      stopJudgementShortcutRecording("已取消快捷键录制。");
      return;
    }

    judgementShortcutsDraft[judgementRecordingKey] = normalizeShortcut(shortcut);
    stopJudgementShortcutRecording("快捷键已录制，保存后生效。");
  }

  function startJudgementShortcutRecording(actionKey) {
    if (!actionKey) {
      return;
    }

    if (typeof stopJudgementRecordingListeners === "function") {
      stopJudgementRecordingListeners();
    }

    judgementRecordingKey = actionKey;
    const action = judgementShortcutActions.find(function (item) {
      return item.key === actionKey;
    });

    setJudgementRecordingStatus(
      "正在录制「" + String(action?.label || actionKey) + "」：按键盘组合或鼠标按键，Esc 取消。"
    );

    function preventMouseDefaultOnce(event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    }

    function suppressMouseFollowup() {
      ["mouseup", "auxclick", "contextmenu"].forEach(function (eventName) {
        window.addEventListener(eventName, preventMouseDefaultOnce, {
          capture: true,
          once: true,
        });
      });
      window.setTimeout(function () {
        ["mouseup", "auxclick", "contextmenu"].forEach(function (eventName) {
          window.removeEventListener(eventName, preventMouseDefaultOnce, true);
        });
      }, 800);
    }

    const keydownListener = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      applyRecordedJudgementShortcut(shortcutFromKeyboardEvent(event));
    };
    const mousedownListener = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      suppressMouseFollowup();
      applyRecordedJudgementShortcut(shortcutFromMouseEvent(event));
    };

    window.addEventListener("keydown", keydownListener, true);
    window.addEventListener("mousedown", mousedownListener, true);
    stopJudgementRecordingListeners = function () {
      window.removeEventListener("keydown", keydownListener, true);
      window.removeEventListener("mousedown", mousedownListener, true);
    };

    renderJudgementShortcutGrid();
  }

  function ensureDataBakerShortcutDraft() {
    dataBakerShortcutActions.forEach(function (action) {
      if (!hasOwn(dataBakerShortcutsDraft, action.key)) {
        dataBakerShortcutsDraft[action.key] = null;
      }
    });
  }

  function renderDataBakerShortcutGrid() {
    ensureDataBakerShortcutDraft();
    renderRecordableShortcutGrid({
      gridId: "data-baker-shortcut-grid",
      actions: dataBakerShortcutActions,
      values: dataBakerShortcutsDraft,
      recordingKey: dataBakerRecordingKey,
      recordAttrName: "data-record-data-baker-shortcut",
      clearAttrName: "data-clear-data-baker-shortcut",
      onRecord: function (key) {
        startDataBakerShortcutRecording(key);
      },
      onClear: function (key) {
        dataBakerShortcutsDraft[key] = null;
        if (dataBakerRecordingKey === key) {
          stopDataBakerShortcutRecording("快捷键录制已取消。");
          return;
        }
        setDataBakerRecordingStatus("快捷键已删除，保存后生效。");
        renderDataBakerShortcutGrid();
      },
    });
  }

  function setDataBakerRecordingStatus(text) {
    const node = getElement("data-baker-recording-status");
    if (!node) {
      return;
    }

    node.textContent = text || "";
    node.classList.toggle("hidden", !text);
  }

  function stopDataBakerShortcutRecording(statusText) {
    if (typeof stopDataBakerRecordingListeners === "function") {
      stopDataBakerRecordingListeners();
      stopDataBakerRecordingListeners = null;
    }

    dataBakerRecordingKey = null;
    setDataBakerRecordingStatus(statusText || "");
    renderDataBakerShortcutGrid();
  }

  function applyRecordedDataBakerShortcut(shortcut) {
    if (!dataBakerRecordingKey || shortcut === false) {
      return;
    }

    if (!shortcut) {
      stopDataBakerShortcutRecording("已取消快捷键录制。");
      return;
    }

    dataBakerShortcutsDraft[dataBakerRecordingKey] = normalizeNullableShortcut(shortcut);
    stopDataBakerShortcutRecording("快捷键已录制，保存后生效。");
  }

  function startDataBakerShortcutRecording(actionKey) {
    if (!actionKey) {
      return;
    }

    if (typeof stopDataBakerRecordingListeners === "function") {
      stopDataBakerRecordingListeners();
    }

    dataBakerRecordingKey = actionKey;
    const action = dataBakerShortcutActions.find(function (item) {
      return item.key === actionKey;
    });

    setDataBakerRecordingStatus(
      "正在录制「" + String(action?.label || actionKey) + "」：按键盘组合，Esc 取消。"
    );

    const keydownListener = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      applyRecordedDataBakerShortcut(shortcutFromKeyboardEvent(event));
    };

    window.addEventListener("keydown", keydownListener, true);
    stopDataBakerRecordingListeners = function () {
      window.removeEventListener("keydown", keydownListener, true);
    };

    renderDataBakerShortcutGrid();
  }

  function ensureAishellTechShortcutDraft() {
    getAishellTechShortcutActions(getCurrentDetailScriptId()).forEach(function (action) {
      if (!hasOwn(aishellTechShortcutsDraft, action.key)) {
        aishellTechShortcutsDraft[action.key] = null;
      }
    });
  }

  function renderAishellTechShortcutGrid() {
    ensureAishellTechShortcutDraft();
    renderRecordableShortcutGrid({
      gridId: "aishell-tech-shortcut-grid",
      actions: getAishellTechShortcutActions(getCurrentDetailScriptId()),
      values: aishellTechShortcutsDraft,
      recordingKey: aishellTechRecordingKey,
      recordAttrName: "data-record-aishell-tech-shortcut",
      clearAttrName: "data-clear-aishell-tech-shortcut",
      onRecord: function (key) {
        startAishellTechShortcutRecording(key);
      },
      onClear: function (key) {
        aishellTechShortcutsDraft[key] = null;
        if (aishellTechRecordingKey === key) {
          stopAishellTechShortcutRecording("快捷键录制已取消。");
          return;
        }
        setAishellTechRecordingStatus("快捷键已删除，保存后生效。");
        renderAishellTechShortcutGrid();
      },
    });
  }

  function setAishellTechRecordingStatus(text) {
    const node = getElement("aishell-tech-recording-status");
    if (!node) {
      return;
    }
    node.textContent = text || "";
    node.classList.toggle("hidden", !text);
  }

  function stopAishellTechShortcutRecording(statusText) {
    if (typeof stopAishellTechRecordingListeners === "function") {
      stopAishellTechRecordingListeners();
      stopAishellTechRecordingListeners = null;
    }

    aishellTechRecordingKey = null;
    setAishellTechRecordingStatus(statusText || "");
    renderAishellTechShortcutGrid();
  }

  function applyRecordedAishellTechShortcut(shortcut) {
    if (!aishellTechRecordingKey || shortcut === false) {
      return;
    }

    if (!shortcut) {
      stopAishellTechShortcutRecording("已取消快捷键录制。");
      return;
    }

    aishellTechShortcutsDraft[aishellTechRecordingKey] = normalizeNullableShortcut(shortcut);
    stopAishellTechShortcutRecording("快捷键已录制，保存后生效。");
  }

  function startAishellTechShortcutRecording(actionKey) {
    if (!actionKey) {
      return;
    }

    if (typeof stopAishellTechRecordingListeners === "function") {
      stopAishellTechRecordingListeners();
    }

    aishellTechRecordingKey = actionKey;
    const action = getAishellTechShortcutActions(getCurrentDetailScriptId()).find(function (item) {
      return item.key === actionKey;
    });

    setAishellTechRecordingStatus(
      "正在录制「" + String(action?.label || actionKey) + "」：按键盘组合键，Esc 取消。"
    );

    const keydownListener = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      applyRecordedAishellTechShortcut(shortcutFromKeyboardEvent(event));
    };

    window.addEventListener("keydown", keydownListener, true);
    stopAishellTechRecordingListeners = function () {
      window.removeEventListener("keydown", keydownListener, true);
    };

    renderAishellTechShortcutGrid();
  }

  function ensureMagicDataShortcutDraft() {
    magicDataShortcutActions.forEach(function (action) {
      if (!hasOwn(magicDataShortcutsDraft, action.key)) {
        magicDataShortcutsDraft[action.key] = null;
      }
    });
  }

  function setMagicDataRecordingStatus(text) {
    const node = getElement("magic-data-recording-status");
    if (!node) {
      return;
    }
    node.textContent = text || "";
    node.classList.toggle("hidden", !text);
  }

  function renderMagicDataShortcutGrid() {
    ensureMagicDataShortcutDraft();
    renderRecordableShortcutGrid({
      gridId: "magic-data-shortcut-grid",
      actions: magicDataShortcutActions,
      values: magicDataShortcutsDraft,
      recordingKey: magicDataRecordingKey,
      recordAttrName: "data-record-magic-data-shortcut",
      clearAttrName: "data-clear-magic-data-shortcut",
      onRecord: function (key) {
        startMagicDataShortcutRecording(key);
      },
      onClear: function (key) {
        magicDataShortcutsDraft[key] = null;
        if (magicDataRecordingKey === key) {
          stopMagicDataShortcutRecording("快捷键录制已取消。");
          return;
        }
        setMagicDataRecordingStatus("快捷键已删除，保存后生效。");
        renderMagicDataShortcutGrid();
      },
    });
  }

  function stopMagicDataShortcutRecording(statusText) {
    if (typeof stopMagicDataRecordingListeners === "function") {
      stopMagicDataRecordingListeners();
      stopMagicDataRecordingListeners = null;
    }
    magicDataRecordingKey = null;
    setMagicDataRecordingStatus(statusText || "");
    renderMagicDataShortcutGrid();
  }

  function applyRecordedMagicDataShortcut(shortcut) {
    if (!magicDataRecordingKey || shortcut === false) {
      return;
    }
    if (!shortcut) {
      stopMagicDataShortcutRecording("已取消快捷键录制。");
      return;
    }
    magicDataShortcutsDraft[magicDataRecordingKey] = normalizeNullableShortcut(shortcut);
    stopMagicDataShortcutRecording("快捷键已录制，保存后生效。");
  }

  function startMagicDataShortcutRecording(actionKey) {
    if (!actionKey) {
      return;
    }
    if (typeof stopMagicDataRecordingListeners === "function") {
      stopMagicDataRecordingListeners();
    }
    magicDataRecordingKey = actionKey;
    const action = magicDataShortcutActions.find(function (item) {
      return item.key === actionKey;
    });

    setMagicDataRecordingStatus(
      "正在录制「" + String(action?.label || actionKey) + "」：按键盘组合，Esc 取消。"
    );

    const keydownListener = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      applyRecordedMagicDataShortcut(shortcutFromKeyboardEvent(event));
    };

    window.addEventListener("keydown", keydownListener, true);
    stopMagicDataRecordingListeners = function () {
      window.removeEventListener("keydown", keydownListener, true);
    };

    renderMagicDataShortcutGrid();
  }

  function applyMagicDataSettingsForm(settings, scriptId) {
    const activeScriptId = isMagicDataScript(scriptId) ? scriptId : magicDataAnnotatorScriptId;
    const isMinnanScript = activeScriptId === magicDataMinnanScriptId;
    const config = getMagicDataConfig(settings, activeScriptId);
    const defaultsPayload = getAsrVoiceAiDefaultsCached(activeScriptId);
    const aiDefaults = defaultsPayload.defaults || {};
    magicDataShortcutsDraft = clone(config.shortcuts) || {};
    if (getElement("magic-data-enabled")) {
      getElement("magic-data-enabled").checked = config.enabled !== false;
      applyMagicDataMinnanRecognitionModeFields(
        config.aiReviewRecognitionMode || aiDefaults.recognitionMode,
        config,
        aiDefaults,
        activeScriptId
      );
      getElement("magic-data-show-heard-text").checked = config.showHeardText !== false;
      getElement("magic-data-show-estimated-income").checked =
        config.showEstimatedIncome !== false;
      getElement("magic-data-ai-timeout").value = String(
        Number(config.aiReviewRequestTimeoutMs || aiDefaults.timeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS)
      );
      applyForcedThinkingToggle(
        "magic-data-ai-enable-thinking",
        "thinking 已全局固定关闭；Magic Data 不再允许开启 Omni 思考模式。"
      );
      getElement("magic-data-ai-listen-prompt").value = String(
        getAsrVoiceAiEffectiveText(config.aiReviewListenPrompt, aiDefaults.listenPrompt)
      );
      getElement("magic-data-ai-compare-prompt").value = String(
        getAsrVoiceAiEffectiveText(
          config.aiReviewComparePrompt,
          isMinnanScript ? aiDefaults.comparePrompt || aiDefaults.reviewPrompt : aiDefaults.reviewPrompt
        )
      );
      getElement("magic-data-ai-temperature").value = String(
        getAsrVoiceAiEffectiveText(config.aiReviewTemperature, aiDefaults.temperature)
      );
      getElement("magic-data-ai-top-p").value = String(
        getAsrVoiceAiEffectiveText(config.aiReviewTopP, aiDefaults.top_p)
      );
      getElement("magic-data-ai-max-tokens").value = String(
        getAsrVoiceAiEffectiveText(config.aiReviewMaxTokens, aiDefaults.max_tokens)
      );
      getElement("magic-data-ai-max-completion-tokens").value = String(
        getAsrVoiceAiEffectiveText(
          config.aiReviewMaxCompletionTokens,
          aiDefaults.max_completion_tokens
        )
      );
      getElement("magic-data-ai-presence-penalty").value = String(
        getAsrVoiceAiEffectiveText(config.aiReviewPresencePenalty, aiDefaults.presence_penalty)
      );
      getElement("magic-data-ai-frequency-penalty").value = String(
        getAsrVoiceAiEffectiveText(config.aiReviewFrequencyPenalty, aiDefaults.frequency_penalty)
      );
      getElement("magic-data-ai-seed").value = String(
        getAsrVoiceAiEffectiveText(config.aiReviewSeed, aiDefaults.seed)
      );
      getElement("magic-data-ai-stop-sequences").value = String(
        getAsrVoiceAiEffectiveText(config.aiReviewStopSequences, aiDefaults.stop)
      );
    }
    stopMagicDataShortcutRecording("");
    renderMagicDataShortcutGrid();
    syncOptionsCustomSelects(getElement("detail-view"));
    setStatus(
      "magic-data-status",
      "当前后端地址由首页统一控制：" + formatBackendModeLabel(settings)
    );
  }

  async function saveMagicDataSettings() {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("magic-data-status", "当前扩展版本不支持保存 Magic Data 设置。");
      return false;
    }

    ensureMagicDataShortcutDraft();
    const shortcuts = {};
    magicDataShortcutActions.forEach(function (action) {
      shortcuts[action.key] = normalizeNullableShortcut(magicDataShortcutsDraft[action.key]);
    });

    const activeScriptId = getCurrentDetailScriptId();
    const targetScriptId = isMagicDataScript(activeScriptId)
      ? activeScriptId
      : magicDataAnnotatorScriptId;
    const isMinnanScript = targetScriptId === magicDataMinnanScriptId;
    const currentConfig = getMagicDataConfig(currentSettings || {}, targetScriptId);
    const aiDefaults = getAsrVoiceAiDefaultsCached(targetScriptId).defaults || {};
    const hasAiSettingsPanel = Boolean(getElement("magic-data-enabled"));
    const enabled = hasAiSettingsPanel
      ? getElement("magic-data-enabled").checked
      : currentConfig.enabled !== false;
    const modelMode = hasAiSettingsPanel
      ? normalizeMagicDataModelMode(
          getElement("magic-data-ai-pipeline-mode-select")?.value,
          currentConfig.aiReviewModelMode || currentConfig.aiReviewRecognitionMode || "two_stage"
        )
      : normalizeMagicDataModelMode(
          currentConfig.aiReviewModelMode || currentConfig.aiReviewRecognitionMode,
          "two_stage"
        );
    const recognitionStrategyFallback = resolveMagicDataRecognitionStrategyFromSource(
      currentConfig,
      "direct_dialect"
    );
    const recognitionStrategy = hasAiSettingsPanel
      ? normalizeMagicDataRecognitionStrategy(
          getElement("magic-data-ai-recognition-strategy-select")?.value,
          recognitionStrategyFallback || "direct_dialect"
        )
      : normalizeMagicDataRecognitionStrategy(recognitionStrategyFallback, "direct_dialect");
    const legacyRecognitionFields = buildMagicDataLegacyRecognitionFields(
      modelMode,
      recognitionStrategy
    );
    const recognitionMode = legacyRecognitionFields.aiReviewRecognitionMode;
    const listenModel = hasAiSettingsPanel
      ? normalizeDataBakerListenModel(
          getElement("magic-data-ai-listen-model-select")?.value,
          getMagicDataMinnanListenModelDefault(aiDefaults)
        )
      : normalizeDataBakerListenModel(
          currentConfig.aiReviewListenModel || currentConfig.listenModel,
          getMagicDataMinnanListenModelDefault(aiDefaults)
        );
    const reviewModel = hasAiSettingsPanel
      ? normalizeDataBakerCompareModel(
          getElement("magic-data-ai-compare-model-select")?.value,
          getMagicDataMinnanCompareModelDefault(aiDefaults, targetScriptId)
        )
      : normalizeDataBakerCompareModel(
          currentConfig.aiReviewCompareModel || currentConfig.reviewModel,
          getMagicDataMinnanCompareModelDefault(aiDefaults, targetScriptId)
        );
    const singleModel = hasAiSettingsPanel
      ? normalizeDataBakerSingleModel(
          getElement("magic-data-ai-single-model-select")?.value,
          getMagicDataMinnanSingleModelDefault(aiDefaults)
        )
      : normalizeDataBakerSingleModel(
          currentConfig.aiReviewSingleModel,
          getMagicDataMinnanSingleModelDefault(aiDefaults)
        );
    const showHeardText = hasAiSettingsPanel
      ? getElement("magic-data-show-heard-text").checked
      : currentConfig.showHeardText !== false;
    const showEstimatedIncome = hasAiSettingsPanel
      ? getElement("magic-data-show-estimated-income").checked
      : currentConfig.showEstimatedIncome !== false;
    const enableThinking = false;
    const normalizeOverridePrompt = function (value, defaultValue) {
      const normalizedValue = normalizePromptText(value || "");
      const normalizedDefault = normalizePromptText(defaultValue || "");
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const normalizeOverrideNumber = function (value, defaultValue, min, max, precision) {
      const normalizedValue = normalizeOptionalNumberText(value, min, max, precision);
      const normalizedDefault = normalizeOptionalNumberText(defaultValue, min, max, precision);
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const normalizeOverrideInteger = function (value, defaultValue, min, max) {
      const normalizedValue = normalizeOptionalIntegerText(value, min, max);
      const normalizedDefault = normalizeOptionalIntegerText(defaultValue, min, max);
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const aiReviewRequestTimeoutMs = hasAiSettingsPanel
      ? clampNumber(getElement("magic-data-ai-timeout").value, DEFAULT_AI_REQUEST_TIMEOUT_MS, 1000, 300000, 0)
      : currentConfig.aiReviewRequestTimeoutMs;
    const aiReviewListenPrompt = hasAiSettingsPanel
      ? normalizeOverridePrompt(
          getElement("magic-data-ai-listen-prompt").value,
          aiDefaults.listenPrompt
        )
      : currentConfig.aiReviewListenPrompt;
    const aiReviewComparePrompt = hasAiSettingsPanel
      ? normalizeOverridePrompt(
          getElement("magic-data-ai-compare-prompt").value,
          isMinnanScript ? aiDefaults.comparePrompt || aiDefaults.reviewPrompt : aiDefaults.reviewPrompt
        )
      : currentConfig.aiReviewComparePrompt;
    const aiReviewTemperature = hasAiSettingsPanel
      ? normalizeOverrideNumber(
          getElement("magic-data-ai-temperature").value,
          aiDefaults.temperature,
          0,
          2,
          3
        )
      : currentConfig.aiReviewTemperature;
    const aiReviewTopP = hasAiSettingsPanel
      ? normalizeOverrideNumber(getElement("magic-data-ai-top-p").value, aiDefaults.top_p, 0, 1, 3)
      : currentConfig.aiReviewTopP;
    const aiReviewMaxTokens = hasAiSettingsPanel
      ? normalizeOverrideInteger(
          getElement("magic-data-ai-max-tokens").value,
          aiDefaults.max_tokens,
          1,
          8192
        )
      : currentConfig.aiReviewMaxTokens;
    const aiReviewMaxCompletionTokens = hasAiSettingsPanel
      ? normalizeOverrideInteger(
          getElement("magic-data-ai-max-completion-tokens").value,
          aiDefaults.max_completion_tokens,
          1,
          8192
        )
      : currentConfig.aiReviewMaxCompletionTokens;
    const aiReviewPresencePenalty = hasAiSettingsPanel
      ? normalizeOverrideNumber(
          getElement("magic-data-ai-presence-penalty").value,
          aiDefaults.presence_penalty,
          -2,
          2,
          3
        )
      : currentConfig.aiReviewPresencePenalty;
    const aiReviewFrequencyPenalty = hasAiSettingsPanel
      ? normalizeOverrideNumber(
          getElement("magic-data-ai-frequency-penalty").value,
          aiDefaults.frequency_penalty,
          -2,
          2,
          3
        )
      : currentConfig.aiReviewFrequencyPenalty;
    const aiReviewSeed = hasAiSettingsPanel
      ? normalizeOverrideInteger(getElement("magic-data-ai-seed").value, aiDefaults.seed, 0, 2147483647)
      : currentConfig.aiReviewSeed;
    const aiReviewStopSequences = hasAiSettingsPanel
      ? (function () {
          const normalizedValue = normalizeStopSequencesText(
            getElement("magic-data-ai-stop-sequences").value
          );
          const normalizedDefault = normalizeStopSequencesText(aiDefaults.stop || "");
          return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
        })()
      : currentConfig.aiReviewStopSequences;

    setStatus("magic-data-status", "正在保存 Magic Data 设置...");
    try {
      const payloadConfig = (function () {
        const normalizedThinking = enableThinking === true;
        return {
          enabled: enabled,
          aiReviewEnabled: enabled,
          aiReviewModelMode: modelMode,
          aiReviewRecognitionStrategy: recognitionStrategy,
          aiReviewRecognitionMode: legacyRecognitionFields.aiReviewRecognitionMode,
          recognitionMode: legacyRecognitionFields.recognitionMode,
          pipelineMode: legacyRecognitionFields.pipelineMode,
          recognitionStrategy: recognitionStrategy,
          aiReviewListenModel: listenModel,
          aiReviewCompareModel: reviewModel,
          aiReviewSingleModel: singleModel,
          aiReviewEnableThinking: normalizedThinking,
          listenModel: listenModel,
          reviewModel: reviewModel,
          showHeardText: showHeardText,
          showEstimatedIncome: showEstimatedIncome,
          enableThinking: normalizedThinking,
          aiReviewRequestTimeoutMs: aiReviewRequestTimeoutMs,
          aiReviewListenPrompt: aiReviewListenPrompt,
          aiReviewComparePrompt: aiReviewComparePrompt,
          aiReviewTemperature: aiReviewTemperature,
          aiReviewTopP: aiReviewTopP,
          aiReviewMaxTokens: aiReviewMaxTokens,
          aiReviewMaxCompletionTokens: aiReviewMaxCompletionTokens,
          aiReviewPresencePenalty: aiReviewPresencePenalty,
          aiReviewFrequencyPenalty: aiReviewFrequencyPenalty,
          aiReviewSeed: aiReviewSeed,
          aiReviewStopSequences: aiReviewStopSequences,
          shortcuts: shortcuts,
        };
      })();
      const currentMagicDataActiveScriptId = getMagicDataActiveScriptId(currentSettings || {});
      const nextMagicDataActiveScriptId = enabled
        ? targetScriptId
        : currentMagicDataActiveScriptId === targetScriptId
          ? ""
          : currentMagicDataActiveScriptId;
      const magicDataScriptDefinitions = [
        {
          scriptId: magicDataAnnotatorScriptId,
          scriptKey: "hakkaHelper",
          legacyKey: "magicDataAnnotator",
        },
        {
          scriptId: magicDataMinnanScriptId,
          scriptKey: "minnanHelper",
          legacyKey: "magicDataMinnanAssistant",
        },
        {
          scriptId: magicDataHangzhouScriptId,
          scriptKey: "hangzhouHelper",
          legacyKey: "magicDataHangzhouAssistant",
        },
      ];
      const scriptCenterProjects = {};
      const platformScripts = {};
      magicDataScriptDefinitions.forEach(function (definition) {
        const isTargetScript = definition.scriptId === targetScriptId;
        if (isTargetScript) {
          scriptCenterProjects[definition.legacyKey] = payloadConfig;
          platformScripts[definition.scriptKey] = Object.assign(
            { id: definition.scriptId },
            payloadConfig
          );
          return;
        }
        if (!enabled) {
          return;
        }
        scriptCenterProjects[definition.legacyKey] = {
          enabled: false,
          aiReviewEnabled: false,
        };
        platformScripts[definition.scriptKey] = {
          id: definition.scriptId,
          enabled: false,
          aiReviewEnabled: false,
        };
      });
      const patchPayload = {
        scriptCenter: {
          projects: scriptCenterProjects,
        },
        platforms: {
          magicData: {
            activeScriptId: nextMagicDataActiveScriptId,
            scripts: platformScripts,
          },
        },
      };
      currentSettings = await storage.patchSettings(patchPayload);
      renderCurrentView();
      setStatus("magic-data-status", "Magic Data 设置已保存；如页面未生效请刷新目标页面。");
      return true;
    } catch (error) {
      setStatus(
        "magic-data-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  function ensureAbakaAiShortcutDraft() {
    const defaults = createAbakaAiEmptyShortcutMap();
    abakaAiTask21ShortcutActions.forEach(function (action) {
      if (!hasOwn(abakaAiShortcutsDraft, action.key)) {
        abakaAiShortcutsDraft[action.key] = normalizeNullableShortcut(defaults[action.key]);
      }
    });
  }

  function setAbakaAiRecordingStatus(text) {
    const node = getElement("abaka-ai-recording-status");
    if (!node) {
      return;
    }
    node.textContent = text || "";
    node.classList.toggle("hidden", !text);
  }

  function renderAbakaAiShortcutGrid() {
    ensureAbakaAiShortcutDraft();
    renderRecordableShortcutGrid({
      gridId: "abaka-ai-shortcut-grid",
      actions: abakaAiTask21ShortcutActions,
      values: abakaAiShortcutsDraft,
      recordingKey: abakaAiRecordingKey,
      recordAttrName: "data-record-abaka-shortcut",
      clearAttrName: "data-clear-abaka-shortcut",
      onRecord: function (key) {
        startAbakaAiShortcutRecording(key);
      },
      onClear: function (key) {
        abakaAiShortcutsDraft[key] = null;
        if (abakaAiRecordingKey === key) {
          stopAbakaAiShortcutRecording("快捷键录制已取消。");
          return;
        }
        setAbakaAiRecordingStatus("快捷键已删除，保存后生效。");
        renderAbakaAiShortcutGrid();
      },
    });
  }

  function stopAbakaAiShortcutRecording(statusText) {
    if (typeof stopAbakaAiRecordingListeners === "function") {
      stopAbakaAiRecordingListeners();
      stopAbakaAiRecordingListeners = null;
    }
    abakaAiRecordingKey = null;
    setAbakaAiRecordingStatus(statusText || "");
    renderAbakaAiShortcutGrid();
  }

  function applyRecordedAbakaAiShortcut(shortcut) {
    if (!abakaAiRecordingKey || shortcut === false) {
      return;
    }
    if (!shortcut) {
      stopAbakaAiShortcutRecording("已取消快捷键录制。");
      return;
    }
    abakaAiShortcutsDraft[abakaAiRecordingKey] = normalizeNullableShortcut(shortcut);
    stopAbakaAiShortcutRecording("快捷键已录制，保存后生效。");
  }

  function startAbakaAiShortcutRecording(actionKey) {
    if (!actionKey) {
      return;
    }
    if (typeof stopAbakaAiRecordingListeners === "function") {
      stopAbakaAiRecordingListeners();
    }
    abakaAiRecordingKey = actionKey;
    const action = abakaAiTask21ShortcutActions.find(function (item) {
      return item.key === actionKey;
    });

    setAbakaAiRecordingStatus(
      "正在录制「" + String(action?.label || actionKey) + "」：按键盘组合或鼠标按键，Esc 取消。"
    );

    function preventMouseDefaultOnce(event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    }

    function suppressMouseFollowup() {
      ["mouseup", "auxclick", "contextmenu"].forEach(function (eventName) {
        window.addEventListener(eventName, preventMouseDefaultOnce, {
          capture: true,
          once: true,
        });
      });
      window.setTimeout(function () {
        ["mouseup", "auxclick", "contextmenu"].forEach(function (eventName) {
          window.removeEventListener(eventName, preventMouseDefaultOnce, true);
        });
      }, 800);
    }

    const keydownListener = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      applyRecordedAbakaAiShortcut(shortcutFromKeyboardEvent(event));
    };
    const mousedownListener = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      suppressMouseFollowup();
      applyRecordedAbakaAiShortcut(shortcutFromMouseEvent(event));
    };

    window.addEventListener("keydown", keydownListener, true);
    window.addEventListener("mousedown", mousedownListener, true);
    stopAbakaAiRecordingListeners = function () {
      window.removeEventListener("keydown", keydownListener, true);
      window.removeEventListener("mousedown", mousedownListener, true);
    };

    renderAbakaAiShortcutGrid();
  }

  function applyAbakaAiTaskPageForm(settings) {
    const config = getAbakaAiTaskPageConfig(settings);
    abakaAiShortcutsDraft = clone(config.shortcuts) || {};
    const advancedPanel = getElement("abaka-ai-settings-advanced");
    if (advancedPanel) {
      advancedPanel.classList.remove("hidden");
    }
    updateAbakaAiAdvancedTip();
    const autoSelectNode = getElement("abaka-auto-select-specify-on-same-font-true");
    if (autoSelectNode instanceof HTMLInputElement) {
      autoSelectNode.checked = config.autoSelectSpecifyOnSameFontTrue !== false;
    }
    renderAbakaAiSelectOptions(
      "abaka-ai-analysis-mode",
      config.aiAnalysisMode,
      abakaAiTask21AnalysisModes,
      "two_stage"
    );
    renderAbakaAiSelectOptions(
      "abaka-ai-vision-model",
      config.aiVisionModel,
      abakaAiTask21VisionModelOptions,
      "qwen3.6-plus"
    );
    renderAbakaAiSelectOptions(
      "abaka-ai-ocr-model",
      config.aiOcrModel,
      abakaAiTask21OcrModelOptions,
      ""
    );
    renderAbakaAiSelectOptions(
      "abaka-ai-reasoning-model",
      config.aiReasoningModel,
      abakaAiTask21ReasoningModelOptions,
      "qwen3.6-plus"
    );
    renderAbakaAiSelectOptions(
      "abaka-ai-single-model",
      config.aiSingleModel,
      abakaAiTask21SingleModelOptions,
      "qwen3.6-plus"
    );
    const ocrEnabledNode = getElement("abaka-ai-ocr-enabled");
    if (ocrEnabledNode instanceof HTMLInputElement) {
      ocrEnabledNode.checked = config.aiOcrEnabled === true;
    }
    const enableThinkingNode = getElement("abaka-ai-enable-thinking");
    if (enableThinkingNode instanceof HTMLInputElement) {
      enableThinkingNode.checked = false;
    }
    applyForcedThinkingToggle(
      "abaka-ai-enable-thinking",
      "thinking 已全局固定关闭；Task21 不再允许开启思考模式。"
    );
    const timeoutNode = getElement("abaka-ai-timeout");
    if (timeoutNode instanceof HTMLInputElement) {
      timeoutNode.value = String(config.aiRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS);
    }
    const mockTipNode = getElement("abaka-ai-mock-tip");
    if (mockTipNode) {
      mockTipNode.textContent =
        "Mock 模式由后端环境变量 ABAKA_TASK21_AI_MOCK 控制；前端只展示配置，不直接修改环境变量。";
    }
    stopAbakaAiShortcutRecording("");
    renderAbakaAiShortcutGrid();
    syncOptionsCustomSelects(getElement("detail-view"));
  }

  function applyHaitianUtransAudioDownloadHelperForm(settings) {
    const config = getHaitianUtransAudioDownloadHelperConfig(settings);
    const enabledNode = getElement("haitian-utrans-audio-download-enabled");
    if (enabledNode instanceof HTMLInputElement) {
      enabledNode.checked = config.enabled !== false;
    }
  }

  async function saveAbakaAiTaskPageSettings() {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("abaka-status", "当前扩展版本不支持保存 Task21助手设置。");
      return false;
    }

    const currentConfig = getAbakaAiTaskPageConfig(currentSettings || {});
    ensureAbakaAiShortcutDraft();
    const shortcuts = {};
    abakaAiTask21ShortcutActions.forEach(function (action) {
      shortcuts[action.key] = normalizeNullableShortcut(abakaAiShortcutsDraft[action.key]);
    });

    const autoSelectNode = getElement("abaka-auto-select-specify-on-same-font-true");
    const autoSelectSpecifyOnSameFontTrue =
      autoSelectNode instanceof HTMLInputElement
        ? autoSelectNode.checked === true
        : currentConfig.autoSelectSpecifyOnSameFontTrue !== false;
    const advancedUnlocked = isAbakaAiAdvancedUnlocked();
    const aiAnalysisModeNode = getElement("abaka-ai-analysis-mode");
    const aiAnalysisMode = advancedUnlocked && aiAnalysisModeNode instanceof HTMLSelectElement
      ? normalizeAbakaAiAnalysisMode(aiAnalysisModeNode.value, currentConfig.aiAnalysisMode || "two_stage")
      : normalizeAbakaAiAnalysisMode(currentConfig.aiAnalysisMode, "two_stage");
    const aiVisionModelNode = getElement("abaka-ai-vision-model");
    const aiVisionModel = advancedUnlocked && aiVisionModelNode instanceof HTMLSelectElement
      ? normalizeAbakaAiModel(
          aiVisionModelNode.value,
          currentConfig.aiVisionModel || "qwen3.6-plus",
          abakaAiTask21VisionModelOptions
        )
      : normalizeAbakaAiModel(
          currentConfig.aiVisionModel,
          "qwen3.6-plus",
          abakaAiTask21VisionModelOptions
        );
    const aiOcrEnabledNode = getElement("abaka-ai-ocr-enabled");
    const aiOcrEnabled = advancedUnlocked && aiOcrEnabledNode instanceof HTMLInputElement
      ? aiOcrEnabledNode.checked === true
      : currentConfig.aiOcrEnabled === true;
    const aiOcrModelNode = getElement("abaka-ai-ocr-model");
    const aiOcrModel = advancedUnlocked && aiOcrModelNode instanceof HTMLSelectElement
      ? normalizeAbakaAiModel(aiOcrModelNode.value, currentConfig.aiOcrModel || "", abakaAiTask21OcrModelOptions)
      : normalizeAbakaAiModel(currentConfig.aiOcrModel, "", abakaAiTask21OcrModelOptions);
    const aiReasoningModelNode = getElement("abaka-ai-reasoning-model");
    const aiReasoningModel = advancedUnlocked && aiReasoningModelNode instanceof HTMLSelectElement
      ? normalizeAbakaAiModel(
          aiReasoningModelNode.value,
          currentConfig.aiReasoningModel || "qwen3.6-plus",
          abakaAiTask21ReasoningModelOptions
        )
      : normalizeAbakaAiModel(
          currentConfig.aiReasoningModel,
          "qwen3.6-plus",
          abakaAiTask21ReasoningModelOptions
        );
    const aiSingleModelNode = getElement("abaka-ai-single-model");
    const aiSingleModel = advancedUnlocked && aiSingleModelNode instanceof HTMLSelectElement
      ? normalizeAbakaAiModel(
          aiSingleModelNode.value,
          currentConfig.aiSingleModel || "qwen3.6-plus",
          abakaAiTask21SingleModelOptions
        )
      : normalizeAbakaAiModel(
          currentConfig.aiSingleModel,
          "qwen3.6-plus",
          abakaAiTask21SingleModelOptions
        );
    const aiEnableThinking = false;
    const aiTimeoutNode = getElement("abaka-ai-timeout");
    const aiRequestTimeoutMs = advancedUnlocked && aiTimeoutNode instanceof HTMLInputElement
      ? normalizeAbakaAiTimeout(aiTimeoutNode.value, currentConfig.aiRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS)
      : normalizeAbakaAiTimeout(currentConfig.aiRequestTimeoutMs, DEFAULT_AI_REQUEST_TIMEOUT_MS);

    setStatus("abaka-status", "正在保存 Task21助手设置...");
    try {
      currentSettings = await storage.patchSettings({
        platforms: {
          abakaAi: {
            scripts: {
              taskPageCapture: {
                id: abakaAiTaskPageCaptureScriptId,
                enabled: currentConfig.enabled !== false,
                stage: "task21-inline-ai-analysis-debug",
                autoSelectSpecifyOnSameFontTrue: autoSelectSpecifyOnSameFontTrue,
                aiAnalysisMode: aiAnalysisMode,
                aiVisionModel: aiVisionModel,
                aiOcrEnabled: aiOcrEnabled,
                aiOcrModel: aiOcrModel,
                aiReasoningModel: aiReasoningModel,
                aiSingleModel: aiSingleModel,
                aiEnableThinking: aiEnableThinking,
                aiRequestTimeoutMs: aiRequestTimeoutMs,
                shortcuts: shortcuts,
              },
            },
          },
        },
      });
      applyAbakaAiTaskPageForm(currentSettings);
      setStatus("abaka-status", "Task21助手设置已保存。");
      return true;
    } catch (error) {
      setStatus(
        "abaka-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  async function saveHaitianUtransAudioDownloadHelperSettings() {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("haitian-utrans-status", "当前扩展版本不支持保存 uTrans 音频下载设置。");
      return false;
    }

    const currentConfig = getHaitianUtransAudioDownloadHelperConfig(currentSettings || {});
    const enabledNode = getElement("haitian-utrans-audio-download-enabled");
    const enabled =
      enabledNode instanceof HTMLInputElement
        ? enabledNode.checked === true
        : currentConfig.enabled !== false;

    setStatus("haitian-utrans-status", "正在保存 uTrans 音频下载设置...");
    try {
      currentSettings = await storage.patchSettings({
        platforms: {
          haitianUtrans: {
            enabled: enabled,
            scripts: {
              audioDownloadHelper: {
                id: haitianUtransAudioDownloadHelperScriptId,
                enabled: enabled,
              },
            },
          },
        },
      });
      applyHaitianUtransAudioDownloadHelperForm(currentSettings);
      setStatus("haitian-utrans-status", "uTrans 音频下载设置已保存。");
      return true;
    } catch (error) {
      setStatus(
        "haitian-utrans-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  function clearAbakaAiTask21Shortcuts() {
    abakaAiShortcutsDraft = createAbakaAiEmptyShortcutMap();
    stopAbakaAiShortcutRecording("");
    setAbakaAiRecordingStatus("已清空快捷键，保存后生效。");
    renderAbakaAiShortcutGrid();
  }

  function applyJudgementForm(settings) {
    const config = normalizeJudgementConfig(settings);
    const defaultsPayload = getAsrVoiceAiDefaultsCached(judgementProjectId);
    const aiDefaults = defaultsPayload.defaults || {};
    judgementShortcutsDraft = clone(config.shortcuts) || {};
    getElement("judgement-volume").value = String(config.volumeValue);
    getElement("judgement-rate-step").value = String(config.rateStepValue);
    getElement("judgement-reset-rate").value = String(config.resetRateValue);
    getElement("judgement-seek-step").value = String(config.seekStepSeconds);
    getElement("judgement-items-per-page").value = config.itemsPerPage;
    getElement("judgement-auto-play").checked = config.autoPlay === true;
    getElement("judgement-asr-diff-view").checked = config.asrDiffViewEnabled !== false;
    getElement("judgement-diff-change-bg").value = config.asrDiffColors.changeBackground;
    getElement("judgement-diff-gap-bg").value = config.asrDiffColors.gapBackground;
    getElement("judgement-diff-punctuation-bg").value =
      config.asrDiffColors.punctuationBackground;
    getElement("judgement-compact-card").checked = config.compactCardEnabled !== false;
    getElement("judgement-thunder-question").checked = config.thunderQuestionEnabled !== false;
    getElement("judgement-auto-advance").checked = config.autoAdvanceAfterChoice === true;
    if (getElement("judgement-ai-suggestion-timeout")) {
      getElement("judgement-ai-suggestion-timeout").value = String(
        Number(config.aiSuggestionRequestTimeoutMs || aiDefaults.timeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS)
      );
      applyForcedThinkingToggle(
        "judgement-ai-suggestion-enable-thinking",
        "thinking 已全局固定关闭；快判链路统一禁止开启思考模式。"
      );
      const webSearchEnabledNode = getElement("judgement-ai-suggestion-web-search-enabled");
      if (webSearchEnabledNode instanceof HTMLInputElement) {
        webSearchEnabledNode.checked = Boolean(
          config.aiSuggestionWebSearchEnabled === true ||
            (config.aiSuggestionWebSearchEnabled !== false &&
              aiDefaults.webSearchEnabled !== false)
        );
      }
      applyJudgementModelField(
        "judgement-ai-suggestion-listen-model-select",
        "judgement-ai-suggestion-listen-model-custom",
        getAsrVoiceAiEffectiveText(config.aiSuggestionListenModel, aiDefaults.listenModel),
        judgementAiListenModels,
        "listen"
      );
      applyJudgementModelField(
        "judgement-ai-suggestion-compare-model-select",
        "judgement-ai-suggestion-compare-model-custom",
        getAsrVoiceAiEffectiveText(config.aiSuggestionCompareModel, aiDefaults.compareModel),
        judgementAiCompareModels,
        "compare"
      );
      getElement("judgement-ai-suggestion-listen-prompt").value = String(
        getAsrVoiceAiEffectiveText(config.aiSuggestionListenPrompt, aiDefaults.listenPrompt)
      );
      getElement("judgement-ai-suggestion-compare-prompt").value = String(
        getAsrVoiceAiEffectiveText(config.aiSuggestionComparePrompt, aiDefaults.comparePrompt)
      );
      getElement("judgement-ai-suggestion-temperature").value = String(
        getAsrVoiceAiEffectiveText(config.aiSuggestionTemperature, aiDefaults.temperature)
      );
      getElement("judgement-ai-suggestion-top-p").value = String(
        getAsrVoiceAiEffectiveText(config.aiSuggestionTopP, aiDefaults.top_p)
      );
      getElement("judgement-ai-suggestion-max-tokens").value = String(
        getAsrVoiceAiEffectiveText(config.aiSuggestionMaxTokens, aiDefaults.max_tokens)
      );
      getElement("judgement-ai-suggestion-max-completion-tokens").value = String(
        getAsrVoiceAiEffectiveText(
          config.aiSuggestionMaxCompletionTokens,
          aiDefaults.max_completion_tokens
        )
      );
      getElement("judgement-ai-suggestion-presence-penalty").value = String(
        getAsrVoiceAiEffectiveText(config.aiSuggestionPresencePenalty, aiDefaults.presence_penalty)
      );
      getElement("judgement-ai-suggestion-frequency-penalty").value = String(
        getAsrVoiceAiEffectiveText(
          config.aiSuggestionFrequencyPenalty,
          aiDefaults.frequency_penalty
        )
      );
      getElement("judgement-ai-suggestion-seed").value = String(
        getAsrVoiceAiEffectiveText(config.aiSuggestionSeed, aiDefaults.seed)
      );
      getElement("judgement-ai-suggestion-stop-sequences").value = String(
        getAsrVoiceAiEffectiveText(config.aiSuggestionStopSequences, aiDefaults.stop)
      );
      applyJudgementAiAdvancedFieldVisibility();
    }
    renderJudgementAiAdvancedPanel();
    stopJudgementShortcutRecording("");
    renderJudgementShortcutGrid();
    syncOptionsCustomSelects(getElement("detail-view"));
    setStatus(
      "judgement-status",
      "当前后端地址由首页统一控制：" +
        formatBackendModeLabel(settings) +
        "；提交类快捷键只触发页面系统按钮，若出现二次确认需手动确认。"
    );
  }

  function ensureTranscriptionShortcutDraft() {
    transcriptionShortcutActions.forEach(function (action) {
      if (!hasOwn(transcriptionShortcutsDraft, action.key)) {
        transcriptionShortcutsDraft[action.key] = null;
      }
    });
  }

  function renderTranscriptionShortcutGrid() {
    ensureTranscriptionShortcutDraft();
    renderRecordableShortcutGrid({
      gridId: "transcription-shortcut-grid",
      actions: transcriptionShortcutActions,
      values: transcriptionShortcutsDraft,
      recordingKey: transcriptionRecordingKey,
      recordAttrName: "data-record-transcription-shortcut",
      clearAttrName: "data-clear-transcription-shortcut",
      onRecord: function (key) {
        startTranscriptionShortcutRecording(key);
      },
      onClear: function (key) {
        transcriptionShortcutsDraft[key] = null;
        if (transcriptionRecordingKey === key) {
          stopTranscriptionShortcutRecording("快捷键录制已取消。");
          return;
        }
        setTranscriptionRecordingStatus("快捷键已删除，保存后生效。");
        renderTranscriptionShortcutGrid();
      },
    });
  }

  function setTranscriptionRecordingStatus(text) {
    const node = getElement("transcription-recording-status");
    if (!node) {
      return;
    }
    node.textContent = text || "";
    node.classList.toggle("hidden", !text);
  }

  function stopTranscriptionShortcutRecording(statusText) {
    if (typeof stopTranscriptionRecordingListeners === "function") {
      stopTranscriptionRecordingListeners();
      stopTranscriptionRecordingListeners = null;
    }
    transcriptionRecordingKey = null;
    setTranscriptionRecordingStatus(statusText || "");
    renderTranscriptionShortcutGrid();
  }

  function applyRecordedTranscriptionShortcut(shortcut) {
    if (!transcriptionRecordingKey || shortcut === false) {
      return;
    }
    if (!shortcut) {
      stopTranscriptionShortcutRecording("已取消快捷键录制。");
      return;
    }

    transcriptionShortcutsDraft[transcriptionRecordingKey] = normalizeShortcut(shortcut);
    stopTranscriptionShortcutRecording("快捷键已录制，保存后生效。");
  }

  function startTranscriptionShortcutRecording(actionKey) {
    if (!actionKey) {
      return;
    }
    if (typeof stopTranscriptionRecordingListeners === "function") {
      stopTranscriptionRecordingListeners();
    }

    transcriptionRecordingKey = actionKey;
    const action = transcriptionShortcutActions.find(function (item) {
      return item.key === actionKey;
    });
    setTranscriptionRecordingStatus(
      "正在录制「" + String(action?.label || actionKey) + "」：按键盘组合，Esc 取消。"
    );

    const keydownListener = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      applyRecordedTranscriptionShortcut(shortcutFromKeyboardEvent(event));
    };
    window.addEventListener("keydown", keydownListener, true);
    stopTranscriptionRecordingListeners = function () {
      window.removeEventListener("keydown", keydownListener, true);
    };

    renderTranscriptionShortcutGrid();
  }

  function applyTranscriptionForm(settings) {
    const config = normalizeTranscriptionConfig(settings);
    const aiConfig = getTranscriptionAiConfig(settings);
    const defaultsPayload = getAsrVoiceAiDefaultsCached(transcriptionProjectId);
    const aiDefaults = defaultsPayload.defaults || {};
    transcriptionShortcutsDraft = clone(config.shortcuts) || {};

    getElement("transcription-auto-play").checked = config.autoPlay === true;
    getElement("transcription-playback-rate").value = String(config.playbackRateValue);
    getElement("transcription-reset-rate").value = String(config.resetRateValue);
    getElement("transcription-rate-step").value = String(config.rateStepValue);
    getElement("transcription-seek-step").value = String(config.seekStepSeconds);
    getElement("transcription-volume").value = String(config.volumeValue);
    getElement("transcription-default-valid").checked = config.defaultValid === true;
    getElement("transcription-fill-on-valid").checked = config.fillOnValid !== false;
    getElement("transcription-clear-on-invalid").checked = config.clearOnInvalid !== false;
    if (getElement("transcription-ai-suggestion-timeout")) {
      getElement("transcription-ai-suggestion-timeout").value = String(
        Number(aiConfig.aiSuggestionRequestTimeoutMs || aiDefaults.timeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS)
      );
    }
    if (getElement("transcription-ai-suggestion-enable-thinking")) {
      applyForcedThinkingToggle(
        "transcription-ai-suggestion-enable-thinking",
        "thinking 已全局固定关闭；转写链路统一禁止开启思考模式。"
      );
    }
    if (getElement("transcription-ai-suggestion-listen-model-select")) {
      applyJudgementModelField(
        "transcription-ai-suggestion-listen-model-select",
        "transcription-ai-suggestion-listen-model-custom",
        getAsrVoiceAiEffectiveText(aiConfig.aiSuggestionListenModel, aiDefaults.listenModel),
        judgementAiListenModels,
        "listen"
      );
    }
    if (getElement("transcription-ai-suggestion-compare-model-select")) {
      applyJudgementModelField(
        "transcription-ai-suggestion-compare-model-select",
        "transcription-ai-suggestion-compare-model-custom",
        getAsrVoiceAiEffectiveText(aiConfig.aiSuggestionCompareModel, aiDefaults.compareModel),
        judgementAiCompareModels,
        "compare"
      );
    }
    if (getElement("transcription-ai-suggestion-listen-prompt")) {
      getElement("transcription-ai-suggestion-listen-prompt").value = String(
        getAsrVoiceAiEffectiveText(aiConfig.aiSuggestionListenPrompt, aiDefaults.listenPrompt)
      );
    }
    if (getElement("transcription-ai-suggestion-compare-prompt")) {
      getElement("transcription-ai-suggestion-compare-prompt").value = String(
        getAsrVoiceAiEffectiveText(aiConfig.aiSuggestionComparePrompt, aiDefaults.comparePrompt)
      );
    }
    if (getElement("transcription-ai-suggestion-temperature")) {
      getElement("transcription-ai-suggestion-temperature").value = String(
        getAsrVoiceAiEffectiveText(aiConfig.aiSuggestionTemperature, aiDefaults.temperature)
      );
      getElement("transcription-ai-suggestion-top-p").value = String(
        getAsrVoiceAiEffectiveText(aiConfig.aiSuggestionTopP, aiDefaults.top_p)
      );
      getElement("transcription-ai-suggestion-max-tokens").value = String(
        getAsrVoiceAiEffectiveText(aiConfig.aiSuggestionMaxTokens, aiDefaults.max_tokens)
      );
      getElement("transcription-ai-suggestion-max-completion-tokens").value = String(
        getAsrVoiceAiEffectiveText(
          aiConfig.aiSuggestionMaxCompletionTokens,
          aiDefaults.max_completion_tokens
        )
      );
      getElement("transcription-ai-suggestion-presence-penalty").value = String(
        getAsrVoiceAiEffectiveText(aiConfig.aiSuggestionPresencePenalty, aiDefaults.presence_penalty)
      );
      getElement("transcription-ai-suggestion-frequency-penalty").value = String(
        getAsrVoiceAiEffectiveText(
          aiConfig.aiSuggestionFrequencyPenalty,
          aiDefaults.frequency_penalty
        )
      );
      getElement("transcription-ai-suggestion-seed").value = String(
        getAsrVoiceAiEffectiveText(aiConfig.aiSuggestionSeed, aiDefaults.seed)
      );
      getElement("transcription-ai-suggestion-stop-sequences").value = String(
        getAsrVoiceAiEffectiveText(aiConfig.aiSuggestionStopSequences, aiDefaults.stop)
      );
      applyTranscriptionAiAdvancedFieldVisibility();
    }

    stopTranscriptionShortcutRecording("");
    renderTranscriptionShortcutGrid();
    syncOptionsCustomSelects(getElement("detail-view"));
    const backendLabel = formatBackendModeLabel(settings);
    setStatus(
      "transcription-status",
      "数据统计上传为脚本默认能力，已强制启用；定时上传按脚本能力强制启用。后端地址：全局 " +
        backendLabel +
        "；当前题 AI 推荐仅供参考，需手动点击“填入 AI 推荐”生效；提交类快捷键只触发页面系统按钮，若出现二次确认需手动确认。"
    );
  }

  async function saveTranscriptionSettings() {
    if (!storage || typeof storage.saveProjectSettings !== "function") {
      setStatus("transcription-status", "当前扩展版本不支持保存转写设置。");
      return false;
    }

    const current = normalizeTranscriptionConfig(currentSettings || {});
    const currentAi = getTranscriptionAiConfig(currentSettings || {});
    const aiDefaults = getAsrVoiceAiDefaultsCached(transcriptionProjectId).defaults || {};
    const shortcuts = {};
    transcriptionShortcutActions.forEach(function (action) {
      shortcuts[action.key] = normalizeShortcut(transcriptionShortcutsDraft[action.key]);
    });

    const patch = {
      autoPlay: getElement("transcription-auto-play").checked === true,
      playbackRateValue: clampNumber(
        getElement("transcription-playback-rate").value,
        current.playbackRateValue,
        0.25,
        5,
        2
      ),
      resetRateValue: clampNumber(
        getElement("transcription-reset-rate").value,
        current.resetRateValue,
        0.25,
        5,
        2
      ),
      rateStepValue: normalizeTranscriptionRateStep(
        getElement("transcription-rate-step").value,
        current.rateStepValue
      ),
      seekStepSeconds: normalizeTranscriptionSeekStep(
        getElement("transcription-seek-step").value,
        current.seekStepSeconds
      ),
      volumeValue: clampNumber(getElement("transcription-volume").value, current.volumeValue, 0, 1000, 0),
      defaultValid: getElement("transcription-default-valid").checked === true,
      fillOnValid: getElement("transcription-fill-on-valid").checked === true,
      clearOnInvalid: getElement("transcription-clear-on-invalid").checked === true,
      shortcutPlayPause: shortcuts.shortcutPlayPause,
      shortcutValid: shortcuts.shortcutValid,
      shortcutInvalid: shortcuts.shortcutInvalid,
      shortcutFill: shortcuts.shortcutFill,
      shortcutRemoveSpaces: shortcuts.shortcutRemoveSpaces,
      shortcutConvertNum: shortcuts.shortcutConvertNum,
      shortcutToggleFocus: shortcuts.shortcutToggleFocus,
      shortcutBackward: shortcuts.shortcutBackward,
      shortcutForward: shortcuts.shortcutForward,
      shortcutSpeedDown: shortcuts.shortcutSpeedDown,
      shortcutSpeedUp: shortcuts.shortcutSpeedUp,
      shortcutResetSpeed: shortcuts.shortcutResetSpeed,
      shortcutVolDown: shortcuts.shortcutVolDown,
      shortcutVolUp: shortcuts.shortcutVolUp,
      shortcutResetVol: shortcuts.shortcutResetVol,
      shortcutCopyDuration: shortcuts.shortcutCopyDuration,
      shortcutUploadStats: shortcuts.shortcutUploadStats,
      shortcutAiSuggest: shortcuts.shortcutAiSuggest,
      shortcutApplyAiSuggestion: shortcuts.shortcutApplyAiSuggestion,
      shortcutSubmitTask: shortcuts.shortcutSubmitTask,
      shortcutSubmitTaskAndFinish: shortcuts.shortcutSubmitTaskAndFinish,
    };

    if (getElement("transcription-ai-suggestion-timeout")) {
      patch.aiSuggestionEnabled = true;
      patch.aiSuggestionRequestTimeoutMs = clampNumber(
        Number(getElement("transcription-ai-suggestion-timeout").value),
        currentAi.aiSuggestionRequestTimeoutMs,
        1000,
        180000,
        0
      );
      patch.aiSuggestionListenModel = readJudgementModelField(
        "transcription-ai-suggestion-listen-model-select",
        "transcription-ai-suggestion-listen-model-custom",
        "qwen3.5-omni-flash",
        judgementAiListenModels
      );
      patch.aiSuggestionCompareModel = readJudgementModelField(
        "transcription-ai-suggestion-compare-model-select",
        "transcription-ai-suggestion-compare-model-custom",
        "qwen3.5-plus",
        judgementAiCompareModels
      );
      patch.aiSuggestionListenPrompt = (function () {
        const value = normalizePromptText(getElement("transcription-ai-suggestion-listen-prompt").value);
        const defaultValue = normalizePromptText(aiDefaults.listenPrompt || "");
        return value && value !== defaultValue ? value : "";
      })();
      patch.aiSuggestionComparePrompt = (function () {
        const value = normalizePromptText(getElement("transcription-ai-suggestion-compare-prompt").value);
        const defaultValue = normalizePromptText(aiDefaults.comparePrompt || "");
        return value && value !== defaultValue ? value : "";
      })();
      patch.aiSuggestionTemperature = isJudgementAiParamSupported("temperature")
        ? (function () {
            const value = normalizeOptionalNumberText(
              getElement("transcription-ai-suggestion-temperature").value,
              0,
              2,
              3
            );
            const defaultValue = normalizeOptionalNumberText(aiDefaults.temperature, 0, 2, 3);
            return value && value !== defaultValue ? value : "";
          })()
        : "";
      patch.aiSuggestionTopP = isJudgementAiParamSupported("top_p")
        ? (function () {
            const value = normalizeOptionalNumberText(
              getElement("transcription-ai-suggestion-top-p").value,
              0,
              1,
              3
            );
            const defaultValue = normalizeOptionalNumberText(aiDefaults.top_p, 0, 1, 3);
            return value && value !== defaultValue ? value : "";
          })()
        : "";
      patch.aiSuggestionMaxTokens = isJudgementAiParamSupported("max_tokens")
        ? (function () {
            const value = normalizeOptionalIntegerText(
              getElement("transcription-ai-suggestion-max-tokens").value,
              1,
              8192
            );
            const defaultValue = normalizeOptionalIntegerText(aiDefaults.max_tokens, 1, 8192);
            return value && value !== defaultValue ? value : "";
          })()
        : "";
      patch.aiSuggestionMaxCompletionTokens = isJudgementAiParamSupported("max_completion_tokens")
        ? (function () {
            const value = normalizeOptionalIntegerText(
              getElement("transcription-ai-suggestion-max-completion-tokens").value,
              1,
              8192
            );
            const defaultValue = normalizeOptionalIntegerText(
              aiDefaults.max_completion_tokens,
              1,
              8192
            );
            return value && value !== defaultValue ? value : "";
          })()
        : "";
      patch.aiSuggestionPresencePenalty = isJudgementAiParamSupported("presence_penalty")
        ? (function () {
            const value = normalizeOptionalNumberText(
              getElement("transcription-ai-suggestion-presence-penalty").value,
              -2,
              2,
              3
            );
            const defaultValue = normalizeOptionalNumberText(aiDefaults.presence_penalty, -2, 2, 3);
            return value && value !== defaultValue ? value : "";
          })()
        : "";
      patch.aiSuggestionFrequencyPenalty = isJudgementAiParamSupported("frequency_penalty")
        ? (function () {
            const value = normalizeOptionalNumberText(
              getElement("transcription-ai-suggestion-frequency-penalty").value,
              -2,
              2,
              3
            );
            const defaultValue = normalizeOptionalNumberText(aiDefaults.frequency_penalty, -2, 2, 3);
            return value && value !== defaultValue ? value : "";
          })()
        : "";
      patch.aiSuggestionSeed = isJudgementAiParamSupported("seed")
        ? (function () {
            const value = normalizeOptionalIntegerText(
              getElement("transcription-ai-suggestion-seed").value,
              0,
              2147483647
            );
            const defaultValue = normalizeOptionalIntegerText(aiDefaults.seed, 0, 2147483647);
            return value && value !== defaultValue ? value : "";
          })()
        : "";
      patch.aiSuggestionResponseFormat = "json_object";
      patch.aiSuggestionStopSequences = isJudgementAiParamSupported("stop")
        ? (function () {
            const value = normalizeStopSequencesText(
              getElement("transcription-ai-suggestion-stop-sequences").value
            );
            const defaultValue = normalizeStopSequencesText(aiDefaults.stop || "");
            return value && value !== defaultValue ? value : "";
          })()
        : "";
      patch.aiSuggestionEnableThinking = false;
      patch.aiSuggestionModel = patch.aiSuggestionCompareModel;
      patch.aiSuggestionListenModel =
        patch.aiSuggestionListenModel === String(aiDefaults.listenModel || "").trim()
          ? ""
          : patch.aiSuggestionListenModel;
      patch.aiSuggestionCompareModel =
        patch.aiSuggestionCompareModel === String(aiDefaults.compareModel || "").trim()
          ? ""
          : patch.aiSuggestionCompareModel;
    }

    setStatus("transcription-status", "正在保存转写设置...");
    try {
      currentSettings = await storage.saveProjectSettings(transcriptionProjectId, patch);
      applyTranscriptionForm(currentSettings);
      setStatus("transcription-status", "转写设置已保存；已打开详情页请刷新或等待自动同步。");
      return true;
    } catch (error) {
      setStatus(
        "transcription-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  function renderScriptCenter(settings) {
    ensurePublicHeroShell();
    const center = getElement("script-center-view");
    const platformIds = getVisiblePlatformIds(settings).filter(function (platformId) {
      return getVisiblePlatformScriptIds(settings, platformId).length > 0;
    });
    const scriptIds = getVisibleScriptIds(settings);
    const enabledCount = scriptIds.filter(function (scriptId) {
      return isScriptEnabled(settings, scriptId);
    }).length;
    const platformCountNode = getElement("public-platform-count");
    const scriptCountNode = getElement("public-script-count");
    const enabledCountNode = getElement("public-enabled-count");
    if (platformCountNode) {
      platformCountNode.textContent = formatNumber(platformIds.length);
    }
    if (scriptCountNode) {
      scriptCountNode.textContent = formatNumber(scriptIds.length);
    }
    if (enabledCountNode) {
      enabledCountNode.textContent = formatNumber(enabledCount);
    }

    center.innerHTML = [
      '<section class="public-center-toolbar">',
      '<div class="public-center-toolbar-copy">',
      "<strong>功能面板工作台</strong>",
      "<span>默认只读浏览；进入编辑模式后可拖动整个平台区块上下重排。</span>",
      "</div>",
      '<div class="public-center-toolbar-actions">',
      '<button id="public-center-edit-toggle" class="' +
        (publicCenterEditMode ? "primary-button" : "ghost-button") +
        '" type="button">' +
        (publicCenterEditMode ? "完成编辑" : "编辑顺序") +
        "</button>",
      "</div>",
      '<div id="public-center-edit-status" class="status-text public-center-edit-status"></div>',
      "</section>",
      '<div class="platform-workbench' + (publicCenterEditMode ? " is-editing" : "") + '">',
      platformIds
        .map(function (platformId) {
          const platform = platformLibrary[platformId] || {};
          const platformScriptIds = getVisiblePlatformScriptIds(settings, platformId);
          const preferredScript = getPreferredPlatformScript(platformScriptIds, settings);

          const scriptMarkup = platformScriptIds
            .map(function (scriptId) {
              const script = scriptLibrary[scriptId] || {};
              const status = getScriptStatus(settings, scriptId);
              const active = status.tone === "enabled";

              return [
                '<article class="script-card' + (active ? " active" : "") + '">',
                '<div class="script-card-top">',
                '<div class="script-card-main">',
                '<div class="script-title">',
                "<h3>" + String(script.label || scriptId) + "</h3>",
                '<div class="meta-row">',
                '<span class="script-pill info">' + String(script.statusLabel || "脚本") + "</span>",
                '<span class="script-pill ' + status.tone + '">' + status.text + "</span>",
                "</div>",
                "</div>",
                "</div>",
                '<div class="script-actions">',
                '<button type="button" class="primary-button" data-open-script="' + scriptId + '">打开设置</button>',
                isScriptEnabled(settings, scriptId)
                  ? '<button type="button" class="danger-button" data-disable-script="' + scriptId + '">关闭脚本</button>'
                  : '<button type="button" class="secondary-button" data-enable-script="' + scriptId + '">启用脚本</button>',
                "</div>",
                "</div>",
                buildScriptRemarkMarkup(script),
                "</article>",
              ].join("");
            })
            .join("");

          return [
            '<section class="platform-section platform-module' +
              (publicCenterEditMode ? " is-editing" : "") +
              '" data-platform-id="' +
              escapeHtml(platformId) +
              '">',
            '<div class="platform-body">',
            '<div class="platform-summary">',
            '<div class="platform-head platform-head-inline">',
            "<div>",
            "<h2>" + String(platform.label || platformId) + "</h2>",
            '<p class="platform-copy">' + String(platform.description || "") + "</p>",
            "</div>",
            "</div>",
            '<div class="platform-facts">',
            '<button type="button" class="pill info platform-link-pill" data-platform-entry="' +
              escapeHtml(buildPlatformRootUrl(platform)) +
              '">' +
              escapeHtml(buildPlatformDisplayHost(platform)) +
              '<span class="platform-link-mark" aria-hidden="true">↗</span></button>',
            '<span class="pill ' + (preferredScript.isActive ? "enabled" : "info") + '">' +
              (preferredScript.isActive ? "当前启用：" : "默认启用：") +
              escapeHtml(preferredScript.label) +
              "</span>",
            "</div>",
            "</div>",
            '<div class="platform-script-stack">' + scriptMarkup + "</div>",
            "</div>",
            "</section>",
          ].join("");
        })
        .join(""),
      "</div>",
    ].join("");

    Array.from(center.querySelectorAll("[data-open-script]")).forEach(function (button) {
      button.addEventListener("click", function () {
        navigateToScript(button.getAttribute("data-open-script"));
      });
    });

    Array.from(center.querySelectorAll("[data-enable-script]")).forEach(function (button) {
      button.addEventListener("click", function () {
        void toggleScript(button.getAttribute("data-enable-script"), true);
      });
    });

    Array.from(center.querySelectorAll("[data-disable-script]")).forEach(function (button) {
      button.addEventListener("click", function () {
        void toggleScript(button.getAttribute("data-disable-script"), false);
      });
    });

    bindPlatformReorderInteractions(center, settings);
  }

  function renderHomeBackendEndpoint(settings) {
    const serverButton = getElement("home-endpoint-server");
    const localButton = getElement("home-endpoint-local");
    const betaButton = getElement("home-endpoint-beta");
    const serverUrlInput = getElement("home-endpoint-server-url");
    const localUrlInput = getElement("home-endpoint-local-url");
    const betaUrlInput = getElement("home-endpoint-beta-url");
    const expandToggleButton = getElement("home-endpoint-expand-toggle");
    const configPanel = getElement("home-endpoint-config-panel");
    if (!(serverButton instanceof HTMLButtonElement) || !(localButton instanceof HTMLButtonElement)) {
      return;
    }

    const draft = ensureAdminBackendDraft(settings || {});
    const savedMode = getBackendModeFromSettings(settings || {});
    const mode = draft.backendEndpointMode;
    const statusNode = getElement("home-endpoint-status");
    const configExpanded = draft.backendConfigExpanded === true;
    const isLocal = mode === backendModeLocal;
    const isBeta = mode === backendModeBeta;
    const betaUnlocked = canUseBetaFeatures(settings || {});

    serverButton.classList.toggle("active", !isLocal && !isBeta);
    localButton.classList.toggle("active", isLocal);
    serverButton.setAttribute("aria-pressed", String(!isLocal && !isBeta));
    localButton.setAttribute("aria-pressed", String(isLocal));
    if (betaButton instanceof HTMLButtonElement) {
      betaButton.classList.toggle("hidden", !betaUnlocked);
      betaButton.classList.toggle("active", isBeta);
      betaButton.setAttribute("aria-pressed", String(isBeta));
    }
    if (serverUrlInput instanceof HTMLInputElement) {
      serverUrlInput.value = normalizeBackendBaseUrl(
        draft.backendBaseUrls?.server,
        defaultBackendBaseUrls.server
      );
    }
    if (localUrlInput instanceof HTMLInputElement) {
      localUrlInput.value = normalizeBackendBaseUrl(
        draft.backendBaseUrls?.local,
        defaultBackendBaseUrls.local
      );
    }
    if (betaUrlInput instanceof HTMLInputElement) {
      betaUrlInput.classList.toggle("hidden", !betaUnlocked);
      betaUrlInput.value = normalizeBackendBaseUrl(
        draft.backendBaseUrls?.beta,
        defaultBackendBaseUrls.beta
      );
    }
    const betaUrlRow = getElement("home-endpoint-beta-row");
    if (betaUrlRow) {
      betaUrlRow.classList.toggle("hidden", !betaUnlocked);
    }
    const toggleNode = getElement("home-endpoint-toggle");
    if (toggleNode) {
      toggleNode.classList.remove("hidden");
    }
    if (expandToggleButton instanceof HTMLButtonElement) {
      expandToggleButton.textContent = configExpanded ? "折叠根地址配置" : "展开根地址配置";
      expandToggleButton.setAttribute("aria-expanded", String(configExpanded));
    }
    if (configPanel) {
      configPanel.classList.toggle("hidden", !configExpanded);
    }

    if (statusNode) {
      statusNode.textContent = isAdminBackendDraftDirty(settings || {})
        ? "当前草稿：" +
          buildBackendModeDisplayText(mode, draft) +
          "；尚未保存到本地缓存。"
        : "当前生效：" + buildBackendModeDisplayText(savedMode, settings || {});
    }
  }

  async function setHomeBackendEndpoint(mode) {
    const rawMode = String(mode || "").trim().toLowerCase();
    const normalizedMode =
      rawMode === backendModeLocal
        ? backendModeLocal
        : rawMode === backendModeBeta
          ? backendModeBeta
          : backendModeServer;
    const draft = getAdminBackendDraft();
    if (normalizedMode === backendModeBeta && !canUseBetaFeatures(currentSettings || {})) {
      setStatus("home-endpoint-status", "当前版本未解锁 beta 功能。");
      return;
    }
    draft.backendEndpointMode = normalizedMode;
    renderHomeBackendEndpoint(currentSettings || {});
    renderHomeAiUsageOperator(currentSettings || {});
    renderAdminBackendSummary(adminDashboardCache || {});
  }

  function parseJsonSafely(text) {
    try {
      return JSON.parse(String(text || "{}"));
    } catch (error) {
      return {};
    }
  }

  function normalizeText(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function normalizeDateText(value) {
    const text = normalizeText(value);
    return dateTextPattern.test(text) ? text : "";
  }

  function getAiUsageOperatorName(settings) {
    return normalizeAiUsageOperatorName(settings?.meta?.aiUsageOperatorName);
  }

  function renderHomeAiUsageOperator(settings) {
    const operatorInput = getElement("workspace-ai-usage-operator-input");
    if (operatorInput instanceof HTMLInputElement) {
      operatorInput.value = getAiUsageOperatorName(settings || {});
    }
  }

  async function saveAdminBackendSettings() {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("home-endpoint-status", "当前扩展版本不支持保存后端设置。");
      return false;
    }
    const draft = getAdminBackendDraft();
    const rawMode = String(draft.backendEndpointMode || "").trim().toLowerCase();
    const normalizedMode =
      rawMode === backendModeLocal
        ? backendModeLocal
        : rawMode === backendModeBeta
          ? backendModeBeta
          : backendModeServer;
    const normalizedBackendBaseUrls = {
      server: normalizeBackendBaseUrl(
        draft.backendBaseUrls?.server,
        defaultBackendBaseUrls.server
      ),
      local: normalizeBackendBaseUrl(
        draft.backendBaseUrls?.local,
        defaultBackendBaseUrls.local
      ),
      beta: normalizeBackendBaseUrl(
        draft.backendBaseUrls?.beta,
        defaultBackendBaseUrls.beta
      ),
    };
    if (!normalizedBackendBaseUrls.server || !normalizedBackendBaseUrls.local) {
      setStatus("home-endpoint-status", "请先填写合法的 server 和 local 根地址。");
      return false;
    }
    if (canUseBetaFeatures(currentSettings || {}) && !normalizedBackendBaseUrls.beta) {
      setStatus("home-endpoint-status", "请先填写合法的 beta 根地址。");
      return false;
    }
    if (normalizedMode === backendModeBeta && !normalizedBackendBaseUrls.beta) {
      setStatus("home-endpoint-status", "请先填写有效的 beta 根地址。");
      return false;
    }
    setStatus("home-endpoint-status", "正在保存后端根地址...");
    try {
      currentSettings = await storage.patchSettings({
        meta: {
          backendEndpointMode: normalizedMode,
          backendBaseUrls: normalizedBackendBaseUrls,
          betaBackendBaseUrl: normalizedBackendBaseUrls.beta,
        },
      });
      resetAdminBackendDraft(currentSettings);
      renderWorkspaceSidebar(currentSettings || {}, getCurrentRouteState());
      renderHomeBackendEndpoint(currentSettings || {});
      renderAdminBackendSummary(adminDashboardCache || {});
      if (endpointAdvancedUnlocked) {
        projectDataDownloadDatasets = [];
        aiCallLogDownloadDatasets = [];
        void loadProjectDataDownloadOptions();
        void loadAiCallLogOptions();
      }
      setStatus("home-endpoint-status", "后端根地址已保存到本地缓存。");
      return true;
    } catch (error) {
      setStatus(
        "home-endpoint-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  async function saveWorkspaceAiUsageOperatorName() {
    if (
      !storage ||
      typeof storage.saveAiUsageOperatorName !== "function" ||
      typeof storage.getSettings !== "function"
    ) {
      setStatus("workspace-ai-usage-operator-status", "当前扩展版本不支持保存 AI 调用使用人。");
      return false;
    }
    const input = getElement("workspace-ai-usage-operator-input");
    if (!(input instanceof HTMLInputElement)) {
      return false;
    }
    const operatorName = normalizeAiUsageOperatorName(input.value);
    setStatus("workspace-ai-usage-operator-status", "正在保存 AI 调用使用人...");
    try {
      const verification = await storage.saveAiUsageOperatorName(operatorName);
      if (verification.storageStatus !== "ready") {
        setStatus(
          "workspace-ai-usage-operator-status",
          verification.storageStatus === "extension-context-invalidated"
            ? "扩展已重新加载，请刷新当前标注页后重新打开扩展首页再保存。"
            : "无法读取当前扩展实例的存储；请重新打开扩展首页，并确认浏览器只保留一个 0.4.4 扩展实例。"
        );
        return false;
      }
      currentSettings = await storage.getSettings();
      resetAdminBackendDraft(currentSettings);
      renderWorkspaceSidebar(currentSettings || {}, getCurrentRouteState());
      renderHomeAiUsageOperator(currentSettings || {});
      renderAdminBackendSummary(adminDashboardCache || {});
      if (verification.persisted === true) {
        setStatus("workspace-ai-usage-operator-status", "AI 调用使用人已保存并确认写入扩展存储。");
        return true;
      }
      setStatus(
        "workspace-ai-usage-operator-status",
        "未能确认 AI 调用使用人已写入当前扩展实例；请仅保留一个 0.4.4 扩展实例，保存后刷新当前标注页。"
      );
      return false;
    } catch (error) {
      setStatus(
        "workspace-ai-usage-operator-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  function getProjectDataDownloadDatasetById(datasetId) {
    const targetId = normalizeText(datasetId);
    if (!targetId) {
      return null;
    }
    for (let index = 0; index < projectDataDownloadDatasets.length; index += 1) {
      const item = projectDataDownloadDatasets[index] || {};
      if (normalizeText(item.id) === targetId) {
        return item;
      }
    }
    return null;
  }

  function setProjectDataDownloadStatus(text) {
    const node = getElement("project-download-status");
    if (node) {
      node.textContent = String(text || "");
    }
  }

  function updateProjectDataDownloadSupplierVisibility() {
    const datasetSelect = getElement("project-download-dataset");
    const supplierRow = getElement("project-download-supplier-row");
    const supplierSelect = getElement("project-download-supplier");
    if (
      !(datasetSelect instanceof HTMLSelectElement) ||
      !(supplierRow instanceof HTMLElement) ||
      !(supplierSelect instanceof HTMLSelectElement)
    ) {
      return;
    }

    const selectedDataset = getProjectDataDownloadDatasetById(datasetSelect.value);
    const supplierState = buildProjectDownloadSupplierState(selectedDataset);
    const currentValue = normalizeText(supplierSelect.value);
    supplierSelect.innerHTML = ['<option value="">请选择供应商</option>']
      .concat(
        supplierState.options.map(function (option) {
          const value = escapeHtml(option.value);
          const label = escapeHtml(option.label);
          return '<option value="' + value + '">' + label + "</option>";
        })
      )
      .join("");
    supplierRow.classList.toggle("hidden", !supplierState.showRow);
    if (!supplierState.showRow) {
      supplierSelect.value = "";
      return;
    }
    const hasCurrentOption = supplierState.options.some(function (option) {
      return normalizeText(option.value) === currentValue;
    });
    supplierSelect.value = hasCurrentOption
      ? currentValue
      : supplierState.options[0]?.value || "";
  }

  function renderProjectDataDownloadDatasets(datasets) {
    const datasetSelect = getElement("project-download-dataset");
    if (!(datasetSelect instanceof HTMLSelectElement)) {
      return;
    }
    projectDataDownloadDatasets = Array.isArray(datasets) ? clone(datasets) : [];
    datasetSelect.innerHTML = ['<option value="">请选择数据类型</option>']
      .concat(
        projectDataDownloadDatasets.map(function (item) {
          const id = escapeHtml(item.id || "");
          const label = escapeHtml(item.label || item.id || "");
          return '<option value="' + id + '">' + label + "</option>";
        })
      )
      .join("");
    updateProjectDataDownloadSupplierVisibility();
  }

  function getProjectDataDownloadOperatorName(settings) {
    const name = settings?.meta?.projectDataDownloadOperatorName;
    return normalizeText(name);
  }

  async function persistProjectDataDownloadOperatorName(operatorName) {
    if (!storage || typeof storage.patchSettings !== "function") {
      return;
    }
    const normalizedName = normalizeText(operatorName);
    const currentName = getProjectDataDownloadOperatorName(currentSettings || {});
    if (normalizedName === currentName) {
      return;
    }
    currentSettings = await storage.patchSettings({
      meta: {
        projectDataDownloadOperatorName: normalizedName,
      },
    });
  }

  function getDownloadClientInfo() {
    const screenText =
      globalThis.screen && Number(screen.width) > 0 && Number(screen.height) > 0
        ? String(screen.width) + "x" + String(screen.height)
        : "";
    return {
      userAgent: normalizeText(globalThis.navigator?.userAgent || ""),
      platform: normalizeText(globalThis.navigator?.platform || ""),
      language: normalizeText(globalThis.navigator?.language || ""),
      screen: screenText,
    };
  }

  function triggerDownloadLink(downloadUrl) {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function getProjectDataDownloadErrorMessage(body, statusCode) {
    const message = normalizeText(body?.message || "");
    const code = normalizeText(body?.code || "");
    if (code === "project-data-download-auth-not-configured") {
      return "后端未配置项目数据下载鉴权环境变量。";
    }
    if (code === "project-data-download-password-invalid") {
      return "下载密码错误，请重试。";
    }
    if (code === "project-data-download-supplier-required") {
      return "当前数据包含多个供应商，请先选择供应商。";
    }
    if (code === "project-data-download-csv-not-found") {
      return "当前数据文件不存在，请先生成数据后再下载。";
    }
    if (code === "project-data-download-token-invalid") {
      return "下载链接无效或已过期，请重新申请。";
    }
    if (
      code === "project-data-download-token-expired" ||
      code === "project-data-download-token-missing"
    ) {
      return "管理员会话已失效，请重新进入系统管理登录。";
    }
    if (message) {
      return message;
    }
    if (Number(statusCode) >= 500) {
      return "后端服务异常，请稍后重试。";
    }
    return "请求失败，请稍后重试。";
  }

  function getAiCallLogDatasetById(datasetId) {
    const targetId = normalizeText(datasetId);
    if (!targetId) {
      return null;
    }
    for (let index = 0; index < aiCallLogDownloadDatasets.length; index += 1) {
      const item = aiCallLogDownloadDatasets[index] || {};
      if (normalizeText(item.id) === targetId) {
        return item;
      }
    }
    return null;
  }

  function isAiCallLogDatasetVisible(datasetInfo, settings) {
    const source = datasetInfo && typeof datasetInfo === "object" ? datasetInfo : {};
    if (normalizeText(source.visibility).toLowerCase() === "beta") {
      return canUseBetaFeatures(settings || {}) === true;
    }
    return true;
  }

  function setAiCallLogStatus(text) {
    setStatus("ai-call-log-status", text);
  }

  function getAiCallLogOperatorName(settings) {
    return normalizeText(settings?.meta?.aiCallLogDownloadOperatorName);
  }

  async function persistAiCallLogOperatorName(operatorName) {
    if (!storage || typeof storage.patchSettings !== "function") {
      return;
    }
    const normalizedName = normalizeText(operatorName).slice(0, 60);
    const currentName = getAiCallLogOperatorName(currentSettings || {});
    if (normalizedName === currentName) {
      return;
    }
    currentSettings = await storage.patchSettings({
      meta: {
        aiCallLogDownloadOperatorName: normalizedName,
      },
    });
  }

  function getAiCallLogErrorMessage(body, statusCode) {
    const message = normalizeText(body?.message || "");
    const code = normalizeText(body?.code || "");
    if (code === "ai-call-log-download-auth-not-configured") {
      return "后端未配置 AI 请求记录下载鉴权环境变量。";
    }
    if (code === "ai-call-log-download-password-invalid") {
      return "下载密码错误，请重试。";
    }
    if (code === "ai-call-log-download-dataset-invalid") {
      return "脚本类型无效，请重新选择。";
    }
    if (code === "ai-call-log-download-empty") {
      return "当前筛选范围内没有 AI 请求记录。";
    }
    if (
      code === "ai-call-log-download-token-invalid" ||
      code === "ai-call-log-download-token-expired"
    ) {
      return "下载链接无效或已过期，请重新申请。";
    }
    if (code === "ai-call-log-download-token-missing") {
      return "管理员会话已失效，请重新进入系统管理登录。";
    }
    if (message) {
      return message;
    }
    if (Number(statusCode) >= 500) {
      return "后端服务异常，请稍后重试。";
    }
    return "请求失败，请稍后重试。";
  }

  function buildAiCallLogDatasetStatusText(datasetInfo) {
    if (!datasetInfo) {
      return "请选择脚本类型。";
    }
    if (datasetInfo.hasData === false) {
      return "当前脚本暂无 AI 请求记录。";
    }
    const parts = [];
    const dateFrom = normalizeDateText(datasetInfo.dateFrom);
    const dateTo = normalizeDateText(datasetInfo.dateTo);
    const fileCount = Number(datasetInfo.fileCount || 0);
    if (dateFrom || dateTo) {
      parts.push("可导出范围：" + (dateFrom || "未知") + " 至 " + (dateTo || "未知"));
    }
    if (fileCount > 0) {
      parts.push("日志文件数：" + String(fileCount));
    }
    parts.push("日期留空时默认导出全部范围。");
    return parts.length > 0 ? parts.join("；") : "当前脚本可导出 AI 请求记录。";
  }

  function updateAiCallLogDateInputs(options) {
    const settings = options && typeof options === "object" ? options : {};
    const datasetSelect = getElement("ai-call-log-dataset");
    const dateFromInput = getElement("ai-call-log-date-from");
    const dateToInput = getElement("ai-call-log-date-to");
    const exportButton = getElement("ai-call-log-export");
    if (
      !(datasetSelect instanceof HTMLSelectElement) ||
      !(dateFromInput instanceof HTMLInputElement) ||
      !(dateToInput instanceof HTMLInputElement)
    ) {
      return;
    }

    const datasetInfo = getAiCallLogDatasetById(datasetSelect.value);
    const hasData = Boolean(datasetInfo && datasetInfo.hasData !== false);
    const dateFrom = normalizeDateText(datasetInfo?.dateFrom);
    const dateTo = normalizeDateText(datasetInfo?.dateTo);

    dateFromInput.min = dateFrom;
    dateFromInput.max = dateTo;
    dateToInput.min = dateFrom;
    dateToInput.max = dateTo;

    if (!hasData) {
      dateFromInput.value = "";
      dateToInput.value = "";
      if (exportButton instanceof HTMLButtonElement) {
        exportButton.disabled = true;
      }
      if (settings.silent !== true) {
        setAiCallLogStatus(buildAiCallLogDatasetStatusText(datasetInfo));
      }
      return;
    }

    if (
      normalizeDateText(dateFromInput.value) &&
      ((dateFrom && dateFromInput.value < dateFrom) || (dateTo && dateFromInput.value > dateTo))
    ) {
      dateFromInput.value = "";
    }
    if (
      normalizeDateText(dateToInput.value) &&
      ((dateFrom && dateToInput.value < dateFrom) || (dateTo && dateToInput.value > dateTo))
    ) {
      dateToInput.value = "";
    }
    if (exportButton instanceof HTMLButtonElement) {
      exportButton.disabled = false;
    }
    if (settings.silent !== true) {
      setAiCallLogStatus(buildAiCallLogDatasetStatusText(datasetInfo));
    }
  }

  function renderAiCallLogDatasets(datasets) {
    const datasetSelect = getElement("ai-call-log-dataset");
    if (!(datasetSelect instanceof HTMLSelectElement)) {
      return;
    }
    const previousValue = normalizeText(datasetSelect.value);
    aiCallLogDownloadDatasets = (Array.isArray(datasets) ? clone(datasets) : []).filter(function (item) {
      return isAiCallLogDatasetVisible(item, currentSettings || {});
    });
    datasetSelect.innerHTML = ['<option value="">请选择脚本类型</option>']
      .concat(
        aiCallLogDownloadDatasets.map(function (item) {
          const id = escapeHtml(item.id || "");
          const label =
            escapeHtml(item.label || item.id || "") +
            (item?.hasData === false ? "（暂无记录）" : "");
          return '<option value="' + id + '">' + label + "</option>";
        })
      )
      .join("");
    const fallbackDataset = aiCallLogDownloadDatasets.find(function (item) {
      return item?.hasData !== false;
    });
    const nextValue =
      (previousValue && getAiCallLogDatasetById(previousValue) && previousValue) ||
      normalizeText(fallbackDataset?.id || aiCallLogDownloadDatasets[0]?.id || "");
    datasetSelect.value = nextValue;
    updateAiCallLogDateInputs({ silent: true });
  }

  async function loadAiCallLogOptions() {
    if (!endpointAdvancedUnlocked) {
      return;
    }
    setAiCallLogStatus("正在加载 AI 请求记录脚本类型...");
    const urlObject = new URL(buildBackendUrl(aiCallLogDownloadOptionsPath, currentSettings || {}));
    if (canUseBetaFeatures(currentSettings || {})) {
      urlObject.searchParams.set("includeBeta", "1");
    }
    try {
      const response = await fetch(urlObject.toString(), {
        method: "GET",
        cache: "no-store",
      });
      const body = parseJsonSafely(await response.text());
      if (!response.ok || body?.success !== true) {
        renderAiCallLogDatasets([]);
        setAiCallLogStatus(getAiCallLogErrorMessage(body, response.status));
        return;
      }
      renderAiCallLogDatasets(body?.data || []);
      if (aiCallLogDownloadDatasets.length <= 0) {
        setAiCallLogStatus("暂无可导出的 AI 请求记录脚本类型。");
        return;
      }
      updateAiCallLogDateInputs();
    } catch (error) {
      renderAiCallLogDatasets([]);
      setAiCallLogStatus(
        "加载失败：" + (error && error.message ? error.message : String(error))
      );
    }
  }

  async function loadProjectDataDownloadOptions() {
    if (!endpointAdvancedUnlocked) {
      return;
    }
    setProjectDataDownloadStatus("正在加载可下载数据类型...");
    const url = buildBackendUrl(projectDataDownloadOptionsPath, currentSettings || {});
    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });
      const body = parseJsonSafely(await response.text());
      if (!response.ok || body?.success !== true) {
        setProjectDataDownloadStatus(getProjectDataDownloadErrorMessage(body, response.status));
        return;
      }
      renderProjectDataDownloadDatasets(body?.data || []);
      if (projectDataDownloadDatasets.length <= 0) {
        setProjectDataDownloadStatus("暂无可下载数据类型。");
        return;
      }
      setProjectDataDownloadStatus("可下载数据类型已更新。");
    } catch (error) {
      setProjectDataDownloadStatus(
        "加载失败：" + (error && error.message ? error.message : String(error))
      );
    }
  }

  function unlockEndpointAdvancedPanel() {
    endpointAdvancedUnlocked = true;
    if (projectDataDownloadDatasets.length <= 0) {
      void loadProjectDataDownloadOptions();
    }
    if (aiCallLogDownloadDatasets.length <= 0) {
      void loadAiCallLogOptions();
    }
  }

  async function ensureBackendModeServerOnInit() {
    return;
  }

  function getChromeSessionStorageArea() {
    return globalThis.chrome?.storage?.session || null;
  }

  function getAdminStatusNode() {
    return getElement("admin-auth-status");
  }

  function setAdminAuthStatus(text, tone) {
    const node = getAdminStatusNode();
    if (!node) {
      return;
    }
    node.textContent = String(text || "");
    node.dataset.tone = String(tone || "neutral");
  }

  function setAdminPanelStatus(targetId, text) {
    const node = getElement(targetId);
    if (node) {
      node.textContent = String(text || "");
    }
  }

  function normalizeAdminSessionPayload(value) {
    const source = value && typeof value === "object" ? value : {};
    const token = normalizeText(source.token);
    const expiresAt = normalizeText(source.expiresAt);
    if (!token || !expiresAt) {
      return null;
    }
    return {
      token: token,
      expiresAt: expiresAt,
      expiresInSeconds: Math.max(0, Number(source.expiresInSeconds || 0) || 0),
      remember: source.remember === true,
    };
  }

  function isAdminSessionExpired(session) {
    const payload = normalizeAdminSessionPayload(session);
    if (!payload) {
      return true;
    }
    const expiresAt = Date.parse(payload.expiresAt);
    if (!Number.isFinite(expiresAt)) {
      return true;
    }
    return expiresAt <= Date.now() + 1000;
  }

  function hasActiveAdminSession() {
    return !isAdminSessionExpired(adminSessionState);
  }

  function readSessionStorageValue(key) {
    try {
      return globalThis.sessionStorage?.getItem(key) || "";
    } catch (_error) {
      return "";
    }
  }

  function writeSessionStorageValue(key, value) {
    try {
      globalThis.sessionStorage?.setItem(key, value);
    } catch (_error) {
      // Ignore session storage write failure.
    }
  }

  function removeSessionStorageValue(key) {
    try {
      globalThis.sessionStorage?.removeItem(key);
    } catch (_error) {
      // Ignore session storage removal failure.
    }
  }

  function readJsonText(value) {
    try {
      return JSON.parse(String(value || ""));
    } catch (_error) {
      return null;
    }
  }

  function persistPendingTopToast(message, tone, durationMs) {
    const normalizedMessage = String(message || "").trim();
    const hideDelay = Math.max(0, Math.round(Number(durationMs || 0) || 0));
    if (!normalizedMessage || hideDelay <= 0) {
      removeSessionStorageValue(pendingTopToastSessionStorageKey);
      return;
    }
    writeSessionStorageValue(
      pendingTopToastSessionStorageKey,
      JSON.stringify({
        message: normalizedMessage,
        tone: normalizeText(tone) || "info",
        durationMs: hideDelay,
      })
    );
  }

  function restorePendingTopToast() {
    const payload = readJsonText(readSessionStorageValue(pendingTopToastSessionStorageKey));
    removeSessionStorageValue(pendingTopToastSessionStorageKey);
    if (!payload || typeof payload !== "object") {
      return;
    }
    showTopToast(payload.message, payload.tone, payload.durationMs);
  }

  function readChromeSessionValue(key) {
    const area = getChromeSessionStorageArea();
    if (!area) {
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      area.get([key], function (result) {
        resolve(result && result[key] ? result[key] : null);
      });
    });
  }

  function writeChromeSessionValue(key, value) {
    const area = getChromeSessionStorageArea();
    if (!area) {
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      const nextValue = {};
      nextValue[key] = value;
      area.set(nextValue, function () {
        resolve();
      });
    });
  }

  function removeChromeSessionValue(key) {
    const area = getChromeSessionStorageArea();
    if (!area) {
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      area.remove([key], function () {
        resolve();
      });
    });
  }

  async function clearAdminSession(options) {
    const config = options && typeof options === "object" ? options : {};
    adminSessionState = null;
    adminDashboardCache = null;
    adminDownloadCenterReleasesCache = null;
    adminSelectedReleaseVersion = "";
    stopAdminDashboardAutoRefresh();
    endpointAdvancedUnlocked = false;
    adminBackendDraft = null;
    removeSessionStorageValue(adminSessionStorageKey);
    await removeChromeSessionValue(adminSessionStorageKey);
    if (config.keepStatus !== true) {
      setAdminAuthStatus("", "neutral");
    }
  }

  async function restoreAdminSession() {
    const fromPage = normalizeAdminSessionPayload(readJsonText(readSessionStorageValue(adminSessionStorageKey)));
    if (fromPage && !isAdminSessionExpired(fromPage)) {
      adminSessionState = fromPage;
      endpointAdvancedUnlocked = true;
      return;
    }
    const fromBrowser = normalizeAdminSessionPayload(await readChromeSessionValue(adminSessionStorageKey));
    if (fromBrowser && !isAdminSessionExpired(fromBrowser)) {
      adminSessionState = fromBrowser;
      endpointAdvancedUnlocked = true;
      writeSessionStorageValue(adminSessionStorageKey, JSON.stringify(fromBrowser));
      return;
    }
    await clearAdminSession({
      keepStatus: true,
    });
  }

  async function persistAdminSession(session, remember) {
    const payload = normalizeAdminSessionPayload(
      Object.assign({}, session || {}, {
        remember: remember === true,
      })
    );
    if (!payload) {
      return;
    }
    adminSessionState = payload;
    endpointAdvancedUnlocked = true;
    writeSessionStorageValue(adminSessionStorageKey, JSON.stringify(payload));
    if (remember === true) {
      await writeChromeSessionValue(adminSessionStorageKey, payload);
    } else {
      await removeChromeSessionValue(adminSessionStorageKey);
    }
  }

  function stopAdminDashboardAutoRefresh() {
    if (adminDashboardAutoRefreshTimer) {
      clearInterval(adminDashboardAutoRefreshTimer);
      adminDashboardAutoRefreshTimer = null;
    }
  }

  function shouldAutoRefreshAdminDashboard() {
    const route = getCurrentRouteState();
    return route.view === "admin" && hasActiveAdminSession();
  }

  function startAdminDashboardAutoRefresh() {
    stopAdminDashboardAutoRefresh();
    if (!shouldAutoRefreshAdminDashboard()) {
      return;
    }
    adminDashboardAutoRefreshTimer = setInterval(function () {
      if (!shouldAutoRefreshAdminDashboard()) {
        stopAdminDashboardAutoRefresh();
        return;
      }
      void loadAdminDashboard(true, "auto");
    }, adminDashboardAutoRefreshIntervalMs);
  }

  function buildAdminAuthorizationHeaders(extraHeaders) {
    const headers = Object.assign({}, extraHeaders || {});
    if (hasActiveAdminSession()) {
      headers.Authorization = "Bearer " + adminSessionState.token;
    }
    return headers;
  }

  function getAdminAuthErrorMessage(body, statusCode) {
    const code = normalizeText(body?.code || "");
    const message = normalizeText(body?.message || "");
    if (code === "admin-session-password-invalid") {
      return "管理员密码错误。";
    }
    if (code === "admin-session-auth-not-configured") {
      return "后端未配置管理员鉴权环境变量。";
    }
    if (message) {
      return message;
    }
    if (Number(statusCode) >= 500) {
      return "系统管理鉴权服务异常，请稍后重试。";
    }
    return "管理员鉴权失败，请稍后重试。";
  }

  function getAdminDashboardErrorMessage(body, statusCode) {
    const message = normalizeText(body?.message || "");
    if (message) {
      return message;
    }
    if (Number(statusCode) >= 500) {
      return "系统管理总览加载失败，请稍后重试。";
    }
    return "系统管理总览加载失败。";
  }

  async function requestAdminJson(path, options) {
    const config = options && typeof options === "object" ? options : {};
    if (!hasActiveAdminSession()) {
      adminAuthMessage = "进入系统管理前需要先输入密码。";
      await clearAdminSession({
        keepStatus: true,
      });
      return {
        authFailed: true,
      };
    }

    const response = await fetch(buildBackendUrl(path, currentSettings || {}), {
      method: config.method || "GET",
      cache: config.cache || "no-store",
      headers: buildAdminAuthorizationHeaders(config.headers),
      body: config.body,
    });
    const body = parseJsonSafely(await response.text());
    if (response.status === 401) {
      adminAuthMessage =
        normalizeText(body?.message || "") || "管理员会话已失效，请重新输入密码。";
      await clearAdminSession({
        keepStatus: true,
      });
      return {
        authFailed: true,
        response,
        body,
      };
    }
    return {
      response,
      body,
    };
  }

  function ensurePublicHeroShell() {
    const hero = document.querySelector(".hero");
    if (!(hero instanceof HTMLElement)) {
      return;
    }
    hero.classList.add("public-hero");
    const actionButton = getElement("stage-label");
    if (actionButton instanceof HTMLButtonElement) {
      actionButton.classList.add("admin-entry-button");
      actionButton.classList.add("hidden");
    }
    const homeEndpointCard = getElement("home-endpoint-card");
    if (homeEndpointCard) {
      homeEndpointCard.classList.add("hero-command-card");
    }
    if (!getElement("public-summary-strip")) {
      const summary = document.createElement("div");
      summary.id = "public-summary-strip";
      summary.className = "public-summary-strip";
      summary.innerHTML = [
        '<article class="public-summary-card"><span class="summary-label">平台总数</span><strong id="public-platform-count">0</strong><span class="summary-note">按平台分类管理脚本</span></article>',
        '<article class="public-summary-card"><span class="summary-label">脚本总数</span><strong id="public-script-count">0</strong><span class="summary-note">功能面板直接启停</span></article>',
        '<article class="public-summary-card"><span class="summary-label">当前生效</span><strong id="public-enabled-count">0</strong><span class="summary-note">同平台互斥规则自动生效</span></article>',
      ].join("");
      hero.appendChild(summary);
    }
  }

  function updateHeroForRoute(route) {
    const hero = document.querySelector(".hero");
    const heroKicker = getElement("hero-kicker");
    const heroDescription = getElement("hero-description");
    const summaryStrip = getElement("public-summary-strip");
    const stageLabel = getElement("stage-label");
    if (!(hero instanceof HTMLElement)) {
      return;
    }
    hero.classList.remove("hero-mode-center", "hero-mode-script", "hero-mode-admin", "hero-compact");
    if (stageLabel instanceof HTMLButtonElement) {
      stageLabel.classList.add("hidden");
    }
    if (route.view === "admin") {
      hero.classList.add("hero-mode-admin", "hero-compact");
      if (heroKicker) {
        heroKicker.textContent = "SYSTEM MANAGEMENT";
      }
      if (heroDescription) {
        heroDescription.textContent = "系统管理统一承载后端设置、数据导出与系统仪表盘；进入前需要密码验证。";
      }
      if (summaryStrip) {
        summaryStrip.classList.add("hidden");
      }
      return;
    }
    if (route.view === "downloads") {
      hero.classList.add("hero-mode-center", "hero-compact");
      if (heroKicker) {
        heroKicker.textContent = "DOWNLOAD CENTER";
      }
      if (heroDescription) {
        heroDescription.textContent = "公开下载中心集中提供扩展版本分发；默认推荐最新版，同时支持切换历史版本。";
      }
      if (summaryStrip) {
        summaryStrip.classList.add("hidden");
      }
      return;
    }
    if (route.view === "script") {
      hero.classList.add("hero-mode-script", "hero-compact");
      if (heroKicker) {
        heroKicker.textContent = "SCRIPT DETAIL";
      }
      if (heroDescription) {
        heroDescription.textContent = "当前页面用于编辑脚本专属设置；功能面板只保留启停入口，公共后端地址与数据导出仍统一走系统管理。";
      }
      if (stageLabel instanceof HTMLButtonElement) {
        stageLabel.textContent = "系统管理";
        stageLabel.title = "进入系统管理";
        stageLabel.setAttribute("aria-label", "进入系统管理");
        stageLabel.classList.remove("hidden");
      }
      if (summaryStrip) {
        summaryStrip.classList.add("hidden");
      }
      return;
    }
    hero.classList.add("hero-mode-center");
    if (heroKicker) {
      heroKicker.textContent = "FUNCTION PANEL";
    }
    if (heroDescription) {
      heroDescription.textContent = "功能面板只保留启停与详情入口；扩展版本下载统一进入脚本下载中心，后端设置、数据导出和系统仪表盘统一进入系统管理工作台。";
    }
    if (summaryStrip) {
      summaryStrip.classList.remove("hidden");
    }
  }

  function ensureAdminWorkspace() {
    if (getElement("admin-workspace")) {
      return;
    }
    ensurePublicHeroShell();
    const detailView = getElement("script-detail-view");
    if (!(detailView instanceof HTMLElement)) {
      return;
    }

    const adminSection = document.createElement("section");
    adminSection.id = "admin-workspace";
    adminSection.className = "admin-workspace hidden";
    adminSection.innerHTML = [
      '<div class="admin-shell">',
      '<div class="admin-stage">',
      '<section id="admin-auth-gate" class="admin-auth-gate">',
      "<h3>输入系统管理密码</h3>",
      "<p>系统管理页会复用下载鉴权密码。登录后当前浏览器会话内可直接查看仪表盘和发起导出。</p>",
      '<label class="admin-auth-field"><span>管理员密码</span><input id="admin-password-input" type="password" autocomplete="current-password" placeholder="请输入密码" /></label>',
      '<label class="field-toggle"><input id="admin-remember-session" type="checkbox" /><span>记住本次浏览器会话</span></label>',
      '<div class="field-actions"><button id="admin-unlock-button" class="primary-button" type="button">进入系统管理</button></div>',
      '<div id="admin-auth-status" class="status-text"></div>',
      "</section>",
      '<div id="admin-content" class="admin-content hidden">',
      '<div class="admin-toolbar field-actions">',
      '<span id="admin-stage-endpoint" class="status-text"></span>',
      '<div class="field-actions">',
      '<button id="admin-refresh-dashboard" class="ghost-button" type="button">刷新数据</button>',
      '<button id="admin-return-center" class="ghost-button" type="button">返回功能面板</button>',
      '<button id="admin-logout-button" class="secondary-button" type="button">退出登录</button>',
      "</div>",
      "</div>",
      '<nav class="admin-tab-strip">',
      '<button type="button" class="admin-nav-button" data-admin-tab="overview">仪表盘</button>',
      '<button type="button" class="admin-nav-button" data-admin-tab="backend">后端设置</button>',
      '<button type="button" class="admin-nav-button" data-admin-tab="exports">数据导出</button>',
      "</nav>",
      '<section id="admin-tab-overview" class="admin-tab-panel">',
      '<div class="admin-panel-head"><div><h3>系统仪表盘</h3><p>这里展示模型池占用、最近 24 小时日志统计和最近运行日志；页面每 60 秒自动刷新一次，也可手动刷新。</p></div></div>',
      '<section class="admin-surface-card"><div class="admin-card-head"><strong>模型池占用</strong><span>按顺序排队，每 50ms 发起 1 个请求</span></div><div id="admin-overview-pools"></div></section>',
      '<section class="admin-surface-card"><div class="admin-card-head"><strong>日志统计概况</strong><span id="admin-overview-log-summary-note">最近 24 小时汇总，文件日志保留 7 天</span></div><div id="admin-overview-log-summary" class="admin-summary-grid"></div></section>',
      '<section class="admin-surface-card"><div class="admin-card-head"><strong>最近运行日志</strong><span id="admin-overview-runtime-logs-note">默认显示近 20 条后台运行日志</span></div><div id="admin-overview-runtime-logs"></div></section>',
      '<div id="admin-overview-status" class="status-text"></div>',
      "</section>",
      '<section id="admin-tab-backend" class="admin-tab-panel hidden">',
      '<div class="admin-panel-head"><div><h3>后端设置</h3><p>这里统一维护 server / local / beta 三套后端根地址；AI 调用使用人和全局摘要统一放在左侧侧栏中管理。</p></div></div>',
      '<section class="admin-surface-card"><div class="admin-card-head"><strong>后端根地址</strong><span>保存后所有运行时 API 与下载入口都会跟随当前模式切换</span></div><div id="admin-backend-card-slot"></div></section>',
      "</section>",
      '<section id="admin-tab-exports" class="admin-tab-panel hidden">',
      '<div class="admin-panel-head"><div><h3>数据导出</h3><p>这里只保留项目数据下载和 AI 请求记录导出；扩展版本下载已移到公开脚本下载中心。</p></div></div>',
      '<div id="admin-download-summary" class="admin-summary-grid"></div>',
      '<div id="admin-download-grid" class="admin-download-grid"></div>',
      "</section>",
      "</div>",
      "</div>",
    ].join("");
    detailView.insertAdjacentElement("afterend", adminSection);

    const homeEndpointCard = getElement("home-endpoint-card");
    const adminStage = adminSection.querySelector(".admin-stage");
    const authGate = getElement("admin-auth-gate");
    if (
      homeEndpointCard instanceof HTMLElement &&
      adminStage instanceof HTMLElement &&
      authGate instanceof HTMLElement
    ) {
      adminStage.insertBefore(homeEndpointCard, authGate);
    }
    const projectDownloadPanel = getElement("project-data-download-panel");
    const aiCallLogPanel = getElement("ai-call-log-download-panel");
    const downloadGrid = getElement("admin-download-grid");
    if (downloadGrid instanceof HTMLElement) {
      if (projectDownloadPanel instanceof HTMLElement) {
        downloadGrid.appendChild(projectDownloadPanel);
      }
      if (aiCallLogPanel instanceof HTMLElement) {
        downloadGrid.appendChild(aiCallLogPanel);
      }
    }
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("zh-CN");
  }

  function formatDateTimeLabel(value) {
    const text = normalizeText(value);
    if (!text) {
      return "时间未知";
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return text;
    }
    return date.toLocaleString("zh-CN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function buildEmptyState(message) {
    return '<div class="empty-state">' + escapeHtml(message || "暂无数据") + "</div>";
  }

  function buildTaskStorePoolCardMarkup(jobs) {
    const taskStore = jobs && typeof jobs === "object" ? jobs : {};
    const capacity = Number(taskStore.capacity || taskStore.maxSize || 0) || 0;
    const usedCount = Number(taskStore.usedCount || 0) || 0;
    if (capacity <= 0 && usedCount <= 0) {
      return "";
    }
    const runningCount = Number(taskStore.runningCount || taskStore.activeCount || 0) || 0;
    const pendingCount = Number(taskStore.pendingCount || 0) || 0;
    const succeededCount = Number(taskStore.succeededCount || 0) || 0;
    const failedCount = Number(taskStore.failedCount || 0) || 0;
    const availableCount = Math.max(0, Number(taskStore.availableCount || capacity - usedCount) || 0);
    const ratio = Math.max(0, Math.min(100, Number(taskStore.utilizationPercent || 0)));
    const isFull = taskStore.isFull === true || (capacity > 0 && usedCount >= capacity);
    const statusText = isFull
      ? "任务池已满"
      : usedCount <= 0
        ? "当前空闲"
        : "总占用 " + String(ratio) + "%";
    return [
      '<article class="pool-card" data-pool-state="' + (isFull ? "full" : usedCount > 0 ? "busy" : "idle") + '">',
      '<div class="pool-card-head">',
      "<div><h4 class=\"pool-card-name\">AI 任务池</h4>",
      '<p class="pool-card-note">短请求建 job 会先进入这里；如果返回 ai-job-store-full，说明任务池已满，不等于模型上游并发已满。</p></div>',
      '<span class="pool-card-status">' + escapeHtml(statusText) + "</span>",
      "</div>",
      '<div class="pool-progress"><div class="pool-progress-bar" style="width:' + escapeHtml(String(ratio)) + '%"></div></div>',
      '<div class="pool-progress-meta"><strong>' + escapeHtml(String(ratio)) + '%</strong><span>已使用 ' + escapeHtml(formatNumber(usedCount)) + ' / ' + escapeHtml(formatNumber(capacity)) + "</span></div>",
      '<div class="pool-stat-grid">',
      '<div class="pool-stat"><span class="pool-stat-label">总占用</span><strong>' + escapeHtml(formatNumber(usedCount)) + " 个</strong></div>",
      '<div class="pool-stat"><span class="pool-stat-label">运行中</span><strong>' + escapeHtml(formatNumber(runningCount)) + " 个</strong></div>",
      '<div class="pool-stat"><span class="pool-stat-label">待启动</span><strong>' + escapeHtml(formatNumber(pendingCount)) + " 个</strong></div>",
      '<div class="pool-stat"><span class="pool-stat-label">已保留成功</span><strong>' + escapeHtml(formatNumber(succeededCount)) + " 个</strong></div>",
      '<div class="pool-stat"><span class="pool-stat-label">已保留失败</span><strong>' + escapeHtml(formatNumber(failedCount)) + " 个</strong></div>",
      '<div class="pool-stat"><span class="pool-stat-label">池容量</span><strong>' + escapeHtml(formatNumber(capacity)) + " 个</strong></div>",
      '<div class="pool-stat"><span class="pool-stat-label">剩余可接收</span><strong>' + escapeHtml(formatNumber(availableCount)) + " 个</strong></div>",
      "</div>",
      "</article>",
    ].join("");
  }

  function buildPoolChartMarkup(pools, jobs) {
    const rows = Array.isArray(pools) ? pools : [];
    const taskStoreCard = buildTaskStorePoolCardMarkup(jobs);
    if (rows.length <= 0 && !taskStoreCard) {
      return buildEmptyState("当前没有活跃模型池。");
    }
    return [
      '<div class="pool-card-grid">',
      taskStoreCard,
      rows
      .map(function (pool, index) {
        const ratio = Math.max(0, Math.min(100, Number(pool.utilizationPercent || 0)));
        const capacity = Number(pool.capacity || pool.totalCapacity || 0) || 0;
        const activeCount = Number(pool.activeCount || 0) || 0;
        const pendingCount = Number(pool.pendingCount || 0) || 0;
        const usedCount = Number(pool.usedCount || activeCount + pendingCount) || 0;
        const availableCount = Math.max(0, Number(pool.availableCount || capacity - usedCount) || 0);
        const statusText = pool.isFull
          ? "后端池已满"
          : usedCount <= 0
            ? "当前空闲"
            : "总占用 " + String(ratio) + "%";
        return [
          '<article class="pool-card" data-pool-state="' + (pool.isFull ? "full" : usedCount > 0 ? "busy" : "idle") + '">',
          '<div class="pool-card-head">',
          '<div><h4 class="pool-card-name">' + escapeHtml(pool.displayName || pool.groupName || "unknown") + "</h4>",
          '<p class="pool-card-note">总占用 = 正在调用上游 + 等待发起；后端按顺序排队，每 50ms 发起 1 个请求。</p></div>',
          '<span class="pool-card-status">' + escapeHtml(statusText) + "</span>",
          "</div>",
          '<div class="pool-progress"><div class="pool-progress-bar" style="width:' + escapeHtml(String(ratio)) + '%"></div></div>',
          '<div class="pool-progress-meta"><strong>' + escapeHtml(String(ratio)) + '%</strong><span>已使用 ' + escapeHtml(formatNumber(usedCount)) + ' / ' + escapeHtml(formatNumber(capacity)) + "</span></div>",
          '<div class="pool-stat-grid">',
          '<div class="pool-stat"><span class="pool-stat-label">总占用</span><strong>' + escapeHtml(formatNumber(usedCount)) + " 个</strong></div>",
          '<div class="pool-stat"><span class="pool-stat-label">正在调用上游</span><strong>' + escapeHtml(formatNumber(activeCount)) + " 个</strong></div>",
          '<div class="pool-stat"><span class="pool-stat-label">等待发起</span><strong>' + escapeHtml(formatNumber(pendingCount)) + " 个</strong></div>",
          '<div class="pool-stat"><span class="pool-stat-label">池容量</span><strong>' + escapeHtml(formatNumber(capacity)) + " 个</strong></div>",
          '<div class="pool-stat"><span class="pool-stat-label">剩余可接收</span><strong>' + escapeHtml(formatNumber(availableCount)) + " 个</strong></div>",
          "</div>",
          "</article>",
        ].join("");
      })
      .join(""),
      "</div>",
    ].join("");
  }

  function getRuntimeLogLevelText(level) {
    const normalizedLevel = normalizeText(level).toLowerCase();
    if (normalizedLevel === "success") {
      return "成功";
    }
    if (normalizedLevel === "warn") {
      return "警告";
    }
    if (normalizedLevel === "error") {
      return "失败";
    }
    return "信息";
  }

  function getRuntimeLogLevelPillClass(level) {
    const normalizedLevel = normalizeText(level).toLowerCase();
    if (normalizedLevel === "success") {
      return "enabled";
    }
    if (normalizedLevel === "warn") {
      return "pending";
    }
    if (normalizedLevel === "error") {
      return "disabled";
    }
    return "info";
  }

  function buildAdminLogSummaryMarkup(logsSummary) {
    const summary = logsSummary && typeof logsSummary === "object" ? logsSummary : {};
    const recent24Hours =
      summary.recent24Hours && typeof summary.recent24Hours === "object"
        ? summary.recent24Hours
        : {};
    const latestFailure =
      summary.latestFailure && typeof summary.latestFailure === "object"
        ? summary.latestFailure
        : null;
    return [
      '<article class="public-summary-card"><span>最近 24 小时成功</span><strong>' +
        escapeHtml(formatNumber(recent24Hours.successCount || 0)) +
        '</strong><span class="summary-note">已写入文件的成功事件数量。</span></article>',
      '<article class="public-summary-card"><span>最近 24 小时警告</span><strong>' +
        escapeHtml(formatNumber(recent24Hours.warnCount || 0)) +
        '</strong><span class="summary-note">需要人工关注但未中断流程的事件。</span></article>',
      '<article class="public-summary-card"><span>最近 24 小时失败</span><strong>' +
        escapeHtml(formatNumber(recent24Hours.errorCount || 0)) +
        '</strong><span class="summary-note">接口失败、鉴权失败和下载失败等错误事件。</span></article>',
      '<article class="public-summary-card admin-log-highlight"><span>最近一条失败</span><strong>' +
        escapeHtml(latestFailure ? getRuntimeLogLevelText(latestFailure.level) : "无") +
        '</strong><span class="summary-note">' +
        escapeHtml(
          latestFailure
            ? formatDateTimeLabel(latestFailure.createdAt) +
                " · " +
                normalizeText(latestFailure.scope || "backend") +
                " · " +
                normalizeText(latestFailure.message || "运行失败")
            : "近 7 天内暂未记录失败或警告事件。"
        ) +
        "</span></article>",
    ].join("");
  }

  function buildAdminRuntimeLogsMarkup(runtimeLogs) {
    const payload = runtimeLogs && typeof runtimeLogs === "object" ? runtimeLogs : {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (normalizeText(payload.errorMessage)) {
      return buildEmptyState(payload.errorMessage);
    }
    if (items.length <= 0) {
      return buildEmptyState("近 7 天内暂无可展示的后台运行日志。");
    }
    return [
      '<div class="admin-runtime-log-list">',
      items
        .map(function (item) {
          const level = normalizeText(item?.level).toLowerCase() || "info";
          const scope = normalizeText(item?.scope) || "backend";
          const action = normalizeText(item?.action);
          const message = normalizeText(item?.message) || "运行事件";
          const requestId = normalizeText(item?.requestId);
          return [
            '<article class="admin-runtime-log-item" data-log-level="' + escapeHtml(level) + '">',
            '<div class="admin-runtime-log-head">',
            '<div class="admin-runtime-log-tags">',
            '<span class="pill ' +
              escapeHtml(getRuntimeLogLevelPillClass(level)) +
              '">' +
              escapeHtml(getRuntimeLogLevelText(level)) +
              "</span>",
            "<strong>" + escapeHtml(scope) + "</strong>",
            action ? '<span class="admin-runtime-log-action">' + escapeHtml(action) + "</span>" : "",
            "</div>",
            "<time>" + escapeHtml(formatDateTimeLabel(item?.createdAt)) + "</time>",
            "</div>",
            '<p class="admin-runtime-log-message">' + escapeHtml(message) + "</p>",
            requestId
              ? '<div class="admin-runtime-log-meta">requestId: ' + escapeHtml(requestId) + "</div>"
              : "",
            "</article>",
          ].join("");
        })
        .join(""),
      "</div>",
    ].join("");
  }

  function renderAdminDownloadSummary(data) {
    const node = getElement("admin-download-summary");
    if (!node) {
      return;
    }
    const downloads = data?.downloads && typeof data.downloads === "object" ? data.downloads : {};
    const projectCount = Array.isArray(downloads.projectDataDatasets)
      ? downloads.projectDataDatasets.length
      : 0;
    const aiCount = Array.isArray(downloads.aiCallLogDatasets)
      ? downloads.aiCallLogDatasets.length
      : 0;
    node.innerHTML = [
      '<article class="public-summary-card"><span class="summary-label">项目数据类型</span><strong>' +
        formatNumber(projectCount) +
        '</strong><span class="summary-note">按数据集类型导出标注项目数据，必要时可继续按供应商筛选。</span></article>',
      '<article class="public-summary-card"><span class="summary-label">AI 日志类型</span><strong>' +
        formatNumber(aiCount) +
        '</strong><span class="summary-note">按脚本类型和日期范围导出 AI 请求记录，便于排查和复盘。</span></article>',
      '<article class="public-summary-card"><span class="summary-label">导出说明</span><strong>仅后台可用</strong><span class="summary-note">扩展版本下载已经移到公开脚本下载中心，这里只保留导出能力。</span></article>',
    ].join("");
  }

  function getAdminDownloadCenterSelectedRelease(releases) {
    const items = Array.isArray(releases?.items) ? releases.items : [];
    if (items.length <= 0) {
      return null;
    }
    const matched = items.find(function (item) {
      return normalizeText(item?.version) === normalizeText(adminSelectedReleaseVersion);
    });
    return matched || items[0];
  }

  function buildAdminReleaseDownloadButtons(item, source) {
    const release = item && typeof item === "object" ? item : null;
    if (!release || !normalizeText(release.crxUrl)) {
      return buildEmptyState("当前未读取到可用 CRX 下载地址，请稍后重试。");
    }
    return [
      '<div class="download-release-actions">',
      '<button type="button" class="primary-button" data-release-download-url="' +
        escapeHtml(release.crxUrl) +
        '">下载 CRX</button>',
      normalizeText(release.zipUrl)
        ? '<button type="button" class="secondary-button" data-release-download-url="' +
          escapeHtml(release.zipUrl) +
          '">下载 ZIP</button>'
        : "",
      '<button type="button" class="ghost-button" data-release-download-url="' +
        escapeHtml(normalizeText(source?.directoryIndexUrl) || getCurrentDownloadCenterUrl(currentSettings || {})) +
        '">查看外部目录</button>',
      "</div>",
    ].join("");
  }

  function renderPublicDownloadSummary(releases) {
    const panel = getElement("public-download-summary");
    if (!(panel instanceof HTMLElement)) {
      return;
    }
    const data = releases && typeof releases === "object" ? releases : {};
    const items = Array.isArray(data.items) ? data.items : [];
    const latestItem =
      items.find(function (item) {
        return item?.isLatest === true;
      }) || items[0] || null;
    const historyCount = Math.max(0, items.length - (latestItem ? 1 : 0));
    panel.innerHTML = [
      '<article class="public-summary-card"><span class="summary-label">推荐版本</span><strong>' +
        escapeHtml(latestItem ? "v" + normalizeText(latestItem.version) : "读取中") +
        '</strong><span class="summary-note">默认推荐最新版 CRX，适合直接安装或覆盖更新。</span></article>',
      '<article class="public-summary-card"><span class="summary-label">历史版本</span><strong>' +
        formatNumber(historyCount) +
        '</strong><span class="summary-note">如需回退或保留旧版本，可从下拉框切换到历史版本。</span></article>',
      '<article class="public-summary-card"><span class="summary-label">下载方式</span><strong>CRX / ZIP</strong><span class="summary-note">CRX 为主下载格式；若该版本提供 ZIP，也会同步显示辅助下载按钮。</span></article>',
    ].join("");
  }

  function renderPublicDownloadCenterPanel(releases) {
    const panel = getElement("public-script-release-panel");
    if (!(panel instanceof HTMLElement)) {
      return;
    }
    const data = releases && typeof releases === "object" ? releases : {};
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length <= 0) {
      panel.innerHTML = [
        '<div class="admin-card-head"><strong>扩展版本下载</strong><span>默认展示最新版，历史版本可通过下拉框切换。</span></div>',
        buildEmptyState("正在读取版本列表；如果持续为空，请稍后手动刷新或直接打开外部目录。"),
      ].join("");
      return;
    }
    const selected = getAdminDownloadCenterSelectedRelease(data) || items[0];
    adminSelectedReleaseVersion = normalizeText(selected?.version) || normalizeText(data.latestVersion);
    const latestItem =
      items.find(function (item) {
        return item?.isLatest === true;
      }) || items[0];
    panel.innerHTML = [
      '<div class="admin-card-head"><strong>扩展版本下载</strong><span>默认推荐最新版，历史版本可通过下拉框切换。</span></div>',
      '<div class="download-release-layout">',
      '<article class="download-release-highlight">',
      '<span class="summary-label">当前可分发最新版</span>',
      "<strong>v" + escapeHtml(normalizeText(latestItem.version) || "未知版本") + "</strong>",
      '<span class="summary-note">发布时间：' + escapeHtml(formatDateTimeLabel(latestItem.createdAt)) + "</span>",
      '<p class="workspace-side-copy">优先下载最新版 CRX；如需历史构建或保留开发者模式解压包，可切换到历史版本并按需下载 ZIP。</p>',
      "</article>",
      '<div class="download-release-selector">',
      '<label class="project-download-row" for="public-release-version-select">',
      "<span>选择下载版本</span>",
      '<select id="public-release-version-select">',
      items
        .map(function (item) {
          const version = normalizeText(item?.version);
          return (
            '<option value="' +
            escapeHtml(version) +
            '"' +
            (version === adminSelectedReleaseVersion ? " selected" : "") +
            ">" +
            escapeHtml("v" + version + (item?.isLatest ? "（最新版）" : "")) +
            "</option>"
          );
        })
        .join(""),
      "</select>",
      "</label>",
      '<div class="download-release-current">',
      '<div class="admin-runtime-list">',
      "<div><strong>当前选择</strong><span>" + escapeHtml("v" + normalizeText(selected.version)) + "</span></div>",
      "<div><strong>可下载格式</strong><span>" + escapeHtml(normalizeText(selected.zipUrl) ? "CRX / ZIP" : "仅 CRX") + "</span></div>",
      "<div><strong>版本时间</strong><span>" + escapeHtml(formatDateTimeLabel(selected.createdAt)) + "</span></div>",
      "</div>",
      buildAdminReleaseDownloadButtons(selected, data.source || {}),
      (data.source?.usedFallback === true
        ? '<div class="status-text" data-tone="warning">目录索引暂不可用，当前已回退为仅展示最新版：' +
          escapeHtml(normalizeText(data.source?.fallbackReason) || "未知原因") +
          "</div>"
        : '<div class="status-text">如最新版本暂未出现，请稍后刷新，或通过外部目录确认服务器分发目录是否已经更新。</div>') +
      "</div>",
      "</div>",
      "</div>",
    ].join("");
  }

  async function loadAdminDownloadCenterReleases(forceRefresh) {
    if (adminDownloadCenterReleasesCache && forceRefresh !== true) {
      renderPublicDownloadSummary(adminDownloadCenterReleasesCache);
      renderPublicDownloadCenterPanel(adminDownloadCenterReleasesCache);
      return adminDownloadCenterReleasesCache;
    }
    if (adminDownloadCenterReleasesLoading) {
      return adminDownloadCenterReleasesLoading;
    }
    adminDownloadCenterReleasesLoading = fetch(buildBackendUrl(adminDownloadCenterReleasesPath, currentSettings || {}), {
      method: "GET",
      cache: "no-store",
    })
      .then(async function (response) {
        const body = parseJsonSafely(await response.text());
        if (!response.ok || body?.success !== true) {
          renderPublicDownloadSummary(null);
          renderPublicDownloadCenterPanel(null);
          return null;
        }
        adminDownloadCenterReleasesCache = Object.assign({}, body.data || {});
        renderPublicDownloadSummary(adminDownloadCenterReleasesCache);
        renderPublicDownloadCenterPanel(adminDownloadCenterReleasesCache);
        return adminDownloadCenterReleasesCache;
      })
      .finally(function () {
        adminDownloadCenterReleasesLoading = null;
      });
    return adminDownloadCenterReleasesLoading;
  }

  function renderAdminBackendSummary(data) {
    const node = getElement("admin-backend-runtime");
    if (!node) {
      return;
    }
    const draft = ensureAdminBackendDraft(currentSettings || {});
    const draftDirty = isAdminBackendDraftDirty(currentSettings || {});
    const runtime = data?.runtime && typeof data.runtime === "object" ? data.runtime : {};
    const queue = runtime.queue && typeof runtime.queue === "object" ? runtime.queue : {};
    const backend = data?.backend && typeof data.backend === "object" ? data.backend : {};
    const savedOperatorName = getAiUsageOperatorName(currentSettings || {}) || "未设置";
    const draftOperatorName = normalizeAiUsageOperatorName(draft.aiUsageOperatorName) || "未设置";
    node.innerHTML = [
      '<div class="admin-runtime-list">',
      '<div><strong>当前生效后端</strong><span>' + escapeHtml(buildBackendModeDisplayText(getBackendModeFromSettings(currentSettings || {}), currentSettings || {})) + "</span></div>",
      '<div><strong>AI 调用使用人</strong><span>' + escapeHtml(savedOperatorName) + "</span></div>",
      '<div><strong>草稿状态</strong><span>' + escapeHtml(draftDirty ? "有未保存改动" : "与当前缓存一致") + "</span></div>",
      draftDirty
        ? '<div><strong>草稿预览</strong><span>' +
          escapeHtml(buildBackendModeDisplayText(draft.backendEndpointMode, draft)) +
          " / " +
          escapeHtml(draftOperatorName) +
          "</span></div>"
        : "",
      '<div><strong>管理员鉴权</strong><span>' + escapeHtml(backend.adminAuthConfigured ? "已配置" : "未配置") + "</span></div>",
      '<div><strong>会话有效期</strong><span>' + escapeHtml(String(backend.sessionTtlSeconds || 0)) + " 秒</span></div>",
      '<div><strong>模型池策略</strong><span>' + escapeHtml(queue.keyStrategy || "concrete-model-name") + "</span></div>",
      '<div><strong>活跃模型池</strong><span>' + escapeHtml(formatNumber(queue.activePools?.length || 0)) + "</span></div>",
      '<div><strong>任务池</strong><span>已使用 ' + escapeHtml(formatNumber(runtime.jobs?.usedCount || 0)) + " / " + escapeHtml(formatNumber(runtime.jobs?.capacity || runtime.jobs?.maxSize || 0)) + "</span></div>",
      '<div><strong>任务池明细</strong><span>运行中 ' + escapeHtml(formatNumber(runtime.jobs?.runningCount || runtime.jobs?.activeCount || 0)) + " / 待启动 " + escapeHtml(formatNumber(runtime.jobs?.pendingCount || 0)) + " / 已保留成功 " + escapeHtml(formatNumber(runtime.jobs?.succeededCount || 0)) + "</span></div>",
      "</div>",
    ].join("");
  }

  function renderAdminDashboard(data) {
    const overview = data && typeof data === "object" ? data : null;
    if (!overview) {
      return;
    }
    const queue = overview.runtime?.queue || {};
    const logsSummary = overview.logsSummary && typeof overview.logsSummary === "object"
      ? overview.logsSummary
      : {};
    const runtimeLogs = overview.runtimeLogs && typeof overview.runtimeLogs === "object"
      ? overview.runtimeLogs
      : {};
    const poolsNode = getElement("admin-overview-pools");
    if (poolsNode) {
      poolsNode.innerHTML = buildPoolChartMarkup(queue.activePools || [], overview.runtime?.jobs || {});
    }
    const logSummaryNode = getElement("admin-overview-log-summary");
    if (logSummaryNode) {
      logSummaryNode.innerHTML = buildAdminLogSummaryMarkup(logsSummary);
    }
    const logSummaryNoteNode = getElement("admin-overview-log-summary-note");
    if (logSummaryNoteNode) {
      logSummaryNoteNode.textContent =
        "最近 24 小时汇总，文件日志保留 " +
        String(Number(logsSummary.retentionDays || runtimeLogs.retentionDays || 7) || 7) +
        " 天";
    }
    const runtimeLogsNode = getElement("admin-overview-runtime-logs");
    if (runtimeLogsNode) {
      runtimeLogsNode.innerHTML = buildAdminRuntimeLogsMarkup(runtimeLogs);
    }
    const runtimeLogsNoteNode = getElement("admin-overview-runtime-logs-note");
    if (runtimeLogsNoteNode) {
      runtimeLogsNoteNode.textContent = normalizeText(runtimeLogs.errorMessage)
        ? "最近运行日志加载失败，请稍后手动刷新。"
        : "默认显示近 " +
          String(Number(runtimeLogs.limit || 20) || 20) +
          " 条后台运行日志，文件日志保留 " +
          String(Number(runtimeLogs.retentionDays || logsSummary.retentionDays || 7) || 7) +
          " 天";
    }
    const endpointNode = getElement("admin-stage-endpoint");
    if (endpointNode) {
      const currentMode = getBackendModeFromSettings(currentSettings || {});
      endpointNode.textContent =
        "当前后端入口：" +
        buildBackendModeDisplayText(currentMode, currentSettings || {});
    }
    renderAdminBackendSummary(overview);
    renderAdminDownloadSummary(overview);
  }

  async function loadAdminDashboard(forceRefresh, refreshSource) {
    if (!hasActiveAdminSession()) {
      return null;
    }
    if (adminDashboardCache && forceRefresh !== true) {
      return adminDashboardCache;
    }
    if (adminDashboardLoading) {
      return adminDashboardLoading;
    }
    const dashboardRefreshSource =
      normalizeText(refreshSource) || (forceRefresh === true ? "manual" : "initial");
    setAdminPanelStatus("admin-overview-status", "正在加载系统仪表盘...");
    adminDashboardLoading = Promise.all([
      requestAdminJson(adminDashboardOverviewPath, {
        method: "GET",
        headers: {
          "X-ASC-Dashboard-Refresh": dashboardRefreshSource,
        },
      }),
      requestAdminJson(adminDashboardRuntimeLogsPath + "?limit=20", {
        method: "GET",
        headers: {
          "X-ASC-Dashboard-Refresh": dashboardRefreshSource,
        },
      }),
    ])
      .then(async function (results) {
        const overviewResult = Array.isArray(results) ? results[0] : null;
        const runtimeLogsResult = Array.isArray(results) ? results[1] : null;
        if (!overviewResult || overviewResult.authFailed || !runtimeLogsResult || runtimeLogsResult.authFailed) {
          return null;
        }
        if (!overviewResult.response.ok || overviewResult.body?.success !== true) {
          setAdminPanelStatus(
            "admin-overview-status",
            getAdminDashboardErrorMessage(overviewResult.body, overviewResult.response.status)
          );
          return null;
        }
        const runtimeLogsData =
          runtimeLogsResult.response?.ok && runtimeLogsResult.body?.success === true
            ? Object.assign({}, runtimeLogsResult.body.data || {})
            : {
                items: [],
                limit: 20,
                retentionDays:
                  Number(overviewResult.body?.data?.logsSummary?.retentionDays || 7) || 7,
                errorMessage: getAdminDashboardErrorMessage(
                  runtimeLogsResult.body,
                  runtimeLogsResult.response?.status
                ),
              };
        adminDashboardCache = Object.assign({}, overviewResult.body.data || {}, {
          runtimeLogs: runtimeLogsData,
        });
        renderAdminDashboard(adminDashboardCache);
        setAdminPanelStatus(
          "admin-overview-status",
          "系统仪表盘已更新：" +
            normalizeText(adminDashboardCache?.generatedAt || "") +
            "；日志保留 " +
            String(
              Number(
                adminDashboardCache?.runtimeLogs?.retentionDays ||
                  adminDashboardCache?.logsSummary?.retentionDays ||
                  7
              ) || 7
            ) +
            " 天；60 秒自动刷新已启用。"
        );
        return adminDashboardCache;
      })
      .finally(function () {
        adminDashboardLoading = null;
      });
    return adminDashboardLoading;
  }

  async function handleAdminUnlock() {
    const passwordInput = getElement("admin-password-input");
    const rememberInput = getElement("admin-remember-session");
    if (!(passwordInput instanceof HTMLInputElement)) {
      return;
    }
    const password = normalizeText(passwordInput.value);
    if (!password) {
      setAdminAuthStatus("请输入管理员密码。", "error");
      passwordInput.focus();
      return;
    }
    setAdminAuthStatus("正在校验管理员密码...", "pending");
    try {
      const response = await fetch(buildBackendUrl(adminSessionUnlockPath, currentSettings || {}), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: password,
          operatorName: getAiUsageOperatorName(currentSettings || {}),
        }),
      });
      const body = parseJsonSafely(await response.text());
      if (!response.ok || body?.success !== true) {
        setAdminAuthStatus(getAdminAuthErrorMessage(body, response.status), "error");
        return;
      }
      await persistAdminSession(body?.data || {}, rememberInput instanceof HTMLInputElement && rememberInput.checked === true);
      adminAuthMessage = "";
      passwordInput.value = "";
      setAdminAuthStatus("验证成功，正在进入系统管理。", "success");
      adminDashboardCache = null;
      navigateToAdmin(getCurrentAdminTab());
    } catch (error) {
      setAdminAuthStatus(
        "登录失败：" + (error && error.message ? error.message : String(error)),
        "error"
      );
    }
  }

  async function handleAdminLogout() {
    adminAuthMessage = "已退出系统管理登录。";
    await clearAdminSession({
      keepStatus: true,
    });
    renderCurrentView();
  }

  function renderPublicDownloadsView() {
    renderPublicDownloadSummary(adminDownloadCenterReleasesCache || {});
    renderPublicDownloadCenterPanel(adminDownloadCenterReleasesCache || {});
    void loadAdminDownloadCenterReleases(false);
  }

  function renderAdminWorkspace(tab) {
    ensureAdminWorkspace();
    const workspace = getElement("admin-workspace");
    const authGate = getElement("admin-auth-gate");
    const content = getElement("admin-content");
    if (!(workspace instanceof HTMLElement) || !(authGate instanceof HTMLElement) || !(content instanceof HTMLElement)) {
      return;
    }
    workspace.classList.remove("hidden");
    const currentTab = adminTabs.indexOf(String(tab || "").trim()) >= 0 ? String(tab).trim() : "overview";
    Array.from(workspace.querySelectorAll("[data-admin-tab]")).forEach(function (button) {
      const matches = button.getAttribute("data-admin-tab") === currentTab;
      button.classList.toggle("active", matches);
      button.setAttribute("aria-pressed", String(matches));
    });
    adminTabs.forEach(function (tabKey) {
      const panel = getElement("admin-tab-" + tabKey);
      if (panel) {
        panel.classList.toggle("hidden", tabKey !== currentTab);
      }
    });

    const unlocked = hasActiveAdminSession();
    endpointAdvancedUnlocked = unlocked;
    authGate.classList.toggle("hidden", unlocked);
    content.classList.toggle("hidden", !unlocked);
    renderHomeBackendEndpoint(currentSettings || {});
    renderHomeAiUsageOperator(currentSettings || {});
    renderAdminBackendSummary(adminDashboardCache || {});
    renderProjectDataDownloadPanel(currentSettings || {});
    renderAiCallLogPanel(currentSettings || {});
    if (unlocked) {
      unlockEndpointAdvancedPanel();
      if (adminAuthMessage) {
        setAdminAuthStatus(adminAuthMessage, "warning");
      } else {
        setAdminAuthStatus("管理员会话有效，可直接切换各功能页。", "success");
      }
      startAdminDashboardAutoRefresh();
      void loadAdminDashboard(false, "initial");
    } else {
      stopAdminDashboardAutoRefresh();
      setAdminAuthStatus(adminAuthMessage || "进入系统管理前需要输入密码。", adminAuthMessage ? "warning" : "neutral");
    }
  }

  function renderProjectDataDownloadPanel(settings) {
    const panel = getElement("project-data-download-panel");
    const operatorInput = getElement("project-download-operator");
    if (panel) {
      panel.classList.toggle("hidden", endpointAdvancedUnlocked !== true);
    }
    if (operatorInput instanceof HTMLInputElement) {
      operatorInput.value = getProjectDataDownloadOperatorName(settings || {});
    }
    updateProjectDataDownloadSupplierVisibility();
  }

  function renderAiCallLogPanel(settings) {
    const panel = getElement("ai-call-log-download-panel");
    const operatorInput = getElement("ai-call-log-operator");
    if (panel) {
      panel.classList.toggle("hidden", endpointAdvancedUnlocked !== true);
    }
    if (operatorInput instanceof HTMLInputElement) {
      operatorInput.value = getAiCallLogOperatorName(settings || {});
    }
    updateAiCallLogDateInputs({ silent: true });
  }

  async function handleProjectDataDownloadExport() {
    const operatorInput = getElement("project-download-operator");
    const datasetSelect = getElement("project-download-dataset");
    const supplierSelect = getElement("project-download-supplier");
    if (
      !(operatorInput instanceof HTMLInputElement) ||
      !(datasetSelect instanceof HTMLSelectElement) ||
      !(supplierSelect instanceof HTMLSelectElement)
    ) {
      return;
    }

    const operatorName = normalizeText(operatorInput.value);
    if (!operatorName) {
      setProjectDataDownloadStatus("请先填写获取人姓名。");
      operatorInput.focus();
      return;
    }

    const datasetId = normalizeText(datasetSelect.value);
    const datasetInfo = getProjectDataDownloadDatasetById(datasetId);
    if (!datasetId || !datasetInfo) {
      setProjectDataDownloadStatus("请先选择数据类型。");
      datasetSelect.focus();
      return;
    }

    const supplier = normalizeText(supplierSelect.value);
    if (!isProjectDownloadSupplierSelectionValid(datasetInfo, supplier)) {
      setProjectDataDownloadStatus("该数据类型需要先选择供应商。");
      supplierSelect.focus();
      return;
    }

    if (!hasActiveAdminSession()) {
      adminAuthMessage = "管理员会话已失效，请重新输入密码后再导出。";
      setProjectDataDownloadStatus(adminAuthMessage);
      navigateToAdmin("exports");
      return;
    }

    setProjectDataDownloadStatus("正在申请短期下载链接...");
    try {
      await persistProjectDataDownloadOperatorName(operatorName);
      const result = await requestAdminJson(projectDataDownloadRequestPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataset: datasetId,
          supplier: isAllProjectDownloadSuppliersValue(supplier) ? "__all__" : supplier,
          operatorName: operatorName,
          clientInfo: getDownloadClientInfo(),
        }),
      });
      if (!result || result.authFailed) {
        setProjectDataDownloadStatus(adminAuthMessage || "管理员会话已失效，请重新登录后再导出。");
        navigateToAdmin("exports");
        return;
      }
      if (!result.response.ok || result.body?.success !== true) {
        setProjectDataDownloadStatus(
          getProjectDataDownloadErrorMessage(result.body, result.response.status)
        );
        return;
      }

      const downloadUrl = normalizeText(result.body?.data?.downloadUrl);
      if (!downloadUrl) {
        setProjectDataDownloadStatus("后端未返回下载链接，请重试。");
        return;
      }
      triggerDownloadLink(downloadUrl);

      const expiresInSeconds = Number(result.body?.data?.expiresInSeconds || 0);
      if (expiresInSeconds > 0) {
        setProjectDataDownloadStatus("下载链接已生成（" + String(expiresInSeconds) + " 秒内有效）。");
      } else {
        setProjectDataDownloadStatus("下载链接已生成。");
      }
    } catch (error) {
      setProjectDataDownloadStatus(
        "申请下载失败：" + (error && error.message ? error.message : String(error))
      );
    }
  }

  async function handleAiCallLogExport() {
    const operatorInput = getElement("ai-call-log-operator");
    const datasetSelect = getElement("ai-call-log-dataset");
    const dateFromInput = getElement("ai-call-log-date-from");
    const dateToInput = getElement("ai-call-log-date-to");
    if (
      !(operatorInput instanceof HTMLInputElement) ||
      !(datasetSelect instanceof HTMLSelectElement) ||
      !(dateFromInput instanceof HTMLInputElement) ||
      !(dateToInput instanceof HTMLInputElement)
    ) {
      return;
    }

    const operatorName = normalizeText(operatorInput.value).slice(0, 60);
    if (!operatorName) {
      setAiCallLogStatus("请先填写获取人姓名。");
      operatorInput.focus();
      return;
    }

    const datasetId = normalizeText(datasetSelect.value);
    const datasetInfo = getAiCallLogDatasetById(datasetId);
    if (!datasetId || !datasetInfo) {
      setAiCallLogStatus("请先选择脚本类型。");
      datasetSelect.focus();
      return;
    }
    if (datasetInfo.hasData === false) {
      setAiCallLogStatus("当前脚本暂无 AI 请求记录。");
      return;
    }

    const dateFrom = normalizeDateText(dateFromInput.value);
    const dateTo = normalizeDateText(dateToInput.value);
    if (dateFrom > dateTo) {
      setAiCallLogStatus("开始日期不能晚于结束日期。");
      return;
    }

    if (!hasActiveAdminSession()) {
      adminAuthMessage = "管理员会话已失效，请重新输入密码后再导出。";
      setAiCallLogStatus(adminAuthMessage);
      navigateToAdmin("exports");
      return;
    }

    setAiCallLogStatus("正在申请 AI 请求记录下载链接...");
    try {
      await persistAiCallLogOperatorName(operatorName);
      const result = await requestAdminJson(aiCallLogDownloadRequestPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operatorName: operatorName,
          dataset: datasetId,
          dateFrom: dateFrom,
          dateTo: dateTo,
          clientInfo: getDownloadClientInfo(),
        }),
      });
      if (!result || result.authFailed) {
        setAiCallLogStatus(adminAuthMessage || "管理员会话已失效，请重新登录后再导出。");
        navigateToAdmin("exports");
        return;
      }
      if (!result.response.ok || result.body?.success !== true) {
        setAiCallLogStatus(getAiCallLogErrorMessage(result.body, result.response.status));
        return;
      }

      const downloadUrl = normalizeText(result.body?.data?.downloadUrl);
      if (!downloadUrl) {
        setAiCallLogStatus("后端未返回下载链接，请重试。");
        return;
      }

      triggerDownloadLink(downloadUrl);
      const expiresInSeconds = Number(result.body?.data?.expiresInSeconds || 0);
      if (expiresInSeconds > 0) {
        setAiCallLogStatus(
          "下载链接已生成（" + String(expiresInSeconds) + " 秒内有效）。"
        );
      } else {
        setAiCallLogStatus("下载链接已生成。");
      }
    } catch (error) {
      setAiCallLogStatus(
        "申请下载失败：" + (error && error.message ? error.message : String(error))
      );
    }
  }

  function renderDetailHeader(settings, scriptId) {
    const script = scriptLibrary[scriptId] || {};
    const platform = platformLibrary[script.platformId] || {};
    const status = getScriptStatus(settings, scriptId);

    getElement("detail-script-name").textContent = script.label || scriptId;
    getElement("detail-script-description").textContent = script.description || "";
    getElement("detail-script-note").textContent =
      script.note ||
      (isLabelxScript(scriptId)
        ? "同平台脚本互斥：启用这个脚本后，另一个 LabelX 脚本会自动切换为非生效状态。"
        : isBytedanceAidpScript(scriptId)
          ? "同平台脚本互斥：启用这个脚本后，另一个 ByteDance AIDP 脚本会自动切换为非生效状态。"
        : "当前脚本属于独立平台。");

    const statusNode = getElement("detail-script-status");
    statusNode.textContent = status.text;
    statusNode.className = "pill " + status.tone;

    const platformNode = getElement("detail-platform-pill");
    platformNode.textContent = String(platform.label || script.platformId || "未知平台");

    const enableButton = getElement("detail-enable-button");
    const disableButton = getElement("detail-disable-button");
    const toggleButton = getElement("detail-toggle-button");
    const saveButton = getElement("save-bytedance-aidp-settings");
    const enabled = isScriptEnabled(settings, scriptId);
    const isBytedanceAidpDetail = isBytedanceAidpScript(scriptId);

    enableButton.disabled = enabled;
    disableButton.disabled = !enabled;
    enableButton.classList.toggle("hidden", isBytedanceAidpDetail);
    disableButton.classList.toggle("hidden", isBytedanceAidpDetail);
    if (toggleButton instanceof HTMLButtonElement) {
      toggleButton.classList.toggle("hidden", !isBytedanceAidpDetail);
      if (isBytedanceAidpDetail) {
        toggleButton.disabled = false;
        toggleButton.textContent = enabled ? "关闭脚本" : "启用脚本";
        toggleButton.classList.remove("primary-button", "danger-button");
        toggleButton.classList.add(enabled ? "danger-button" : "primary-button");
      } else {
        toggleButton.disabled = true;
        toggleButton.textContent = "启用脚本";
        toggleButton.classList.remove("danger-button");
        toggleButton.classList.add("primary-button");
      }
    }
    if (saveButton instanceof HTMLButtonElement) {
      saveButton.classList.toggle("hidden", !isBytedanceAidpDetail);
    }
  }

  function renderDetailSupportPanel(settings, scriptId) {
    const panel = getElement("detail-support-panel");
    if (!(panel instanceof HTMLElement)) {
      return;
    }
    panel.classList.remove("hidden");
    panel.innerHTML = "";
    panel.classList.add("hidden");
  }

  function getDetailShortcutPanelId(scriptId) {
    if (scriptId === transcriptionProjectId) {
      return "detail-transcription-shortcuts-panel";
    }
    if (scriptId === judgementProjectId) {
      return "detail-judgement-shortcuts-panel";
    }
    if (scriptId === dataBakerRoundOneQualityScriptId) {
      return "detail-data-baker-shortcuts-panel";
    }
    if (scriptId === dataBakerCvpcLiuzhouScriptId) {
      return "detail-data-baker-cvpc-shortcuts-panel";
    }
    if (isBytedanceAidpScript(scriptId)) {
      return "detail-bytedance-aidp-shortcuts-panel";
    }
    if (isAishellTechScript(scriptId)) {
      return "detail-aishell-tech-shortcuts-panel";
    }
    if (isMagicDataScript(scriptId)) {
      return "detail-magic-data-shortcuts-panel";
    }
    if (isAbakaAiScript(scriptId)) {
      return "detail-abaka-shortcuts-panel";
    }
    return "";
  }

  function showDetailShortcutPanel(scriptId) {
    const activePanelId = getDetailShortcutPanelId(scriptId);
    [
      "detail-transcription-shortcuts-panel",
      "detail-judgement-shortcuts-panel",
      "detail-data-baker-shortcuts-panel",
      "detail-data-baker-cvpc-shortcuts-panel",
      "detail-bytedance-aidp-shortcuts-panel",
      "detail-aishell-tech-shortcuts-panel",
      "detail-magic-data-shortcuts-panel",
      "detail-abaka-shortcuts-panel",
    ].forEach(function (panelId) {
      const panel = getElement(panelId);
      if (panel instanceof HTMLElement) {
        panel.classList.toggle("hidden", panelId !== activePanelId);
      }
    });
  }

  function ensureDetailWorkbenchTracks(workbench) {
    if (!(workbench instanceof HTMLElement)) {
      return {
        primaryTrack: null,
        secondaryTrack: null,
      };
    }

    let primaryTrack = workbench.querySelector(".detail-track.detail-track-primary");
    let secondaryTrack = workbench.querySelector(".detail-track.detail-track-secondary");

    if (!(primaryTrack instanceof HTMLElement)) {
      primaryTrack = document.createElement("div");
      primaryTrack.className = "detail-track detail-track-primary";
      workbench.insertBefore(primaryTrack, workbench.firstChild);
    }
    if (!(secondaryTrack instanceof HTMLElement)) {
      secondaryTrack = document.createElement("div");
      secondaryTrack.className = "detail-track detail-track-secondary";
      if (primaryTrack.nextSibling) {
        workbench.insertBefore(secondaryTrack, primaryTrack.nextSibling);
      } else {
        workbench.appendChild(secondaryTrack);
      }
    }

    return {
      primaryTrack,
      secondaryTrack,
    };
  }

  function updateDetailLayout(scriptId) {
    const workbench = document.querySelector("#script-detail-view .detail-workbench");
    const sharedAiPanel = getElement("detail-shared-asr-ai-panel");
    const abakaAiPanel = getElement("detail-abaka-ai-panel");
    const hasSharedAiPanel = supportsAsrVoiceAiSettings(scriptId);
    const hasAbakaAiPanel = isAbakaAiScript(scriptId);

    if (sharedAiPanel instanceof HTMLElement && !hasSharedAiPanel) {
      sharedAiPanel.classList.add("hidden");
      sharedAiPanel.innerHTML = "";
    }
    if (abakaAiPanel instanceof HTMLElement && !hasAbakaAiPanel) {
      abakaAiPanel.classList.add("hidden");
    }

    showDetailShortcutPanel(scriptId);

    if (workbench instanceof HTMLElement) {
      const hasVisibleBasePanel = Boolean(workbench.querySelector(".detail-panel-base:not(.hidden)"));
      const hasVisibleAiPanel = Boolean(workbench.querySelector(".detail-ai-panel:not(.hidden)"));
      const hasVisibleShortcutPanel = Boolean(
        workbench.querySelector(".detail-shortcut-panel:not(.hidden)")
      );
      const trackState = buildDetailWorkbenchTrackState({
        hasBasePanel: hasVisibleBasePanel,
        hasAiPanel: hasVisibleAiPanel,
        hasShortcutPanel: hasVisibleShortcutPanel,
      });
      const tracks = ensureDetailWorkbenchTracks(workbench);
      const panelMap = {
        base: workbench.querySelector(".detail-panel-base:not(.hidden)"),
        ai: workbench.querySelector(".detail-ai-panel:not(.hidden)"),
        shortcut: workbench.querySelector(".detail-shortcut-panel:not(.hidden)"),
      };

      trackState.primary.forEach(function (panelKind) {
        const panel = panelMap[panelKind];
        if (panel instanceof HTMLElement && tracks.primaryTrack instanceof HTMLElement) {
          tracks.primaryTrack.appendChild(panel);
        }
      });

      trackState.secondary.forEach(function (panelKind) {
        const panel = panelMap[panelKind];
        if (panel instanceof HTMLElement && tracks.secondaryTrack instanceof HTMLElement) {
          tracks.secondaryTrack.appendChild(panel);
        }
      });

      if (tracks.primaryTrack instanceof HTMLElement) {
        tracks.primaryTrack.classList.toggle("is-empty", trackState.primary.length === 0);
      }
      if (tracks.secondaryTrack instanceof HTMLElement) {
        tracks.secondaryTrack.classList.toggle("is-empty", trackState.secondary.length === 0);
      }

      workbench.dataset.panelCount = String(trackState.panelCount);
      workbench.dataset.layout = getDetailWorkbenchLayoutMode({
        hasBasePanel: hasVisibleBasePanel,
        hasAiPanel: hasVisibleAiPanel,
        hasShortcutPanel: hasVisibleShortcutPanel,
      });
      workbench.classList.toggle("is-single", trackState.isSingle);
      workbench.classList.toggle("has-secondary-track", trackState.secondary.length > 0);
    }
  }

  function showDetailPanel(scriptId) {
    getElement("detail-transcription-panel").classList.toggle("hidden", scriptId !== transcriptionProjectId);
    getElement("detail-judgement-panel").classList.toggle("hidden", scriptId !== judgementProjectId);
    getElement("detail-lightwheel-panel").classList.toggle("hidden", scriptId !== lightwheelScriptId);
    getElement("detail-data-baker-round-one-quality-panel").classList.toggle(
      "hidden",
      scriptId !== dataBakerRoundOneQualityScriptId
    );
    getElement("detail-data-baker-cvpc-liuzhou-panel").classList.toggle(
      "hidden",
      scriptId !== dataBakerCvpcLiuzhouScriptId
    );
    getElement("detail-bytedance-aidp-suzhou-panel").classList.toggle(
      "hidden",
      !isBytedanceAidpScript(scriptId)
    );
    getElement("detail-aishell-tech-minnan-helper-panel").classList.toggle(
      "hidden",
      scriptId !== aishellTechMinnanScriptId
    );
    getElement("detail-aishell-tech-vietnamese-helper-panel").classList.toggle(
      "hidden",
      scriptId !== aishellTechVietnameseScriptId
    );
    getElement("detail-aishell-tech-thai-helper-panel").classList.toggle(
      "hidden",
      scriptId !== aishellTechThaiScriptId
    );
    getElement("detail-aishell-tech-cantonese-helper-panel").classList.toggle(
      "hidden",
      scriptId !== aishellTechCantoneseScriptId
    );
    getElement("detail-jd-tts-shanghainese-helper-panel").classList.toggle(
      "hidden",
      scriptId !== jdTtsShanghaineseScriptId
    );
    getElement("detail-aishell-tech-cn-en-short-drama-panel").classList.toggle(
      "hidden",
      scriptId !== aishellTechCnEnShortDramaScriptId
    );
    getElement("detail-magic-data-annotator-panel").classList.toggle("hidden", !isMagicDataScript(scriptId));
    getElement("detail-abaka-ai-task-page-panel").classList.toggle(
      "hidden",
      scriptId !== abakaAiTaskPageCaptureScriptId
    );
    getElement("detail-haitian-utrans-audio-download-panel").classList.toggle(
      "hidden",
      scriptId !== haitianUtransAudioDownloadHelperScriptId
    );
  }

  function renderDetail(settings, scriptId) {
    closeOptionsCustomSelects(null);
    renderDetailHeader(settings, scriptId);
    showDetailPanel(scriptId);
    renderAsrVoiceAiSettingsSection(settings, scriptId);
    renderDetailSupportPanel(settings, scriptId);
    updateDetailLayout(scriptId);
    ensureInlineHelpDots(getElement("detail-view"));
    updateAsrVoiceAiDefaultsTip(scriptId, getAsrVoiceAiDefaultsCached(scriptId));
    if (supportsAsrVoiceAiSettings(scriptId)) {
      void loadAsrVoiceAiDefaults(scriptId, settings).then(function (payload) {
        if (getCurrentDetailScriptId() !== scriptId || !supportsAsrVoiceAiSettings(scriptId)) {
          return;
        }
        updateAsrVoiceAiDefaultsTip(scriptId, payload);
        if (scriptId === judgementProjectId) {
          applyJudgementForm(currentSettings || settings || {});
        } else if (scriptId === transcriptionProjectId) {
          applyTranscriptionForm(currentSettings || settings || {});
        } else if (scriptId === dataBakerRoundOneQualityScriptId) {
          applyDataBakerForm(currentSettings || settings || {});
        } else if (scriptId === dataBakerCvpcLiuzhouScriptId) {
          applyDataBakerCvpcForm(currentSettings || settings || {});
        } else if (isBytedanceAidpScript(scriptId)) {
          applyBytedanceAidpForm(currentSettings || settings || {}, scriptId);
        } else if (isAishellTechScript(scriptId)) {
          applyAishellTechForm(currentSettings || settings || {}, scriptId);
        } else if (isJdTtsShanghaineseScript(scriptId)) {
          applyJdTtsShanghaineseForm(currentSettings || settings || {});
        } else if (isMagicDataScript(scriptId)) {
          applyMagicDataSettingsForm(currentSettings || settings || {}, scriptId);
        } else if (isHaitianUtransScript(scriptId)) {
          applyHaitianUtransAudioDownloadHelperForm(currentSettings || settings || {});
        }
        ensureInlineHelpDots(getElement("detail-view"));
      });
    }
    setStatus("detail-status", "");

    if (scriptId === transcriptionProjectId) {
      applyTranscriptionForm(settings);
      setStatus(
        "detail-status",
        "ASR 转写当前为轻量工具栏模式：可配置自动播放、倍速、步长、音量与快捷键；支持当前题 AI 推荐（手动填入）；统计上传和定时上传按脚本规则强制启用。"
      );
      return;
    }

    if (scriptId === judgementProjectId) {
      applyJudgementForm(settings);
      setStatus("judgement-status", "");
      return;
    }

    if (scriptId === lightwheelScriptId) {
      const enabled = isScriptEnabled(settings, scriptId);
      setStatus(
        "lightwheel-status",
        enabled
          ? "当前只启用了脚本中心状态位；Lightwheel 扩展运行时还没有迁入。"
          : "当前脚本未启用。启用后会先纳入 URL 检测和脚本中心管理。"
      );
    }

    if (scriptId === dataBakerRoundOneQualityScriptId) {
      applyDataBakerForm(settings);
      setStatus(
        "data-baker-status",
        "DataBaker 导出数据会在本地下载的同时自动上传到后端；上传地址由首页顶部“后端接口地址”统一控制。"
      );
      return;
    }

    if (scriptId === dataBakerCvpcLiuzhouScriptId) {
      applyDataBakerCvpcForm(settings);
      setStatus(
        "data-baker-cvpc-status",
        "当前只支持建议生成 + 人工确认；不会自动保存、提交或切下一条，真实画段写入契约仍待补采。"
      );
      return;
    }

    if (isBytedanceAidpScript(scriptId)) {
      applyBytedanceAidpForm(settings, scriptId);
      setStatus("bytedance-aidp-status", "");
      return;
    }

    if (isAishellTechScript(scriptId)) {
      applyAishellTechForm(settings, scriptId);
      setStatus(
        getAsrVoiceAiStatusTargetId(scriptId),
        isAishellTechVietnameseScript(scriptId)
          ? "希尔贝壳越南语助手使用单阶段 Omni 识别；批量模式只处理当前分包，并保持 AI 并发请求 + 页面串行保存，不自动提交任务。"
          : isAishellTechCnEnShortDramaScript(scriptId)
            ? "中英短剧脚本当前只在 /mytask/mark 展示只读“当前媒体信息”面板，不接入 AI 推荐、自动保存或自动提交。"
          : isAishellTechThaiScript(scriptId)
            ? "希尔贝壳泰语助手使用单阶段 Omni 同时输出文本与语速；批量模式只处理当前分包，并保持 AI 并发请求 + 页面串行保存，不自动提交任务。"
            : "希尔贝壳批量模式只处理当前分包、从当前选中条开始、跳过已完成条目；每条会先对齐到目标条，再调用平台原生保存接口，不自动提交任务。"
      );
      return;
    }

    if (isJdTtsShanghaineseScript(scriptId)) {
      applyJdTtsShanghaineseForm(settings);
      setStatus(
        "jd-tts-shanghainese-status",
        "仅识别并填入当前文本框，不保存或提交。"
      );
      return;
    }

    if (isMagicDataScript(scriptId)) {
      applyMagicDataSettingsForm(settings, scriptId);
      setStatus(
        "magic-data-status",
        "Magic Data 页面内结果区固定展示空状态，点击 AI 质检后仅更新内容，不会自动保存或提交。"
      );
      return;
    }

    if (isAbakaAiScript(scriptId)) {
      applyAbakaAiTaskPageForm(settings);
      setStatus(
        "detail-status",
        "Task21助手仅用于快捷键与 AI 辅助建议；不会自动保存、提交、领取或流转。"
      );
      setStatus("abaka-status", "");
      return;
    }

    if (isHaitianUtransScript(scriptId)) {
      applyHaitianUtransAudioDownloadHelperForm(settings);
      setStatus(
        "detail-status",
        "uTrans 音频下载助手只控制详情页悬浮下载按钮；不会预览音频、不会批量下载，也不会改动平台写操作。"
      );
      setStatus("haitian-utrans-status", "");
      return;
    }
  }

  function applyDataBakerForm(settings) {
    const config = getDataBakerRoundOneConfig(settings);
    const defaultsPayload = getAsrVoiceAiDefaultsCached(dataBakerRoundOneQualityScriptId);
    const aiDefaults = defaultsPayload.defaults || {};
    dataBakerShortcutsDraft = clone(config.shortcuts) || {};
    if (getElement("data-baker-ai-recommend-enabled")) {
      getElement("data-baker-ai-recommend-enabled").checked =
        config.aiRecommendEnabled !== false;
      getElement("data-baker-ai-timeout").value = String(
        Number(config.aiRecommendRequestTimeoutMs || aiDefaults.timeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS)
      );
      applyDataBakerRecognitionModeFields(config.aiRecommendPipelineMode, config, aiDefaults);
      applyForcedThinkingToggle(
        "data-baker-ai-enable-thinking",
        "thinking 已全局固定关闭；DataBaker 不再允许开启 Omni 思考模式。"
      );
      getElement("data-baker-ai-listen-prompt").value = String(
        getAsrVoiceAiEffectiveText(config.aiRecommendListenPrompt, aiDefaults.listenPrompt)
      );
      getElement("data-baker-ai-compare-prompt").value = String(
        getAsrVoiceAiEffectiveText(config.aiRecommendComparePrompt, aiDefaults.comparePrompt)
      );
      getElement("data-baker-ai-temperature").value = String(
        getAsrVoiceAiEffectiveText(config.aiRecommendTemperature, aiDefaults.temperature)
      );
      getElement("data-baker-ai-top-p").value = String(
        getAsrVoiceAiEffectiveText(config.aiRecommendTopP, aiDefaults.top_p)
      );
      getElement("data-baker-ai-max-tokens").value = String(
        getAsrVoiceAiEffectiveText(config.aiRecommendMaxTokens, aiDefaults.max_tokens)
      );
      getElement("data-baker-ai-max-completion-tokens").value = String(
        getAsrVoiceAiEffectiveText(
          config.aiRecommendMaxCompletionTokens,
          aiDefaults.max_completion_tokens
        )
      );
      getElement("data-baker-ai-presence-penalty").value = String(
        getAsrVoiceAiEffectiveText(config.aiRecommendPresencePenalty, aiDefaults.presence_penalty)
      );
      getElement("data-baker-ai-frequency-penalty").value = String(
        getAsrVoiceAiEffectiveText(
          config.aiRecommendFrequencyPenalty,
          aiDefaults.frequency_penalty
        )
      );
      getElement("data-baker-ai-seed").value = String(
        getAsrVoiceAiEffectiveText(config.aiRecommendSeed, aiDefaults.seed)
      );
      getElement("data-baker-ai-stop-sequences").value = String(
        getAsrVoiceAiEffectiveText(config.aiRecommendStopSequences, aiDefaults.stop)
      );
      updateDataBakerAutofillConcurrencyField(config);
    }
    getElement("data-baker-auto-page-size-enabled").checked =
      config.autoPageSizeEnabled !== false;
    getElement("data-baker-default-page-size").value = normalizeDataBakerPageSize(
      config.defaultPageSize,
      "50条/页"
    );
    stopDataBakerShortcutRecording("");
    renderDataBakerShortcutGrid();
    syncOptionsCustomSelects(getElement("detail-view"));
  }

  function applyDataBakerCvpcForm(settings) {
    const config = getDataBakerCvpcLiuzhouConfig(settings);
    const defaultsPayload = getAsrVoiceAiDefaultsCached(dataBakerCvpcLiuzhouScriptId);
    const aiDefaults = defaultsPayload.defaults || {};
    dataBakerCvpcShortcutsDraft = clone(config.shortcuts) || {};
    const segmentPreviewNode = getElement("data-baker-cvpc-segment-preview-enabled");
    const segmentPreviewAutoApplyNode = getElement(
      "data-baker-cvpc-segment-preview-auto-apply-enabled"
    );
    const aiRecommendAutoFillNode = getElement(
      "data-baker-cvpc-ai-recommend-auto-fill-enabled"
    );
    const recommendationValidityAutoCorrectNode = getElement(
      "data-baker-cvpc-recommendation-validity-auto-correct-enabled"
    );
    const aiRecommendNode = getElement("data-baker-cvpc-ai-recommend-enabled");
    const blockNewTabTipNode = getElement("data-baker-cvpc-block-new-tab-tip");
    const blockPauseStateTipNode = getElement("data-baker-cvpc-block-pause-state-tip");
    const segmentSilenceThresholdUnitNode = getElement(
      "data-baker-cvpc-segment-silence-threshold-unit"
    );
    const segmentSilenceThresholdNode = getElement(
      "data-baker-cvpc-segment-silence-threshold-dbfs"
    );
    const segmentContextPaddingNode = getElement(
      "data-baker-cvpc-segment-context-padding-ms"
    );
    const timeoutNode = getElement("data-baker-cvpc-ai-timeout");
    const contractNode = getElement("data-baker-cvpc-contract-mode");

    if (segmentPreviewNode) {
      segmentPreviewNode.checked = config.segmentPreviewEnabled !== false;
    }
    if (segmentPreviewAutoApplyNode) {
      segmentPreviewAutoApplyNode.checked = config.segmentPreviewAutoApplyEnabled !== false;
    }
    if (aiRecommendAutoFillNode) {
      aiRecommendAutoFillNode.checked = config.aiRecommendAutoFillEnabled !== false;
    }
    if (recommendationValidityAutoCorrectNode) {
      recommendationValidityAutoCorrectNode.checked =
        config.recommendationValidityAutoCorrectEnabled !== false;
    }
    if (aiRecommendNode) {
      aiRecommendNode.checked = config.aiRecommendEnabled !== false;
    }
    if (blockNewTabTipNode) {
      blockNewTabTipNode.checked = config.blockNewTabEditingTips !== false;
    }
    if (blockPauseStateTipNode) {
      blockPauseStateTipNode.checked = config.blockPauseStateTips !== false;
    }
    if (
      segmentSilenceThresholdUnitNode instanceof HTMLSelectElement ||
      segmentSilenceThresholdNode instanceof HTMLInputElement
    ) {
      applyDataBakerCvpcSegmentThresholdFieldState(
        config.segmentSilenceThresholdDbfs,
        config.segmentSilenceThresholdUnit
      );
    }
    if (segmentContextPaddingNode instanceof HTMLInputElement) {
      segmentContextPaddingNode.value = String(
        Number((config.segmentContextPaddingMs / 1000).toFixed(1))
      );
    }
    if (timeoutNode) {
      timeoutNode.value = String(
        Number(config.aiRecommendRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS)
      );
    }
    if (aiRecommendNode) {
      aiRecommendNode.checked = config.aiRecommendEnabled !== false;
    }
    if (timeoutNode) {
      timeoutNode.value = String(
        Number(config.aiRecommendRequestTimeoutMs || aiDefaults.timeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS)
      );
    }
    if (getElement("data-baker-cvpc-ai-listen-model-select")) {
      applyDataBakerCvpcStageFields(config, aiDefaults);
      applyForcedThinkingToggle(
        "data-baker-cvpc-ai-enable-thinking",
        "thinking 已全局固定关闭；柳州话脚本不允许开启 Omni 思考模式。"
      );
    }
    if (contractNode) {
      contractNode.textContent =
        config.contractMode === "dom-guarded"
          ? "仅允许 DOM 守卫下的显式写入；真实画段写入契约仍待补采。"
          : String(config.contractMode || "dom-guarded");
    }
    renderDataBakerCvpcShortcutGrid();
    syncOptionsCustomSelects(getElement("detail-view"));
  }

  function applyBytedanceAidpRenderedAiFields(config, aiDefaults, activeScriptId) {
    const aiRecommendAutoFillNode = getElement("bytedance-aidp-ai-recommend-auto-fill-enabled");
    const timeoutNode = getElement("bytedance-aidp-ai-timeout");

    if (aiRecommendAutoFillNode instanceof HTMLInputElement) {
      aiRecommendAutoFillNode.checked = config.aiRecommendAutoFillEnabled !== false;
    }
    if (timeoutNode instanceof HTMLInputElement) {
      const defaultTimeoutMs = Number(aiDefaults.timeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS);
      const currentTimeoutMs = Number(
        config.aiRecommendRequestTimeoutMs || defaultTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS
      );
      timeoutNode.value =
        currentTimeoutMs === defaultTimeoutMs
          ? ""
          : formatBytedanceAidpTimeoutSecondsValue(currentTimeoutMs);
      timeoutNode.placeholder = formatBytedanceAidpTimeoutSecondsValue(defaultTimeoutMs);
    }
    if (getElement("bytedance-aidp-ai-listen-model-select")) {
      applyBytedanceAidpSuzhouStageFields(config, aiDefaults, activeScriptId);
      applyForcedThinkingToggle(
        "bytedance-aidp-ai-enable-thinking",
        activeScriptId === bytedanceAidpJinhuaScriptId
          ? "thinking 已全局固定关闭；金华话脚本不允许开启 Omni 思考模式。"
          : "thinking 已全局固定关闭；苏州话脚本不允许开启 Omni 思考模式。"
      );
    }
    syncOptionsCustomSelects(getElement("detail-shared-asr-ai-panel"));
    syncAidpLineNumberTextareas(getElement("detail-shared-asr-ai-panel"));
    bindSwitchFieldText(getElement("detail-shared-asr-ai-panel"));
  }

  function ensureBytedanceAidpAiPanelReady(scriptId) {
    const panel = getElement("detail-shared-asr-ai-panel");
    if (!(panel instanceof HTMLElement)) {
      return;
    }
    if (panel.innerHTML.trim()) {
      return;
    }
    const activeScriptId =
      scriptId === bytedanceAidpJinhuaScriptId
        ? bytedanceAidpJinhuaScriptId
        : bytedanceAidpSuzhouScriptId;
    const renderSettings = clone(currentSettings || {}) || {};
    renderSettings.platforms = renderSettings.platforms || {};
    renderSettings.platforms.bytedanceAidp = renderSettings.platforms.bytedanceAidp || {};
    renderSettings.platforms.bytedanceAidp.scripts =
      renderSettings.platforms.bytedanceAidp.scripts || {};
    const meta = getBytedanceAidpConfigMeta(activeScriptId);
    const currentConfig = getBytedanceAidpConfig(currentSettings || {}, activeScriptId);
    renderSettings.platforms.bytedanceAidp.scripts[meta.scriptKey] = Object.assign(
      {},
      currentConfig,
      { aiRecommendEnabled: true }
    );
    renderAsrVoiceAiSettingsSection(renderSettings, activeScriptId);
    const aiDefaults = getAsrVoiceAiDefaultsCached(activeScriptId).defaults || {};
    applyBytedanceAidpRenderedAiFields(currentConfig, aiDefaults, activeScriptId);
  }

  function refreshBytedanceAidpDetailAiVisibility(scriptId) {
    if (!isBytedanceAidpScript(scriptId)) {
      return;
    }
    const aiEnabledNode = getElement("bytedance-aidp-ai-enabled");
    const panel = getElement("detail-shared-asr-ai-panel");
    const enabled =
      aiEnabledNode instanceof HTMLInputElement
        ? aiEnabledNode.checked !== false
        : shouldShowBytedanceAidpAiSettingsSection(currentSettings || {}, scriptId);
    if (enabled) {
      ensureBytedanceAidpAiPanelReady(scriptId);
    }
    if (panel instanceof HTMLElement) {
      panel.classList.toggle("hidden", !enabled);
      if (!enabled) {
        closeOptionsCustomSelects(null);
        panel.innerHTML = "";
      }
    }
    updateDetailLayout(scriptId);
  }

  function applyBytedanceAidpForm(settings, scriptId) {
    const activeScriptId =
      scriptId === bytedanceAidpJinhuaScriptId
        ? bytedanceAidpJinhuaScriptId
        : bytedanceAidpSuzhouScriptId;
    const config =
      activeScriptId === bytedanceAidpJinhuaScriptId
        ? getBytedanceAidpJinhuaConfig(settings)
        : getBytedanceAidpSuzhouConfig(settings);
    const defaultsPayload = getAsrVoiceAiDefaultsCached(activeScriptId);
    const aiDefaults = defaultsPayload.defaults || {};
    bytedanceAidpShortcutsDraft = clone(config.shortcuts) || {};
    const platformAiNode = getElement("bytedance-aidp-platform-ai-enabled");
    const segmentPreviewAutoApplyNode = getElement(
      "bytedance-aidp-segment-preview-auto-apply-enabled"
    );
    const segmentContextPaddingNode = getElement("bytedance-aidp-segment-context-padding-seconds");
    const segmentSilenceThresholdNode = getElement(
      "bytedance-aidp-segment-silence-threshold-dbfs"
    );
    const mergeContiguousSegmentsNode = getElement(
      "bytedance-aidp-merge-contiguous-suggested-segments-enabled"
    );
    const defaultPlaybackRateNode = getElement("bytedance-aidp-default-playback-rate");
    const fixedWaveZoomNode = getElement("bytedance-aidp-fixed-wave-zoom");
    const contractNode = getElement("bytedance-aidp-contract-mode");
    const aiEnabledField = getElement("bytedance-aidp-ai-enabled-field");
    const aiEnabledNode = getElement("bytedance-aidp-ai-enabled");

    if (platformAiNode) {
      platformAiNode.checked = config.platformAiEnabled === false;
    }
    if (segmentPreviewAutoApplyNode instanceof HTMLInputElement) {
      segmentPreviewAutoApplyNode.checked = config.segmentPreviewAutoApplyEnabled !== false;
    }
    if (segmentContextPaddingNode instanceof HTMLInputElement) {
      segmentContextPaddingNode.value = String(
        Number((config.segmentContextPaddingMs / 1000).toFixed(1))
      );
    }
    if (segmentSilenceThresholdNode instanceof HTMLInputElement) {
      segmentSilenceThresholdNode.value = String(config.segmentSilenceThresholdDbfs);
    }
    if (mergeContiguousSegmentsNode instanceof HTMLInputElement) {
      mergeContiguousSegmentsNode.checked =
        config.mergeContiguousSuggestedSegmentsEnabled !== false;
    }
    if (defaultPlaybackRateNode instanceof HTMLSelectElement) {
      renderDetailCustomSelectOptions(
        "bytedance-aidp-default-playback-rate",
        bytedanceAidpPlaybackRatePresets.map(function (value) {
          const label = Number(value).toFixed(2) + "倍速";
          return {
            value: String(value),
            label: label,
          };
        }),
        String(config.defaultPlaybackRate),
        {
          placeholder: "请选择默认播放倍数",
        }
      );
    }
    if (fixedWaveZoomNode instanceof HTMLSelectElement) {
      renderDetailCustomSelectOptions(
        "bytedance-aidp-fixed-wave-zoom",
        bytedanceAidpFixedWaveZoomPresets.map(function (value) {
          return {
            value: String(value),
            label: String(value),
          };
        }),
        String(config.fixedWaveZoom),
        {
          placeholder: "请选择固定缩放倍数",
        }
      );
    }
    syncOptionsCustomSelects(getElement("detail-bytedance-aidp-suzhou-panel"));
    if (contractNode) {
      contractNode.textContent =
        config.contractMode === "dom-guarded"
          ? "仅允许 DOM 显隐、波形控件回填、快捷键触发页面真实按钮和显式分段建议写回；不触发提交或下一题。"
          : String(config.contractMode || "dom-guarded");
    }
    if (aiEnabledField instanceof HTMLElement) {
      aiEnabledField.classList.remove("hidden");
    }
    if (aiEnabledNode instanceof HTMLInputElement) {
      aiEnabledNode.checked = config.aiRecommendEnabled !== false;
      syncSwitchFieldText(aiEnabledNode);
    }
    if (
      getElement("bytedance-aidp-ai-recommend-auto-fill-enabled") ||
      getElement("bytedance-aidp-ai-timeout")
    ) {
      applyBytedanceAidpRenderedAiFields(config, aiDefaults, activeScriptId);
    }
    showTopToast("", "info", 0);
    stopBytedanceAidpShortcutRecording("");
    renderBytedanceAidpShortcutGrid();
    bindSwitchFieldText(getElement("detail-bytedance-aidp-suzhou-panel"));
  }

  function applyBytedanceAidpJinhuaForm(settings) {
    applyBytedanceAidpForm(settings, bytedanceAidpJinhuaScriptId);
  }

  function applyAishellTechMinnanForm(settings) {
    const config = getAishellTechMinnanConfig(settings);
    const defaultsPayload = getAsrVoiceAiDefaultsCached(aishellTechMinnanScriptId);
    const aiDefaults = defaultsPayload.defaults || {};
    aishellTechShortcutsDraft = clone(config.shortcuts) || {};
    if (getElement("aishell-tech-ai-recommend-enabled")) {
      getElement("aishell-tech-ai-recommend-enabled").checked =
        config.aiRecommendEnabled !== false;
      getElement("aishell-tech-ai-timeout").value = String(
        Number(config.aiRecommendRequestTimeoutMs || aiDefaults.timeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS)
      );
      applyAishellTechStageFields(config, aiDefaults);
      applyForcedThinkingToggle(
        "aishell-tech-ai-enable-thinking",
        "thinking 已全局固定关闭；希尔贝壳不再允许开启 Omni 思考模式。"
      );
      updateAishellTechAutofillConcurrencyField(config);
    }
    stopAishellTechShortcutRecording("");
    renderAishellTechShortcutGrid();
  }

  function applyAishellTechVietnameseForm(settings) {
    const config = getAishellTechVietnameseConfig(settings);
    const defaultsPayload = getAsrVoiceAiDefaultsCached(aishellTechVietnameseScriptId);
    const aiDefaults = defaultsPayload.defaults || {};
    aishellTechShortcutsDraft = clone(config.shortcuts) || {};
    if (getElement("aishell-tech-ai-recommend-enabled")) {
      getElement("aishell-tech-ai-recommend-enabled").checked =
        config.aiRecommendEnabled !== false;
      getElement("aishell-tech-ai-timeout").value = String(
        Number(config.aiRecommendRequestTimeoutMs || aiDefaults.timeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS)
      );
      renderFixedModelOptions(
        "aishell-tech-ai-single-model-select",
        buildAishellTechOmniModelOptions(aiDefaults, [config.aiRecommendSingleModel]),
        normalizeDataBakerSingleModel(
          config.aiRecommendSingleModel,
          String(aiDefaults.singleModel || "qwen3.5-omni-flash")
        )
      );
      getElement("aishell-tech-ai-single-prompt").value = String(
        getAsrVoiceAiEffectiveText(config.aiRecommendSinglePrompt, aiDefaults.singlePrompt)
      );
      applyAishellTechStageParamValues("single", "aiRecommend", config, {
        temperature: aiDefaults.temperature,
        top_p: aiDefaults.top_p,
        max_tokens: aiDefaults.max_tokens,
        max_completion_tokens: aiDefaults.max_completion_tokens,
        presence_penalty: aiDefaults.presence_penalty,
        frequency_penalty: aiDefaults.frequency_penalty,
        seed: aiDefaults.seed,
        stop: aiDefaults.stop,
      });
      applyForcedThinkingToggle(
        "aishell-tech-ai-enable-thinking",
        "thinking 已全局固定关闭；希尔贝壳不再允许开启 Omni 思考模式。"
      );
      updateAishellTechAutofillConcurrencyField(
        {
          aiRecommendPipelineMode: "omni_single",
          aiRecommendSingleModel: config.aiRecommendSingleModel,
          aiQualifiedAutofillConcurrency: config.aiQualifiedAutofillConcurrency,
        },
        {
          scriptId: aishellTechVietnameseScriptId,
        }
      );
    }
    stopAishellTechShortcutRecording("");
    renderAishellTechShortcutGrid();
  }

  function applyAishellTechThaiForm(settings) {
    const config = getAishellTechThaiConfig(settings);
    const defaultsPayload = getAsrVoiceAiDefaultsCached(aishellTechThaiScriptId);
    const aiDefaults = defaultsPayload.defaults || {};
    aishellTechShortcutsDraft = clone(config.shortcuts) || {};
    if (getElement("aishell-tech-ai-recommend-enabled")) {
      getElement("aishell-tech-ai-recommend-enabled").checked =
        config.aiRecommendEnabled !== false;
      getElement("aishell-tech-ai-timeout").value = String(
        Number(config.aiRecommendRequestTimeoutMs || aiDefaults.timeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS)
      );
      renderFixedModelOptions(
        "aishell-tech-ai-single-model-select",
        buildAishellTechOmniModelOptions(aiDefaults, [config.aiRecommendSingleModel]),
        normalizeDataBakerSingleModel(
          config.aiRecommendSingleModel,
          String(aiDefaults.singleModel || "qwen3.5-omni-flash")
        )
      );
      getElement("aishell-tech-ai-single-prompt").value = String(
        getAsrVoiceAiEffectiveText(config.aiRecommendSinglePrompt, aiDefaults.singlePrompt)
      );
      applyAishellTechStageParamValues("single", "aiRecommend", config, {
        temperature: aiDefaults.temperature,
        top_p: aiDefaults.top_p,
        max_tokens: aiDefaults.max_tokens,
        max_completion_tokens: aiDefaults.max_completion_tokens,
        presence_penalty: aiDefaults.presence_penalty,
        frequency_penalty: aiDefaults.frequency_penalty,
        seed: aiDefaults.seed,
        stop: aiDefaults.stop,
      });
      applyForcedThinkingToggle(
        "aishell-tech-ai-enable-thinking",
        "thinking 已全局固定关闭；希尔贝壳不再允许开启 Omni 思考模式。"
      );
      updateAishellTechAutofillConcurrencyField(
        {
          aiRecommendPipelineMode: "omni_single",
          aiRecommendSingleModel: config.aiRecommendSingleModel,
          aiQualifiedAutofillConcurrency: config.aiQualifiedAutofillConcurrency,
        },
        {
          scriptId: aishellTechThaiScriptId,
        }
      );
    }
    stopAishellTechShortcutRecording("");
    renderAishellTechShortcutGrid();
  }

  function applyAishellTechForm(settings, scriptId) {
    if (isAishellTechCnEnShortDramaScript(scriptId)) {
      const config = getAishellTechCnEnShortDramaConfig(settings);
      aishellTechShortcutsDraft = clone(config.shortcuts) || {};
      stopAishellTechShortcutRecording("");
      renderAishellTechShortcutGrid();
      return;
    }
    if (isAishellTechVietnameseScript(scriptId)) {
      applyAishellTechVietnameseForm(settings);
      return;
    }
    if (isAishellTechThaiScript(scriptId)) {
      applyAishellTechThaiForm(settings);
      return;
    }

    if (isAishellTechCantoneseScript(scriptId)) {
      applyAishellTechCantoneseForm(settings);
      return;
    }
    applyAishellTechMinnanForm(settings);
  }

  function applyAishellTechCantoneseForm(settings) {
    const config = getAishellTechCantoneseConfig(settings);
    const aiDefaults = getAsrVoiceAiDefaultsCached(aishellTechCantoneseScriptId).defaults || {};
    aishellTechShortcutsDraft = clone(config.shortcuts) || {};
    if (getElement("aishell-tech-ai-recommend-enabled")) {
      getElement("aishell-tech-ai-recommend-enabled").checked = config.aiRecommendEnabled !== false;
      renderFixedModelOptions(
        "aishell-tech-ai-single-model-select",
        buildAishellTechOmniModelOptions(aiDefaults, [config.aiRecommendSingleModel]),
        config.aiRecommendSingleModel
      );
      getElement("aishell-tech-ai-single-prompt").value = String(
        getAsrVoiceAiEffectiveText(config.aiRecommendSinglePrompt, aiDefaults.singlePrompt)
      );
      applyAishellTechStageParamValues("single", "aiRecommend", config, {
        temperature: aiDefaults.temperature,
        top_p: aiDefaults.top_p,
        max_tokens: aiDefaults.max_tokens,
        max_completion_tokens: aiDefaults.max_completion_tokens,
        presence_penalty: aiDefaults.presence_penalty,
        frequency_penalty: aiDefaults.frequency_penalty,
        seed: aiDefaults.seed,
        stop: aiDefaults.stop,
      });
      applyForcedThinkingToggle(
        "aishell-tech-ai-enable-thinking",
        "thinking 已全局固定关闭；希尔贝壳不再允许开启 Omni 思考模式。"
      );
      updateAishellTechAutofillConcurrencyField(
        {
          aiRecommendPipelineMode: "omni_single",
          aiRecommendSingleModel: config.aiRecommendSingleModel,
          aiQualifiedAutofillConcurrency: config.aiQualifiedAutofillConcurrency,
        },
        { scriptId: aishellTechCantoneseScriptId }
      );
    }
    renderAishellTechShortcutGrid();
  }

  function applyJdTtsShanghaineseForm(settings) {
    const config = getJdTtsShanghaineseConfig(settings);
    const aiDefaults = getAsrVoiceAiDefaultsCached(jdTtsShanghaineseScriptId).defaults || {};
    const enabled = getElement("jd-tts-ai-recommend-enabled");
    if (!enabled) return;
    enabled.checked = config.aiRecommendEnabled === true;
    renderFixedModelOptions(
      "jd-tts-ai-single-model-select",
      [
        { value: "qwen3.5-omni-plus", label: "qwen3.5-omni-plus" },
        { value: "qwen3.5-omni-flash", label: "qwen3.5-omni-flash" },
      ],
      config.aiRecommendSingleModel
    );
    getElement("jd-tts-ai-single-prompt").value = String(
      getAsrVoiceAiEffectiveText(config.aiRecommendSinglePrompt, aiDefaults.singlePrompt)
    );
    aishellTechStageParamDefinitions.forEach(function (definition) {
      const node = getElement("jd-tts-ai-single-" + definition.domSuffix);
      if (!node) return;
      const key = "aiRecommend" + definition.suffix;
      node.value = String(config[key] || aiDefaults[definition.apiKey] || "");
    });
    applyForcedThinkingToggle(
      "jd-tts-ai-enable-thinking",
      "thinking 已全局固定关闭；京东 TTS 上海话助手不允许开启 Omni 思考模式。"
    );
    syncOptionsCustomSelects(getElement("detail-shared-asr-ai-panel"));
  }

  async function saveDataBakerSettings() {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("data-baker-status", "当前扩展版本不支持保存标贝易采设置。");
      return false;
    }

    const currentConfig = getDataBakerRoundOneConfig(currentSettings || {});
    const aiDefaults = getAsrVoiceAiDefaultsCached(dataBakerRoundOneQualityScriptId).defaults || {};
    const hasAiSettingsPanel = Boolean(getElement("data-baker-ai-timeout"));
    const timeoutInput = hasAiSettingsPanel
      ? getElement("data-baker-ai-timeout").value
      : String(currentConfig.aiRecommendRequestTimeoutMs);
    const aiRecommendEnabled = hasAiSettingsPanel
      ? getElement("data-baker-ai-recommend-enabled").checked
      : currentConfig.aiRecommendEnabled !== false;
    const autoPageSizeEnabled = getElement("data-baker-auto-page-size-enabled").checked;
    const defaultPageSize = normalizeDataBakerPageSize(
      getElement("data-baker-default-page-size").value,
      "50条/页"
    );
    const timeoutMs = normalizeDataBakerTimeoutMs(timeoutInput);
    const autofillWaitAllBeforeFill = false;
    const recognitionMode = hasAiSettingsPanel
      ? normalizeDataBakerRecognitionMode(
          getElement("data-baker-ai-pipeline-mode-select")?.value,
          currentConfig.aiRecommendPipelineMode || "two_stage"
        )
      : normalizeDataBakerRecognitionMode(currentConfig.aiRecommendPipelineMode, "two_stage");
    const listenModel = hasAiSettingsPanel
      ? normalizeDataBakerListenModel(
          getElement("data-baker-ai-listen-model-select")?.value,
          getDataBakerListenModelDefault(aiDefaults)
        )
      : normalizeDataBakerListenModel(
          currentConfig.aiRecommendListenModel,
          getDataBakerListenModelDefault(aiDefaults)
        );
    const compareModel = normalizeDataBakerCompareModel(
      hasAiSettingsPanel
        ? getElement("data-baker-ai-compare-model-select")?.value
        : currentConfig.aiRecommendCompareModel,
      String(aiDefaults.compareModel || "qwen3.5-plus")
    );
    const singleModel = hasAiSettingsPanel
      ? normalizeDataBakerSingleModel(
          getElement("data-baker-ai-single-model-select")?.value,
          getDataBakerSingleModelDefault(aiDefaults)
        )
      : normalizeDataBakerSingleModel(
          currentConfig.aiRecommendSingleModel,
          getDataBakerSingleModelDefault(aiDefaults)
        );
    const autofillConcurrency = normalizeDataBakerAutofillConcurrency(
      getElement("data-baker-qualified-autofill-concurrency")?.value,
      {
        aiRecommendPipelineMode: recognitionMode,
        aiRecommendListenModel: listenModel,
        aiRecommendSingleModel: singleModel,
      }
    );
    updateDataBakerAutofillConcurrencyField({
      aiRecommendPipelineMode: recognitionMode,
      aiRecommendListenModel: listenModel,
      aiRecommendSingleModel: singleModel,
      aiQualifiedAutofillConcurrency: autofillConcurrency,
    });
    const pipelineMode = deriveDataBakerPipelineMode(
      recognitionMode,
      recognitionMode === "omni_single" ? singleModel : listenModel
    );
    const listenPrompt = hasAiSettingsPanel
      ? normalizePromptText(getElement("data-baker-ai-listen-prompt").value)
      : currentConfig.aiRecommendListenPrompt;
    const comparePrompt = hasAiSettingsPanel
      ? normalizePromptText(getElement("data-baker-ai-compare-prompt").value)
      : currentConfig.aiRecommendComparePrompt;
    const normalizeOverridePrompt = function (value, defaultValue) {
      const normalizedValue = normalizePromptText(value || "");
      const normalizedDefault = normalizePromptText(defaultValue || "");
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const normalizeOverrideNumber = function (value, defaultValue, min, max, precision) {
      const normalizedValue = normalizeOptionalNumberText(value, min, max, precision);
      const normalizedDefault = normalizeOptionalNumberText(defaultValue, min, max, precision);
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const normalizeOverrideInteger = function (value, defaultValue, min, max) {
      const normalizedValue = normalizeOptionalIntegerText(value, min, max);
      const normalizedDefault = normalizeOptionalIntegerText(defaultValue, min, max);
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const temperature = hasAiSettingsPanel
      ? normalizeOverrideNumber(
          getElement("data-baker-ai-temperature").value,
          aiDefaults.temperature,
          0,
          2,
          3
        )
      : currentConfig.aiRecommendTemperature;
    const topP = hasAiSettingsPanel
      ? normalizeOverrideNumber(getElement("data-baker-ai-top-p").value, aiDefaults.top_p, 0, 1, 3)
      : currentConfig.aiRecommendTopP;
    const maxTokens = hasAiSettingsPanel
      ? normalizeOverrideInteger(
          getElement("data-baker-ai-max-tokens").value,
          aiDefaults.max_tokens,
          1,
          8192
        )
      : currentConfig.aiRecommendMaxTokens;
    const maxCompletionTokens = hasAiSettingsPanel
      ? normalizeOverrideInteger(
          getElement("data-baker-ai-max-completion-tokens").value,
          aiDefaults.max_completion_tokens,
          1,
          8192
        )
      : currentConfig.aiRecommendMaxCompletionTokens;
    const presencePenalty = hasAiSettingsPanel
      ? normalizeOverrideNumber(
          getElement("data-baker-ai-presence-penalty").value,
          aiDefaults.presence_penalty,
          -2,
          2,
          3
        )
      : currentConfig.aiRecommendPresencePenalty;
    const frequencyPenalty = hasAiSettingsPanel
      ? normalizeOverrideNumber(
          getElement("data-baker-ai-frequency-penalty").value,
          aiDefaults.frequency_penalty,
          -2,
          2,
          3
        )
      : currentConfig.aiRecommendFrequencyPenalty;
    const seed = hasAiSettingsPanel
      ? normalizeOverrideInteger(getElement("data-baker-ai-seed").value, aiDefaults.seed, 0, 2147483647)
      : currentConfig.aiRecommendSeed;
    const stopSequences = hasAiSettingsPanel
      ? (function () {
          const normalizedValue = normalizeStopSequencesText(
            getElement("data-baker-ai-stop-sequences").value
          );
          const normalizedDefault = normalizeStopSequencesText(aiDefaults.stop || "");
          return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
        })()
      : currentConfig.aiRecommendStopSequences;
    const enableThinking = false;
    const shortcuts = {};

    ensureDataBakerShortcutDraft();
    dataBakerShortcutActions.forEach(function (action) {
      shortcuts[action.key] = normalizeNullableShortcut(dataBakerShortcutsDraft[action.key]);
    });

    setStatus("data-baker-status", "正在保存标贝易采设置...");

    try {
      currentSettings = await storage.patchSettings({
        platforms: {
          dataBaker: {
            scripts: {
              roundOneQuality: {
                id: dataBakerRoundOneQualityScriptId,
                aiRecommendEnabled: aiRecommendEnabled,
                aiRecommendRequestTimeoutMs: timeoutMs,
                aiRecommendPipelineMode: recognitionMode,
                aiRecommendListenModel:
                  recognitionMode === "two_stage" &&
                  listenModel !== getDataBakerListenModelDefault(aiDefaults)
                    ? listenModel
                    : "",
                aiRecommendCompareModel:
                  recognitionMode === "two_stage" &&
                  compareModel !== String(aiDefaults.compareModel || "").trim()
                    ? compareModel
                    : "",
                aiRecommendSingleModel:
                  recognitionMode === "omni_single" &&
                  singleModel !== getDataBakerSingleModelDefault(aiDefaults)
                    ? singleModel
                    : "",
                aiRecommendEnableThinking:
                  enableThinking === true && aiDefaults.enableThinking !== true ? true : false,
                aiRecommendListenPrompt: normalizeOverridePrompt(listenPrompt, aiDefaults.listenPrompt),
                aiRecommendComparePrompt: normalizeOverridePrompt(comparePrompt, aiDefaults.comparePrompt),
                aiRecommendTemperature: temperature,
                aiRecommendTopP: topP,
                aiRecommendMaxTokens: maxTokens,
                aiRecommendMaxCompletionTokens: maxCompletionTokens,
                aiRecommendPresencePenalty: presencePenalty,
                aiRecommendFrequencyPenalty: frequencyPenalty,
                aiRecommendSeed: seed,
                aiRecommendStopSequences: stopSequences,
                aiQualifiedAutofillConcurrency: autofillConcurrency,
                aiQualifiedAutofillWaitAllBeforeFill: autofillWaitAllBeforeFill,
                autoPageSizeEnabled: autoPageSizeEnabled,
                defaultPageSize: defaultPageSize,
                shortcuts: shortcuts,
              },
            },
          },
        },
      });
      renderCurrentView();
      setStatus(
        "data-baker-status",
        "标贝易采设置已保存；已打开的标贝易采页面未同步时请刷新页面。"
      );
      return true;
    } catch (error) {
      setStatus(
        "data-baker-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  async function saveDataBakerCvpcSettings() {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("data-baker-cvpc-status", "当前扩展版本不支持保存 CVPC 柳州话设置。");
      return false;
    }

    const currentConfig = getDataBakerCvpcLiuzhouConfig(currentSettings || {});
    const aiDefaults = getAsrVoiceAiDefaultsCached(dataBakerCvpcLiuzhouScriptId).defaults || {};
    const stageDefaults = getDataBakerCvpcStageDefaults(aiDefaults);
    ensureDataBakerCvpcShortcutDraft();
    const shortcuts = {};
    dataBakerCvpcShortcutActions.forEach(function (action) {
      shortcuts[action.key] = normalizeNullableShortcut(dataBakerCvpcShortcutsDraft[action.key]);
    });
    const segmentPreviewEnabled = getElement("data-baker-cvpc-segment-preview-enabled").checked;
    const segmentPreviewAutoApplyEnabled = getElement(
      "data-baker-cvpc-segment-preview-auto-apply-enabled"
    ).checked;
    const aiRecommendAutoFillEnabled = getElement(
      "data-baker-cvpc-ai-recommend-auto-fill-enabled"
    ).checked;
    const recommendationValidityAutoCorrectEnabled = getElement(
      "data-baker-cvpc-recommendation-validity-auto-correct-enabled"
    ).checked;
    const hasAiSettingsPanel = Boolean(getElement("data-baker-cvpc-ai-timeout"));
    const aiRecommendEnabled = hasAiSettingsPanel
      ? getElement("data-baker-cvpc-ai-recommend-enabled").checked
      : currentConfig.aiRecommendEnabled !== false;
    const blockNewTabEditingTips = getElement("data-baker-cvpc-block-new-tab-tip").checked;
    const blockPauseStateTips = getElement("data-baker-cvpc-block-pause-state-tip").checked;
    const segmentSilenceThresholdUnit = normalizeDataBakerCvpcSegmentSilenceThresholdUnit(
      getElement("data-baker-cvpc-segment-silence-threshold-unit")?.value,
      currentConfig.segmentSilenceThresholdUnit
    );
    const segmentSilenceThresholdDbfs = normalizeDataBakerCvpcSegmentSilenceThresholdDbfs(
      convertDataBakerCvpcSegmentThresholdDisplayValueToDbfs(
        getElement("data-baker-cvpc-segment-silence-threshold-dbfs")?.value,
        segmentSilenceThresholdUnit,
        currentConfig.segmentSilenceThresholdDbfs
      ),
      currentConfig.segmentSilenceThresholdDbfs
    );
    const segmentContextPaddingMs = normalizeDataBakerCvpcSegmentContextPaddingMs(
      Math.round(Number(getElement("data-baker-cvpc-segment-context-padding-ms")?.value || 0) * 1000),
      currentConfig.segmentContextPaddingMs
    );
    const timeoutMs = normalizeDataBakerTimeoutMs(
      (hasAiSettingsPanel ? getElement("data-baker-cvpc-ai-timeout").value : "") ||
        String(
          currentConfig.aiRecommendRequestTimeoutMs ||
            aiDefaults.timeoutMs ||
            DEFAULT_AI_REQUEST_TIMEOUT_MS
        )
    );
    const draftConfig = hasAiSettingsPanel
      ? getDataBakerCvpcSettingsDraftConfig(aiDefaults)
      : currentConfig;
    const normalizeOverridePrompt = function (value, defaultValue) {
      const normalizedValue = normalizePromptText(value || "");
      const normalizedDefault = normalizePromptText(defaultValue || "");
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const normalizeOverrideNumber = function (value, defaultValue, min, max, precision) {
      const normalizedValue = normalizeOptionalNumberText(value, min, max, precision);
      const normalizedDefault = normalizeOptionalNumberText(defaultValue, min, max, precision);
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const normalizeOverrideInteger = function (value, defaultValue, min, max) {
      const normalizedValue = normalizeOptionalIntegerText(value, min, max);
      const normalizedDefault = normalizeOptionalIntegerText(defaultValue, min, max);
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const readStageOverrides = function (configPrefix, stageKey) {
      const stageDefault = stageDefaults[stageKey] || {};
      const overrides = {};
      aishellTechStageParamDefinitions.forEach(function (definition) {
        const fieldName = configPrefix + definition.suffix;
        const defaultValue = stageDefault[definition.apiKey];
        if (definition.type === "number") {
          overrides[fieldName] = normalizeOverrideNumber(
            draftConfig[fieldName],
            defaultValue,
            definition.min,
            definition.max,
            definition.precision
          );
          return;
        }
        if (definition.type === "integer") {
          overrides[fieldName] = normalizeOverrideInteger(
            draftConfig[fieldName],
            defaultValue,
            definition.min,
            definition.max
          );
          return;
        }
        const normalizedValue = normalizeStopSequencesText(draftConfig[fieldName] || "");
        const normalizedDefault = normalizeStopSequencesText(defaultValue || "");
        overrides[fieldName] =
          normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
      });
      return overrides;
    };
    const listenOverrides = readStageOverrides("aiRecommendListen", "listen");
    const refineOverrides = readStageOverrides("aiRecommendRefine", "refine");
    const aiRecommendPath =
      constants.DATA_BAKER_CVPC_AI_RECOMMEND_PATH ||
      "/api/data-baker-cvpc/liuzhou-helper/ai/recommend";
    const segmentPreviewPath =
      constants.DATA_BAKER_CVPC_SEGMENT_PREVIEW_PATH ||
      "/api/data-baker-cvpc/liuzhou-helper/segment/preview";

    setStatus("data-baker-cvpc-status", "正在保存 CVPC 柳州话设置...");

    try {
      currentSettings = await storage.patchSettings({
        platforms: {
          dataBakerCvpc: {
            scripts: {
              liuzhouAssistant: {
                id: dataBakerCvpcLiuzhouScriptId,
                segmentPreviewEnabled: segmentPreviewEnabled,
                segmentPreviewAutoApplyEnabled: segmentPreviewAutoApplyEnabled,
                aiRecommendAutoFillEnabled: aiRecommendAutoFillEnabled,
                recommendationValidityAutoCorrectEnabled:
                  recommendationValidityAutoCorrectEnabled,
                segmentContextPaddingMs: segmentContextPaddingMs,
                segmentSilenceThresholdDbfs: segmentSilenceThresholdDbfs,
                segmentSilenceThresholdUnit: segmentSilenceThresholdUnit,
                blockNewTabEditingTips: blockNewTabEditingTips,
                blockPauseStateTips: blockPauseStateTips,
                segmentPreviewEndpoint: buildBackendUrl(segmentPreviewPath, currentSettings || {}),
                aiRecommendEnabled: aiRecommendEnabled,
                aiRecommendEndpoint: buildBackendUrl(aiRecommendPath, currentSettings || {}),
                aiRecommendRequestTimeoutMs: timeoutMs,
                aiRecommendListenModel: draftConfig.aiRecommendListenModel,
                aiRecommendListenPrompt: normalizeOverridePrompt(
                  draftConfig.aiRecommendListenPrompt,
                  stageDefaults.listen.prompt
                ),
                aiRecommendListenIncludeLexiconReference:
                  draftConfig.aiRecommendListenIncludeLexiconReference === true,
                aiRecommendListenTemperature: listenOverrides.aiRecommendListenTemperature,
                aiRecommendListenTopP: listenOverrides.aiRecommendListenTopP,
                aiRecommendListenMaxTokens: listenOverrides.aiRecommendListenMaxTokens,
                aiRecommendListenMaxCompletionTokens:
                  listenOverrides.aiRecommendListenMaxCompletionTokens,
                aiRecommendListenPresencePenalty: listenOverrides.aiRecommendListenPresencePenalty,
                aiRecommendListenFrequencyPenalty:
                  listenOverrides.aiRecommendListenFrequencyPenalty,
                aiRecommendListenSeed: listenOverrides.aiRecommendListenSeed,
                aiRecommendListenStopSequences: listenOverrides.aiRecommendListenStopSequences,
                aiRecommendRefineModel: draftConfig.aiRecommendRefineModel,
                aiRecommendRefinePrompt: normalizeOverridePrompt(
                  draftConfig.aiRecommendRefinePrompt,
                  stageDefaults.refine.prompt
                ),
                aiRecommendRefineTemperature: refineOverrides.aiRecommendRefineTemperature,
                aiRecommendRefineTopP: refineOverrides.aiRecommendRefineTopP,
                aiRecommendRefineMaxTokens: refineOverrides.aiRecommendRefineMaxTokens,
                aiRecommendRefineMaxCompletionTokens:
                  refineOverrides.aiRecommendRefineMaxCompletionTokens,
                aiRecommendRefinePresencePenalty: refineOverrides.aiRecommendRefinePresencePenalty,
                aiRecommendRefineFrequencyPenalty:
                  refineOverrides.aiRecommendRefineFrequencyPenalty,
                aiRecommendRefineSeed: refineOverrides.aiRecommendRefineSeed,
                aiRecommendRefineStopSequences: refineOverrides.aiRecommendRefineStopSequences,
                contractMode: "dom-guarded",
                shortcuts: shortcuts,
              },
            },
          },
        },
      });
      applyDataBakerCvpcForm(currentSettings);
      setStatus(
        "data-baker-cvpc-status",
        "CVPC 柳州话设置已保存；已打开的编辑器页面如未同步，请刷新业务页。"
      );
      return true;
    } catch (error) {
      setStatus(
        "data-baker-cvpc-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  async function saveBytedanceAidpSettings(scriptId) {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("bytedance-aidp-status", "当前扩展版本不支持保存设置。");
      return false;
    }

    const activeScriptId =
      scriptId === bytedanceAidpJinhuaScriptId
        ? bytedanceAidpJinhuaScriptId
        : bytedanceAidpSuzhouScriptId;
    const meta = getBytedanceAidpConfigMeta(activeScriptId);
    const currentConfig =
      activeScriptId === bytedanceAidpJinhuaScriptId
        ? getBytedanceAidpJinhuaConfig(currentSettings || {})
        : getBytedanceAidpSuzhouConfig(currentSettings || {});
    const aiDefaults = getAsrVoiceAiDefaultsCached(activeScriptId).defaults || {};
    const stageDefaults = getBytedanceAidpSuzhouStageDefaults(aiDefaults, activeScriptId);
    const hasAiSettingsPanel = Boolean(getElement("bytedance-aidp-ai-timeout"));
    ensureBytedanceAidpShortcutDraft();
    const shortcuts = {};
    bytedanceAidpShortcutActions.forEach(function (action) {
      shortcuts[action.key] = normalizeNullableShortcut(bytedanceAidpShortcutsDraft[action.key]);
    });
    const segmentContextPaddingMs = normalizeBytedanceAidpSegmentContextPaddingMs(
      Number(getElement("bytedance-aidp-segment-context-padding-seconds")?.value || 0) * 1000,
      currentConfig.segmentContextPaddingMs
    );
    const segmentSilenceThresholdDbfs = normalizeBytedanceAidpSegmentSilenceThresholdDbfs(
      getElement("bytedance-aidp-segment-silence-threshold-dbfs")?.value,
      currentConfig.segmentSilenceThresholdDbfs
    );
    const mergeContiguousSuggestedSegmentsEnabled =
      getElement("bytedance-aidp-merge-contiguous-suggested-segments-enabled")?.checked !== false;
    const segmentPreviewAutoApplyEnabled =
      getElement("bytedance-aidp-segment-preview-auto-apply-enabled")?.checked !== false;
    const defaultPlaybackRate = normalizeBytedanceAidpPlaybackRate(
      getElement("bytedance-aidp-default-playback-rate")?.value,
      currentConfig.defaultPlaybackRate
    );
    const fixedWaveZoom = normalizeBytedanceAidpFixedWaveZoom(
      getElement("bytedance-aidp-fixed-wave-zoom")?.value,
      currentConfig.fixedWaveZoom
    );
    const aiEnabledNode = getElement("bytedance-aidp-ai-enabled");
    const aiRecommendEnabled =
      aiEnabledNode instanceof HTMLInputElement
        ? aiEnabledNode.checked !== false
        : currentConfig.aiRecommendEnabled !== false;
    const aiRecommendAutoFillEnabled = hasAiSettingsPanel
      ? getElement("bytedance-aidp-ai-recommend-auto-fill-enabled")?.checked !== false
      : currentConfig.aiRecommendAutoFillEnabled !== false;
    const timeoutInput = hasAiSettingsPanel
      ? getElement("bytedance-aidp-ai-timeout")?.value
      : String(currentConfig.aiRecommendRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS);
    const timeoutMs = hasAiSettingsPanel
      ? normalizeBytedanceAidpTimeoutSecondsToMs(timeoutInput)
      : Math.min(
          DEFAULT_AI_REQUEST_TIMEOUT_MS,
          normalizeDataBakerTimeoutMs(timeoutInput)
        );
    const draftConfig = hasAiSettingsPanel
      ? getBytedanceAidpSuzhouSettingsDraftConfig(aiDefaults, activeScriptId, currentConfig)
      : {
          aiRecommendModelMode: currentConfig.aiRecommendModelMode,
          aiRecommendListenModel: currentConfig.aiRecommendListenModel,
          aiRecommendListenPrompt: currentConfig.aiRecommendListenPrompt,
          aiRecommendRefineModel: currentConfig.aiRecommendRefineModel,
          aiRecommendRefinePrompt: currentConfig.aiRecommendRefinePrompt,
          aiRecommendListenTemperature: currentConfig.aiRecommendListenTemperature,
          aiRecommendListenTopP: currentConfig.aiRecommendListenTopP,
          aiRecommendListenMaxTokens: currentConfig.aiRecommendListenMaxTokens,
          aiRecommendListenMaxCompletionTokens:
            currentConfig.aiRecommendListenMaxCompletionTokens,
          aiRecommendListenPresencePenalty: currentConfig.aiRecommendListenPresencePenalty,
          aiRecommendListenFrequencyPenalty: currentConfig.aiRecommendListenFrequencyPenalty,
          aiRecommendListenSeed: currentConfig.aiRecommendListenSeed,
          aiRecommendListenStopSequences: currentConfig.aiRecommendListenStopSequences,
          aiRecommendRefineTemperature: currentConfig.aiRecommendRefineTemperature,
          aiRecommendRefineTopP: currentConfig.aiRecommendRefineTopP,
          aiRecommendRefineMaxTokens: currentConfig.aiRecommendRefineMaxTokens,
          aiRecommendRefineMaxCompletionTokens:
            currentConfig.aiRecommendRefineMaxCompletionTokens,
          aiRecommendRefinePresencePenalty: currentConfig.aiRecommendRefinePresencePenalty,
          aiRecommendRefineFrequencyPenalty: currentConfig.aiRecommendRefineFrequencyPenalty,
          aiRecommendRefineSeed: currentConfig.aiRecommendRefineSeed,
          aiRecommendRefineStopSequences: currentConfig.aiRecommendRefineStopSequences,
        };
    const normalizeOverridePrompt = function (value, defaultValue) {
      const normalizedValue = normalizePromptText(value || "");
      const normalizedDefault = normalizePromptText(defaultValue || "");
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const normalizeOverrideNumber = function (value, defaultValue, min, max, precision) {
      const normalizedValue = normalizeOptionalNumberText(value, min, max, precision);
      const normalizedDefault = normalizeOptionalNumberText(defaultValue, min, max, precision);
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const normalizeOverrideInteger = function (value, defaultValue, min, max) {
      const normalizedValue = normalizeOptionalIntegerText(value, min, max);
      const normalizedDefault = normalizeOptionalIntegerText(defaultValue, min, max);
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const readStageOverrides = function (configPrefix, stageKey) {
      const stageDefault = stageDefaults[stageKey] || {};
      const overrides = {};
      aishellTechStageParamDefinitions.forEach(function (definition) {
        const fieldName = configPrefix + definition.suffix;
        const defaultValue = stageDefault[definition.apiKey];
        if (definition.type === "number") {
          overrides[fieldName] = normalizeOverrideNumber(
            draftConfig[fieldName],
            defaultValue,
            definition.min,
            definition.max,
            definition.precision
          );
          return;
        }
        if (definition.type === "integer") {
          overrides[fieldName] = normalizeOverrideInteger(
            draftConfig[fieldName],
            defaultValue,
            definition.min,
            definition.max
          );
          return;
        }
        const normalizedValue = normalizeStopSequencesText(draftConfig[fieldName] || "");
        const normalizedDefault = normalizeStopSequencesText(defaultValue || "");
        overrides[fieldName] =
          normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
      });
      return overrides;
    };
    const listenOverrides = readStageOverrides("aiRecommendListen", "listen");
    const refineOverrides = readStageOverrides("aiRecommendRefine", "refine");
    const aiRecommendPath = meta.aiRecommendPath;

    setStatus("bytedance-aidp-status", "正在保存设置...");

    try {
      const nextScriptPatch = {};
      nextScriptPatch[meta.scriptKey] = {
        id: activeScriptId,
        platformAiEnabled:
          !getElement("bytedance-aidp-platform-ai-enabled").checked,
        segmentContextPaddingMs: segmentContextPaddingMs,
        segmentSilenceThresholdDbfs: segmentSilenceThresholdDbfs,
        mergeContiguousSuggestedSegmentsEnabled:
          mergeContiguousSuggestedSegmentsEnabled,
        segmentPreviewAutoApplyEnabled: segmentPreviewAutoApplyEnabled,
        aiRecommendAutoFillEnabled: aiRecommendAutoFillEnabled,
        aiRecommendEnabled: aiRecommendEnabled,
        aiRecommendEndpoint: buildBackendUrl(aiRecommendPath, currentSettings || {}),
        aiRecommendRequestTimeoutMs: timeoutMs,
        aiRecommendModelMode:
          activeScriptId === bytedanceAidpJinhuaScriptId
            ? normalizeBytedanceAidpJinhuaModelMode(draftConfig.aiRecommendModelMode, "two_stage")
            : undefined,
        aiRecommendListenModel:
          draftConfig.aiRecommendListenModel !== stageDefaults.listen.model
            ? draftConfig.aiRecommendListenModel
            : "",
        aiRecommendListenPrompt: normalizeOverridePrompt(
          draftConfig.aiRecommendListenPrompt,
          stageDefaults.listen.prompt
        ),
        aiRecommendListenTemperature: listenOverrides.aiRecommendListenTemperature,
        aiRecommendListenTopP: listenOverrides.aiRecommendListenTopP,
        aiRecommendListenMaxTokens: listenOverrides.aiRecommendListenMaxTokens,
        aiRecommendListenMaxCompletionTokens:
          listenOverrides.aiRecommendListenMaxCompletionTokens,
        aiRecommendListenPresencePenalty:
          listenOverrides.aiRecommendListenPresencePenalty,
        aiRecommendListenFrequencyPenalty:
          listenOverrides.aiRecommendListenFrequencyPenalty,
        aiRecommendListenSeed: listenOverrides.aiRecommendListenSeed,
        aiRecommendListenStopSequences: listenOverrides.aiRecommendListenStopSequences,
        aiRecommendRefineModel:
          draftConfig.aiRecommendRefineModel !== stageDefaults.refine.model
            ? draftConfig.aiRecommendRefineModel
            : "",
        aiRecommendRefinePrompt: normalizeOverridePrompt(
          draftConfig.aiRecommendRefinePrompt,
          stageDefaults.refine.prompt
        ),
        aiRecommendRefineTemperature: refineOverrides.aiRecommendRefineTemperature,
        aiRecommendRefineTopP: refineOverrides.aiRecommendRefineTopP,
        aiRecommendRefineMaxTokens: refineOverrides.aiRecommendRefineMaxTokens,
        aiRecommendRefineMaxCompletionTokens:
          refineOverrides.aiRecommendRefineMaxCompletionTokens,
        aiRecommendRefinePresencePenalty:
          refineOverrides.aiRecommendRefinePresencePenalty,
        aiRecommendRefineFrequencyPenalty:
          refineOverrides.aiRecommendRefineFrequencyPenalty,
        aiRecommendRefineSeed: refineOverrides.aiRecommendRefineSeed,
        aiRecommendRefineStopSequences: refineOverrides.aiRecommendRefineStopSequences,
        defaultPlaybackRate: defaultPlaybackRate,
        fixedWaveZoom: fixedWaveZoom,
        contractMode: "dom-guarded",
        shortcuts: shortcuts,
      };
      if (activeScriptId !== bytedanceAidpJinhuaScriptId) {
        delete nextScriptPatch[meta.scriptKey].aiRecommendModelMode;
      }
      currentSettings = await storage.patchSettings({
        platforms: {
          bytedanceAidp: {
            scripts: nextScriptPatch,
          },
        },
      });
      persistPendingTopToast("设置已保存，脚本设置页已刷新。", "success", 1000);
      showTopToast("设置已保存，脚本设置页已刷新。", "success", 1000);
      if (typeof globalThis.setTimeout === "function") {
        globalThis.setTimeout(function () {
          reloadOptionsPage();
        }, 120);
      } else {
        reloadOptionsPage();
      }
      return true;
    } catch (error) {
      setStatus(
        "bytedance-aidp-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  async function saveBytedanceAidpJinhuaSettings() {
    return saveBytedanceAidpSettings(bytedanceAidpJinhuaScriptId);
  }

  async function saveAishellTechMinnanSettings() {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("aishell-tech-status", "当前扩展版本不支持保存希尔贝壳设置。");
      return false;
    }

    const currentConfig = getAishellTechMinnanConfig(currentSettings || {});
    const aiDefaults = getAsrVoiceAiDefaultsCached(aishellTechMinnanScriptId).defaults || {};
    const stageDefaults = getAishellTechStageDefaults(aiDefaults);
    const hasAiSettingsPanel = Boolean(getElement("aishell-tech-ai-timeout"));
    const timeoutInput = hasAiSettingsPanel
      ? getElement("aishell-tech-ai-timeout").value
      : String(currentConfig.aiRecommendRequestTimeoutMs);
    const aiRecommendEnabled = hasAiSettingsPanel
      ? getElement("aishell-tech-ai-recommend-enabled").checked
      : currentConfig.aiRecommendEnabled !== false;
    const timeoutMs = normalizeDataBakerTimeoutMs(timeoutInput);
    const draftConfig = hasAiSettingsPanel
      ? getAishellTechSettingsDraftConfig(aiDefaults)
      : currentConfig;
    const autofillConcurrency = normalizeDataBakerAutofillConcurrency(
      getElement("aishell-tech-qualified-autofill-concurrency")?.value,
      getAishellTechConcurrencyModelConfig(draftConfig)
    );
    updateAishellTechAutofillConcurrencyField(
      Object.assign({}, draftConfig, {
        aiQualifiedAutofillConcurrency: autofillConcurrency,
      })
    );
    const normalizeOverridePrompt = function (value, defaultValue) {
      const normalizedValue = normalizePromptText(value || "");
      const normalizedDefault = normalizePromptText(defaultValue || "");
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const normalizeOverrideNumber = function (value, defaultValue, min, max, precision) {
      const normalizedValue = normalizeOptionalNumberText(value, min, max, precision);
      const normalizedDefault = normalizeOptionalNumberText(defaultValue, min, max, precision);
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const normalizeOverrideInteger = function (value, defaultValue, min, max) {
      const normalizedValue = normalizeOptionalIntegerText(value, min, max);
      const normalizedDefault = normalizeOptionalIntegerText(defaultValue, min, max);
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const normalizeOverrideThreshold = function (value, defaultValue) {
      const normalizedValue = normalizeOptionalNumberText(value, 0, 1, 3);
      const normalizedDefault = normalizeOptionalNumberText(defaultValue, 0, 1, 3);
      return normalizedValue && normalizedValue !== normalizedDefault ? Number(normalizedValue) : "";
    };
    const readStageOverrides = function (configPrefix, stageKey) {
      const stageDefault = stageDefaults[stageKey] || {};
      const overrides = {};
      aishellTechStageParamDefinitions.forEach(function (definition) {
        const fieldName = configPrefix + definition.suffix;
        const defaultValue = stageDefault[definition.apiKey];
        if (definition.type === "number") {
          overrides[fieldName] = normalizeOverrideNumber(
            draftConfig[fieldName],
            defaultValue,
            definition.min,
            definition.max,
            definition.precision
          );
          return;
        }
        if (definition.type === "integer") {
          overrides[fieldName] = normalizeOverrideInteger(
            draftConfig[fieldName],
            defaultValue,
            definition.min,
            definition.max
          );
          return;
        }
        const normalizedValue = normalizeStopSequencesText(draftConfig[fieldName] || "");
        const normalizedDefault = normalizeStopSequencesText(defaultValue || "");
        overrides[fieldName] =
          normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
      });
      return overrides;
    };
    const convertOverrides = readStageOverrides("aiRecommendConvert", "convert");
    const listenOverrides = readStageOverrides("aiRecommendListen", "listen");
    const compareOverrides = readStageOverrides("aiRecommendCompare", "compare");
    const enableThinking = false;
    const shortcuts = {};

    ensureAishellTechShortcutDraft();
    getAishellTechShortcutActions(aishellTechMinnanScriptId).forEach(function (action) {
      shortcuts[action.key] = normalizeNullableShortcut(aishellTechShortcutsDraft[action.key]);
    });

    setStatus("aishell-tech-status", "正在保存希尔贝壳设置...");

    try {
      currentSettings = await storage.patchSettings({
        platforms: {
          aishellTech: {
            enabled: true,
            scripts: {
              minnanHelper: {
                id: aishellTechMinnanScriptId,
                aiRecommendEnabled: aiRecommendEnabled,
                aiRecommendRequestTimeoutMs: timeoutMs,
                aiRecommendConvertModel: draftConfig.aiRecommendConvertModel,
                aiRecommendConvertPrompt: normalizeOverridePrompt(
                  draftConfig.aiRecommendConvertPrompt,
                  stageDefaults.convert.prompt
                ),
                aiRecommendConvertTemperature: convertOverrides.aiRecommendConvertTemperature,
                aiRecommendConvertTopP: convertOverrides.aiRecommendConvertTopP,
                aiRecommendConvertMaxTokens: convertOverrides.aiRecommendConvertMaxTokens,
                aiRecommendConvertMaxCompletionTokens:
                  convertOverrides.aiRecommendConvertMaxCompletionTokens,
                aiRecommendConvertPresencePenalty:
                  convertOverrides.aiRecommendConvertPresencePenalty,
                aiRecommendConvertFrequencyPenalty:
                  convertOverrides.aiRecommendConvertFrequencyPenalty,
                aiRecommendConvertSeed: convertOverrides.aiRecommendConvertSeed,
                aiRecommendConvertStopSequences:
                  convertOverrides.aiRecommendConvertStopSequences,
                aiRecommendListenModel: draftConfig.aiRecommendListenModel,
                aiRecommendListenPrompt: normalizeOverridePrompt(
                  draftConfig.aiRecommendListenPrompt,
                  stageDefaults.listen.prompt
                ),
                aiRecommendListenTemperature: listenOverrides.aiRecommendListenTemperature,
                aiRecommendListenTopP: listenOverrides.aiRecommendListenTopP,
                aiRecommendListenMaxTokens: listenOverrides.aiRecommendListenMaxTokens,
                aiRecommendListenMaxCompletionTokens:
                  listenOverrides.aiRecommendListenMaxCompletionTokens,
                aiRecommendListenPresencePenalty:
                  listenOverrides.aiRecommendListenPresencePenalty,
                aiRecommendListenFrequencyPenalty:
                  listenOverrides.aiRecommendListenFrequencyPenalty,
                aiRecommendListenSeed: listenOverrides.aiRecommendListenSeed,
                aiRecommendListenStopSequences:
                  listenOverrides.aiRecommendListenStopSequences,
                aiRecommendCompareFamily: draftConfig.aiRecommendCompareFamily,
                aiRecommendCompareModel: draftConfig.aiRecommendCompareModel,
                aiRecommendCompareQwenPrompt: normalizeOverridePrompt(
                  draftConfig.aiRecommendCompareQwenPrompt,
                  stageDefaults.compare.qwenPrompt
                ),
                aiRecommendCompareOmniPrompt: normalizeOverridePrompt(
                  draftConfig.aiRecommendCompareOmniPrompt,
                  stageDefaults.compare.omniPrompt
                ),
                aiRecommendCompareTemperature: compareOverrides.aiRecommendCompareTemperature,
                aiRecommendCompareTopP: compareOverrides.aiRecommendCompareTopP,
                aiRecommendCompareMaxTokens: compareOverrides.aiRecommendCompareMaxTokens,
                aiRecommendCompareMaxCompletionTokens:
                  compareOverrides.aiRecommendCompareMaxCompletionTokens,
                aiRecommendComparePresencePenalty:
                  compareOverrides.aiRecommendComparePresencePenalty,
                aiRecommendCompareFrequencyPenalty:
                  compareOverrides.aiRecommendCompareFrequencyPenalty,
                aiRecommendCompareSeed: compareOverrides.aiRecommendCompareSeed,
                aiRecommendCompareStopSequences:
                  compareOverrides.aiRecommendCompareStopSequences,
                aiRecommendCompareAdoptionThreshold: normalizeOverrideThreshold(
                  draftConfig.aiRecommendCompareAdoptionThreshold,
                  stageDefaults.compare.adoptionThreshold
                ),
                aiRecommendEnableThinking: enableThinking,
                aiQualifiedAutofillConcurrency: autofillConcurrency,
                aiRecommendPipelineMode: "",
                aiRecommendRecognitionStrategy: "",
                aiRecommendCandidateModel: "",
                aiRecommendSingleModel: "",
                aiRecommendCandidatePrompt: "",
                aiRecommendComparePrompt: "",
                aiRecommendTemperature: "",
                aiRecommendTopP: "",
                aiRecommendMaxTokens: "",
                aiRecommendMaxCompletionTokens: "",
                aiRecommendPresencePenalty: "",
                aiRecommendFrequencyPenalty: "",
                aiRecommendSeed: "",
                aiRecommendStopSequences: "",
                aiRecommendAudioFirstReferenceCorrectionThreshold: "",
                shortcuts: shortcuts,
              },
            },
          },
        },
      });
      applyAishellTechMinnanForm(currentSettings);
      setStatus(
        "aishell-tech-status",
        "希尔贝壳设置已保存；已打开的标注页请刷新或等待自动同步。"
      );
      return true;
    } catch (error) {
      setStatus(
        "aishell-tech-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  async function saveAishellTechVietnameseSettings() {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("aishell-tech-vietnamese-status", "当前扩展版本不支持保存希尔贝壳设置。");
      return false;
    }

    const currentConfig = getAishellTechVietnameseConfig(currentSettings || {});
    const aiDefaults = getAsrVoiceAiDefaultsCached(aishellTechVietnameseScriptId).defaults || {};
    const hasAiSettingsPanel = Boolean(getElement("aishell-tech-ai-timeout"));
    const timeoutInput = hasAiSettingsPanel
      ? getElement("aishell-tech-ai-timeout").value
      : String(currentConfig.aiRecommendRequestTimeoutMs);
    const aiRecommendEnabled = hasAiSettingsPanel
      ? getElement("aishell-tech-ai-recommend-enabled").checked
      : currentConfig.aiRecommendEnabled !== false;
    const timeoutMs = normalizeDataBakerTimeoutMs(timeoutInput);
    const singleModel = hasAiSettingsPanel
      ? normalizeDataBakerSingleModel(
          getElement("aishell-tech-ai-single-model-select")?.value,
          String(aiDefaults.singleModel || "qwen3.5-omni-flash")
        )
      : currentConfig.aiRecommendSingleModel;
    const promptDraft = hasAiSettingsPanel
      ? normalizePromptText(getElement("aishell-tech-ai-single-prompt")?.value || "")
      : currentConfig.aiRecommendSinglePrompt;
    const autofillConcurrency = normalizeDataBakerAutofillConcurrency(
      getElement("aishell-tech-qualified-autofill-concurrency")?.value,
      {
        aiRecommendPipelineMode: "omni_single",
        aiRecommendSingleModel: singleModel,
      }
    );
    updateAishellTechAutofillConcurrencyField(
      {
        aiRecommendPipelineMode: "omni_single",
        aiRecommendSingleModel: singleModel,
        aiQualifiedAutofillConcurrency: autofillConcurrency,
      },
      {
        scriptId: aishellTechVietnameseScriptId,
      }
    );
    const normalizeOverridePrompt = function (value, defaultValue) {
      const normalizedValue = normalizePromptText(value || "");
      const normalizedDefault = normalizePromptText(defaultValue || "");
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const readStageOverrides = function () {
      const overrides = {};
      aishellTechStageParamDefinitions.forEach(function (definition) {
        const fieldName = "aiRecommend" + definition.suffix;
        const defaultValue = aiDefaults[definition.apiKey];
        if (definition.type === "number") {
          const normalizedValue = normalizeOptionalNumberText(
            getElement("aishell-tech-ai-single-" + definition.domSuffix)?.value,
            definition.min,
            definition.max,
            definition.precision
          );
          const normalizedDefault = normalizeOptionalNumberText(
            defaultValue,
            definition.min,
            definition.max,
            definition.precision
          );
          overrides[fieldName] =
            normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
          return;
        }
        if (definition.type === "integer") {
          const normalizedValue = normalizeOptionalIntegerText(
            getElement("aishell-tech-ai-single-" + definition.domSuffix)?.value,
            definition.min,
            definition.max
          );
          const normalizedDefault = normalizeOptionalIntegerText(
            defaultValue,
            definition.min,
            definition.max
          );
          overrides[fieldName] =
            normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
          return;
        }
        const normalizedValue = normalizeStopSequencesText(
          getElement("aishell-tech-ai-single-" + definition.domSuffix)?.value || ""
        );
        const normalizedDefault = normalizeStopSequencesText(defaultValue || "");
        overrides[fieldName] =
          normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
      });
      return overrides;
    };
    const stageOverrides = readStageOverrides();
    const shortcuts = {};
    ensureAishellTechShortcutDraft();
    getAishellTechShortcutActions(aishellTechVietnameseScriptId).forEach(function (action) {
      shortcuts[action.key] = normalizeNullableShortcut(aishellTechShortcutsDraft[action.key]);
    });

    setStatus("aishell-tech-vietnamese-status", "正在保存希尔贝壳设置...");

    try {
      currentSettings = await storage.patchSettings({
        platforms: {
          aishellTech: {
            enabled: true,
            activeScriptId: aishellTechVietnameseScriptId,
            scripts: {
              vietnameseHelper: {
                id: aishellTechVietnameseScriptId,
                aiRecommendEnabled: aiRecommendEnabled,
                aiRecommendRequestTimeoutMs: timeoutMs,
                aiRecommendSingleModel: singleModel,
                aiRecommendSinglePrompt: normalizeOverridePrompt(
                  promptDraft,
                  aiDefaults.singlePrompt
                ),
                aiRecommendTemperature: stageOverrides.aiRecommendTemperature,
                aiRecommendTopP: stageOverrides.aiRecommendTopP,
                aiRecommendMaxTokens: stageOverrides.aiRecommendMaxTokens,
                aiRecommendMaxCompletionTokens:
                  stageOverrides.aiRecommendMaxCompletionTokens,
                aiRecommendPresencePenalty:
                  stageOverrides.aiRecommendPresencePenalty,
                aiRecommendFrequencyPenalty:
                  stageOverrides.aiRecommendFrequencyPenalty,
                aiRecommendSeed: stageOverrides.aiRecommendSeed,
                aiRecommendStopSequences: stageOverrides.aiRecommendStopSequences,
                aiRecommendEnableThinking: false,
                aiQualifiedAutofillConcurrency: autofillConcurrency,
                shortcuts: shortcuts,
              },
            },
          },
        },
      });
      applyAishellTechVietnameseForm(currentSettings);
      setStatus(
        "aishell-tech-vietnamese-status",
        "希尔贝壳设置已保存；已打开的标注页请刷新或等待自动同步。"
      );
      return true;
    } catch (error) {
      setStatus(
        "aishell-tech-vietnamese-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  async function saveAishellTechThaiSettings() {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("aishell-tech-thai-status", "当前扩展版本不支持保存希尔贝壳设置。");
      return false;
    }

    const currentConfig = getAishellTechThaiConfig(currentSettings || {});
    const aiDefaults = getAsrVoiceAiDefaultsCached(aishellTechThaiScriptId).defaults || {};
    const hasAiSettingsPanel = Boolean(getElement("aishell-tech-ai-timeout"));
    const timeoutInput = hasAiSettingsPanel
      ? getElement("aishell-tech-ai-timeout").value
      : String(currentConfig.aiRecommendRequestTimeoutMs);
    const aiRecommendEnabled = hasAiSettingsPanel
      ? getElement("aishell-tech-ai-recommend-enabled").checked
      : currentConfig.aiRecommendEnabled !== false;
    const timeoutMs = normalizeDataBakerTimeoutMs(timeoutInput);
    const singleModel = hasAiSettingsPanel
      ? normalizeDataBakerSingleModel(
          getElement("aishell-tech-ai-single-model-select")?.value,
          String(aiDefaults.singleModel || "qwen3.5-omni-flash")
        )
      : currentConfig.aiRecommendSingleModel;
    const promptDraft = hasAiSettingsPanel
      ? normalizePromptText(getElement("aishell-tech-ai-single-prompt")?.value || "")
      : currentConfig.aiRecommendSinglePrompt;
    const autofillConcurrency = normalizeDataBakerAutofillConcurrency(
      getElement("aishell-tech-qualified-autofill-concurrency")?.value,
      {
        aiRecommendPipelineMode: "omni_single",
        aiRecommendSingleModel: singleModel,
      }
    );
    updateAishellTechAutofillConcurrencyField(
      {
        aiRecommendPipelineMode: "omni_single",
        aiRecommendSingleModel: singleModel,
        aiQualifiedAutofillConcurrency: autofillConcurrency,
      },
      {
        scriptId: aishellTechThaiScriptId,
      }
    );
    const normalizeOverridePrompt = function (value, defaultValue) {
      const normalizedValue = normalizePromptText(value || "");
      const normalizedDefault = normalizePromptText(defaultValue || "");
      return normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
    };
    const readStageOverrides = function () {
      const overrides = {};
      aishellTechStageParamDefinitions.forEach(function (definition) {
        const fieldName = "aiRecommend" + definition.suffix;
        const defaultValue = aiDefaults[definition.apiKey];
        if (definition.type === "number") {
          const normalizedValue = normalizeOptionalNumberText(
            getElement("aishell-tech-ai-single-" + definition.domSuffix)?.value,
            definition.min,
            definition.max,
            definition.precision
          );
          const normalizedDefault = normalizeOptionalNumberText(
            defaultValue,
            definition.min,
            definition.max,
            definition.precision
          );
          overrides[fieldName] =
            normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
          return;
        }
        if (definition.type === "integer") {
          const normalizedValue = normalizeOptionalIntegerText(
            getElement("aishell-tech-ai-single-" + definition.domSuffix)?.value,
            definition.min,
            definition.max
          );
          const normalizedDefault = normalizeOptionalIntegerText(
            defaultValue,
            definition.min,
            definition.max
          );
          overrides[fieldName] =
            normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
          return;
        }
        const normalizedValue = normalizeStopSequencesText(
          getElement("aishell-tech-ai-single-" + definition.domSuffix)?.value || ""
        );
        const normalizedDefault = normalizeStopSequencesText(defaultValue || "");
        overrides[fieldName] =
          normalizedValue && normalizedValue !== normalizedDefault ? normalizedValue : "";
      });
      return overrides;
    };
    const stageOverrides = readStageOverrides();
    const shortcuts = {};
    ensureAishellTechShortcutDraft();
    getAishellTechShortcutActions(aishellTechThaiScriptId).forEach(function (action) {
      shortcuts[action.key] = normalizeNullableShortcut(aishellTechShortcutsDraft[action.key]);
    });

    setStatus("aishell-tech-thai-status", "正在保存希尔贝壳设置...");

    try {
      currentSettings = await storage.patchSettings({
        platforms: {
          aishellTech: {
            enabled: true,
            activeScriptId: aishellTechThaiScriptId,
            scripts: {
              thaiHelper: {
                id: aishellTechThaiScriptId,
                aiRecommendEnabled: aiRecommendEnabled,
                aiRecommendRequestTimeoutMs: timeoutMs,
                aiRecommendSingleModel: singleModel,
                aiRecommendSinglePrompt: normalizeOverridePrompt(
                  promptDraft,
                  aiDefaults.singlePrompt
                ),
                aiRecommendTemperature: stageOverrides.aiRecommendTemperature,
                aiRecommendTopP: stageOverrides.aiRecommendTopP,
                aiRecommendMaxTokens: stageOverrides.aiRecommendMaxTokens,
                aiRecommendMaxCompletionTokens:
                  stageOverrides.aiRecommendMaxCompletionTokens,
                aiRecommendPresencePenalty:
                  stageOverrides.aiRecommendPresencePenalty,
                aiRecommendFrequencyPenalty:
                  stageOverrides.aiRecommendFrequencyPenalty,
                aiRecommendSeed: stageOverrides.aiRecommendSeed,
                aiRecommendStopSequences: stageOverrides.aiRecommendStopSequences,
                aiRecommendEnableThinking: false,
                aiQualifiedAutofillConcurrency: autofillConcurrency,
                shortcuts: shortcuts,
              },
            },
          },
        },
      });
      applyAishellTechThaiForm(currentSettings);
      setStatus(
        "aishell-tech-thai-status",
        "希尔贝壳设置已保存；已打开的标注页请刷新或等待自动同步。"
      );
      return true;
    } catch (error) {
      setStatus(
        "aishell-tech-thai-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  async function saveAishellTechCantoneseSettings() {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("aishell-tech-cantonese-status", "当前扩展版本不支持保存希尔贝壳设置。");
      return false;
    }
    const config = getAishellTechCantoneseConfig(currentSettings || {});
    const aiDefaults = getAsrVoiceAiDefaultsCached(aishellTechCantoneseScriptId).defaults || {};
    const prompt =
      normalizePromptText(getElement("aishell-tech-ai-single-prompt")?.value || "") ||
      normalizePromptText(aiDefaults.singlePrompt) ||
      config.aiRecommendSinglePrompt;
    const model = normalizeDataBakerSingleModel(
      getElement("aishell-tech-ai-single-model-select")?.value,
      "qwen3.5-omni-plus"
    );
    const stageOverrides = {};
    aishellTechStageParamDefinitions.forEach(function (definition) {
      const value = getElement("aishell-tech-ai-single-" + definition.domSuffix)?.value || "";
      const key = "aiRecommend" + definition.suffix;
      if (definition.type === "number") {
        stageOverrides[key] = normalizeOptionalNumberText(value, definition.min, definition.max, definition.precision);
      } else if (definition.type === "integer") {
        stageOverrides[key] = normalizeOptionalIntegerText(value, definition.min, definition.max);
      } else {
        stageOverrides[key] = normalizeStopSequencesText(value);
      }
    });
    const shortcuts = {};
    ensureAishellTechShortcutDraft();
    getAishellTechShortcutActions(aishellTechCantoneseScriptId).forEach(function (action) {
      shortcuts[action.key] = normalizeNullableShortcut(aishellTechShortcutsDraft[action.key]);
    });
    const aiRecommendEnabled = getElement("aishell-tech-ai-recommend-enabled")?.checked === true;
    const timeoutMs = DEFAULT_AI_REQUEST_TIMEOUT_MS;
    const aiQualifiedAutofillConcurrency = normalizeDataBakerAutofillConcurrency(
      getElement("aishell-tech-qualified-autofill-concurrency")?.value,
      { aiRecommendPipelineMode: "omni_single", aiRecommendSingleModel: model }
    );
    setStatus("aishell-tech-cantonese-status", "正在保存希尔贝壳粤语设置...");
    try {
      currentSettings = await storage.patchSettings({
        platforms: {
          aishellTech: {
            enabled: true,
            activeScriptId: aishellTechCantoneseScriptId,
            scripts: {
              cantoneseHelper: Object.assign(
                {
                  id: aishellTechCantoneseScriptId,
                  aiRecommendEnabled,
                  aiRecommendRequestTimeoutMs: timeoutMs,
                  aiRecommendSingleModel: model,
                  aiRecommendSinglePrompt: prompt,
                  aiRecommendEnableThinking: false,
                  aiQualifiedAutofillConcurrency,
                  shortcuts,
                },
                stageOverrides
              ),
            },
          },
        },
      });
      applyAishellTechCantoneseForm(currentSettings);
      setStatus("aishell-tech-cantonese-status", "希尔贝壳粤语设置已保存。");
      return true;
    } catch (error) {
      setStatus("aishell-tech-cantonese-status", "保存失败：" + (error?.message || String(error)));
      return false;
    }
  }

  async function saveJdTtsShanghaineseSettings() {
    if (!storage || typeof storage.patchSettings !== "function") {
      setStatus("jd-tts-shanghainese-status", "当前扩展版本不支持保存京东 TTS 上海话设置。");
      return false;
    }
    const config = getJdTtsShanghaineseConfig(currentSettings || {});
    const aiDefaults = getAsrVoiceAiDefaultsCached(jdTtsShanghaineseScriptId).defaults || {};
    const model = normalizeDataBakerSingleModel(
      getElement("jd-tts-ai-single-model-select")?.value,
      "qwen3.5-omni-plus"
    );
    const prompt = normalizePromptText(getElement("jd-tts-ai-single-prompt")?.value || "");
    const stageOverrides = {};
    aishellTechStageParamDefinitions.forEach(function (definition) {
      const value = getElement("jd-tts-ai-single-" + definition.domSuffix)?.value || "";
      const key = "aiRecommend" + definition.suffix;
      if (definition.type === "number") {
        stageOverrides[key] = normalizeOptionalNumberText(value, definition.min, definition.max, definition.precision);
      } else if (definition.type === "integer") {
        stageOverrides[key] = normalizeOptionalIntegerText(value, definition.min, definition.max);
      } else {
        stageOverrides[key] = normalizeStopSequencesText(value);
      }
    });
    setStatus("jd-tts-shanghainese-status", "正在保存京东 TTS 上海话设置...");
    try {
      currentSettings = await storage.patchSettings({
        platforms: {
          jdTtsAnnotation: {
            enabled: true,
            activeScriptId: jdTtsShanghaineseScriptId,
            scripts: {
              shanghaineseHelper: Object.assign(
                {
                  id: jdTtsShanghaineseScriptId,
                  enabled: true,
                  aiRecommendEnabled: getElement("jd-tts-ai-recommend-enabled")?.checked === true,
                  aiRecommendRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
                  aiRecommendSingleModel: model,
                  aiRecommendSinglePrompt: prompt,
                  aiRecommendEnableThinking: false,
                },
                stageOverrides
              ),
            },
          },
        },
      });
      applyJdTtsShanghaineseForm(currentSettings);
      setStatus("jd-tts-shanghainese-status", "京东 TTS 上海话设置已保存。");
      return true;
    } catch (error) {
      setStatus("jd-tts-shanghainese-status", "保存失败：" + (error?.message || String(error)));
      return false;
    }
  }

  async function saveAishellTechSettings(scriptId) {
    const resolvedScriptId = scriptId || getCurrentDetailScriptId();
    return isAishellTechVietnameseScript(resolvedScriptId)
      ? saveAishellTechVietnameseSettings()
      : isAishellTechThaiScript(resolvedScriptId)
        ? saveAishellTechThaiSettings()
        : isAishellTechCantoneseScript(resolvedScriptId)
          ? saveAishellTechCantoneseSettings()
        : saveAishellTechMinnanSettings();
  }

  function setStatus(targetId, text) {
    const node = getElement(targetId);
    if (node) {
      node.textContent = text || "";
    }
  }

  function showTopToast(message, tone, durationMs) {
    if (typeof document === "undefined" || !document.body) {
      return;
    }
    let node = getElement("top-toast");
    if (!node) {
      node = document.createElement("div");
      node.id = "top-toast";
      node.className = "top-toast";
      document.body.appendChild(node);
    }
    if (topToastHideTimer && typeof clearTimeout === "function") {
      clearTimeout(topToastHideTimer);
      topToastHideTimer = null;
    }
    const normalizedMessage = String(message || "").trim();
    if (!normalizedMessage) {
      node.classList.remove("visible");
      node.textContent = "";
      node.removeAttribute("data-tone");
      return;
    }
    node.textContent = normalizedMessage;
    node.setAttribute("data-tone", normalizeText(tone) || "info");
    node.classList.add("visible");
    const hideDelay = Math.max(0, Math.round(Number(durationMs || 0) || 0));
    if (hideDelay <= 0 || typeof setTimeout !== "function") {
      return;
    }
    topToastHideTimer = setTimeout(function () {
      node.classList.remove("visible");
      node.textContent = "";
      node.removeAttribute("data-tone");
      topToastHideTimer = null;
    }, hideDelay);
  }

  async function loadSettings() {
    if (!storage || typeof storage.getSettings !== "function") {
      throw new Error("扩展存储不可用。");
    }

    currentSettings = await storage.getSettings();
    resetAdminBackendDraft(currentSettings);
    return currentSettings;
  }

  async function toggleScript(scriptId, enabled) {
    if (!storage) {
      setStatus("detail-status", "当前扩展版本不支持脚本启停。");
      return;
    }
    if (!isScriptVisibleByRelease(scriptId, currentSettings || {})) {
      setStatus("detail-status", "当前版本不允许显示该脚本。");
      return;
    }

    const script = scriptLibrary[scriptId] || {};
    const targetStatus = enabled ? "启用" : "关闭";
    setStatus("detail-status", "正在" + targetStatus + " " + String(script.label || scriptId) + "...");

    try {
      if (typeof storage.setScriptEnabled === "function") {
        currentSettings = await storage.setScriptEnabled(scriptId, enabled);
      } else if (isMagicDataScript(scriptId) && typeof storage.patchSettings === "function") {
        const magicDataScriptDefinitions = [
          {
            scriptId: magicDataAnnotatorScriptId,
            scriptKey: "hakkaHelper",
          },
          {
            scriptId: magicDataMinnanScriptId,
            scriptKey: "minnanHelper",
          },
          {
            scriptId: magicDataHangzhouScriptId,
            scriptKey: "hangzhouHelper",
          },
        ];
        const scriptPatch = {};
        magicDataScriptDefinitions.forEach(function (definition) {
          const isTargetScript = definition.scriptId === scriptId;
          const scriptEnabled = enabled ? isTargetScript : isTargetScript ? false : undefined;
          if (typeof scriptEnabled === "boolean") {
            scriptPatch[definition.scriptKey] = {
              id: definition.scriptId,
              enabled: scriptEnabled,
              aiReviewEnabled: scriptEnabled,
            };
          }
        });
        currentSettings = await storage.patchSettings({
          platforms: {
            magicData: {
              enabled: true,
              activeScriptId: enabled ? scriptId : "",
              scripts: scriptPatch,
            },
          },
        });
      } else {
        throw new Error("当前扩展版本不支持脚本启停。");
      }
      renderCurrentView();
      setStatus(
        "detail-status",
        String(script.label || scriptId) +
          (enabled
            ? isMagicDataScript(scriptId)
              ? " 已启用；同平台其他 Magic Data 助手已自动关闭。如当前平台页面已打开，建议刷新一次。"
              : " 已启用。如当前平台页面已打开，建议刷新一次。"
            : " 已关闭。")
      );
    } catch (error) {
      setStatus(
        "detail-status",
        targetStatus + "失败：" + (error && error.message ? error.message : String(error))
      );
    }
  }

  async function saveJudgementSettings() {
    if (!storage || typeof storage.saveProjectSettings !== "function") {
      setStatus("judgement-status", "当前扩展版本不支持保存语音判别设置。");
      return false;
    }

    const volumeValue = Number(getElement("judgement-volume").value);
    const rateStepValue = Number(getElement("judgement-rate-step").value);
    const resetRateValue = Number(getElement("judgement-reset-rate").value);
    const seekStepSeconds = Number(getElement("judgement-seek-step").value);
    const itemsPerPage = normalizeJudgementItemsPerPage(
      getElement("judgement-items-per-page").value,
      "50 条/页"
    );
    const autoPlay = Boolean(getElement("judgement-auto-play").checked);
    const asrDiffViewEnabled = Boolean(getElement("judgement-asr-diff-view").checked);
    const asrDiffColors = normalizeJudgementDiffColors(
      {
        changeBackground: getElement("judgement-diff-change-bg").value,
        gapBackground: getElement("judgement-diff-gap-bg").value,
        punctuationBackground: getElement("judgement-diff-punctuation-bg").value,
      },
      constants.DEFAULT_JUDGEMENT_ASR_CONFIG?.asrDiffColors
    );
    const compactCardEnabled = Boolean(getElement("judgement-compact-card").checked);
    const thunderQuestionEnabled = Boolean(getElement("judgement-thunder-question").checked);
    const autoAdvanceAfterChoice = Boolean(getElement("judgement-auto-advance").checked);
    const currentConfig = normalizeJudgementConfig(currentSettings || {});
    const aiDefaults = getAsrVoiceAiDefaultsCached(judgementProjectId).defaults || {};
    const hasAiSettingsPanel = Boolean(getElement("judgement-ai-suggestion-timeout"));
    const aiSuggestionRequestTimeoutMs = hasAiSettingsPanel
      ? clampNumber(
          Number(getElement("judgement-ai-suggestion-timeout").value),
          currentConfig.aiSuggestionRequestTimeoutMs,
          1000,
          180000,
          0
        )
      : currentConfig.aiSuggestionRequestTimeoutMs;
    const aiSuggestionListenModel = hasAiSettingsPanel
      ? readJudgementModelField(
          "judgement-ai-suggestion-listen-model-select",
          "judgement-ai-suggestion-listen-model-custom",
          currentConfig.aiSuggestionListenModel,
          judgementAiListenModels
        )
      : currentConfig.aiSuggestionListenModel;
    const aiSuggestionCompareModel = hasAiSettingsPanel
      ? readJudgementModelField(
          "judgement-ai-suggestion-compare-model-select",
          "judgement-ai-suggestion-compare-model-custom",
          currentConfig.aiSuggestionCompareModel,
          judgementAiCompareModels
        )
      : currentConfig.aiSuggestionCompareModel;
    const aiSuggestionEnableThinking = false;
    const webSearchEnabledNode = getElement("judgement-ai-suggestion-web-search-enabled");
    const aiSuggestionWebSearchEnabled =
      hasAiSettingsPanel &&
      webSearchEnabledNode instanceof HTMLInputElement &&
      isJudgementSupportedParamFromDefaults("web_search")
        ? webSearchEnabledNode.checked === true
        : currentConfig.aiSuggestionWebSearchEnabled !== false;
    const aiSuggestionListenPrompt = hasAiSettingsPanel
      ? (function () {
          const value = normalizePromptText(getElement("judgement-ai-suggestion-listen-prompt").value);
          const defaultValue = normalizePromptText(aiDefaults.listenPrompt || "");
          return value && value !== defaultValue ? value : "";
        })()
      : currentConfig.aiSuggestionListenPrompt;
    const aiSuggestionComparePrompt = hasAiSettingsPanel
      ? (function () {
          const value = normalizePromptText(getElement("judgement-ai-suggestion-compare-prompt").value);
          const defaultValue = normalizePromptText(aiDefaults.comparePrompt || "");
          return value && value !== defaultValue ? value : "";
        })()
      : currentConfig.aiSuggestionComparePrompt;
    const aiSuggestionTemperature =
      hasAiSettingsPanel && isJudgementAiParamSupported("temperature")
        ? (function () {
            const value = normalizeOptionalNumberText(
              getElement("judgement-ai-suggestion-temperature").value,
              0,
              2,
              3
            );
            const defaultValue = normalizeOptionalNumberText(aiDefaults.temperature, 0, 2, 3);
            return value && value !== defaultValue ? value : "";
          })()
        : currentConfig.aiSuggestionTemperature;
    const aiSuggestionTopP =
      hasAiSettingsPanel && isJudgementAiParamSupported("top_p")
        ? (function () {
            const value = normalizeOptionalNumberText(
              getElement("judgement-ai-suggestion-top-p").value,
              0,
              1,
              3
            );
            const defaultValue = normalizeOptionalNumberText(aiDefaults.top_p, 0, 1, 3);
            return value && value !== defaultValue ? value : "";
          })()
        : currentConfig.aiSuggestionTopP;
    const aiSuggestionMaxTokens =
      hasAiSettingsPanel && isJudgementAiParamSupported("max_tokens")
        ? (function () {
            const value = normalizeOptionalIntegerText(
              getElement("judgement-ai-suggestion-max-tokens").value,
              1,
              8192
            );
            const defaultValue = normalizeOptionalIntegerText(aiDefaults.max_tokens, 1, 8192);
            return value && value !== defaultValue ? value : "";
          })()
        : currentConfig.aiSuggestionMaxTokens;
    const aiSuggestionMaxCompletionTokens =
      hasAiSettingsPanel && isJudgementAiParamSupported("max_completion_tokens")
        ? (function () {
            const value = normalizeOptionalIntegerText(
              getElement("judgement-ai-suggestion-max-completion-tokens").value,
              1,
              8192
            );
            const defaultValue = normalizeOptionalIntegerText(
              aiDefaults.max_completion_tokens,
              1,
              8192
            );
            return value && value !== defaultValue ? value : "";
          })()
        : currentConfig.aiSuggestionMaxCompletionTokens;
    const aiSuggestionPresencePenalty =
      hasAiSettingsPanel && isJudgementAiParamSupported("presence_penalty")
        ? (function () {
            const value = normalizeOptionalNumberText(
              getElement("judgement-ai-suggestion-presence-penalty").value,
              -2,
              2,
              3
            );
            const defaultValue = normalizeOptionalNumberText(aiDefaults.presence_penalty, -2, 2, 3);
            return value && value !== defaultValue ? value : "";
          })()
        : currentConfig.aiSuggestionPresencePenalty;
    const aiSuggestionFrequencyPenalty =
      hasAiSettingsPanel && isJudgementAiParamSupported("frequency_penalty")
        ? (function () {
            const value = normalizeOptionalNumberText(
              getElement("judgement-ai-suggestion-frequency-penalty").value,
              -2,
              2,
              3
            );
            const defaultValue = normalizeOptionalNumberText(aiDefaults.frequency_penalty, -2, 2, 3);
            return value && value !== defaultValue ? value : "";
          })()
        : currentConfig.aiSuggestionFrequencyPenalty;
    const aiSuggestionSeed =
      hasAiSettingsPanel && isJudgementAiParamSupported("seed")
        ? (function () {
            const value = normalizeOptionalIntegerText(
              getElement("judgement-ai-suggestion-seed").value,
              0,
              2147483647
            );
            const defaultValue = normalizeOptionalIntegerText(aiDefaults.seed, 0, 2147483647);
            return value && value !== defaultValue ? value : "";
          })()
        : currentConfig.aiSuggestionSeed;
    const aiSuggestionStopSequences =
      hasAiSettingsPanel && isJudgementAiParamSupported("stop")
        ? (function () {
            const value = normalizeStopSequencesText(
              getElement("judgement-ai-suggestion-stop-sequences").value
            );
            const defaultValue = normalizeStopSequencesText(aiDefaults.stop || "");
            return value && value !== defaultValue ? value : "";
          })()
        : currentConfig.aiSuggestionStopSequences;
    const aiSuggestionAvailableModels = normalizeJudgementAiAvailableModels(
      constants.DEFAULT_JUDGEMENT_ASR_CONFIG?.aiSuggestionAvailableModels,
      judgementAiCompareModels
    );
    const shortcuts = {};

    ensureShortcutDraft();
    judgementShortcutActions.forEach(function (action) {
      shortcuts[action.key] = normalizeShortcut(judgementShortcutsDraft[action.key]);
    });

    setStatus("judgement-status", "正在保存语音判别设置...");

    try {
      const defaultPlaybackRate = clampNumber(resetRateValue, 1.0, 0.25, 5, 2);
      currentSettings = await storage.saveProjectSettings(judgementProjectId, {
        volumeValue: clampNumber(volumeValue, 100, 0, 1000, 0),
        playbackRateValue: defaultPlaybackRate,
        rateStepValue: normalizeJudgementRateStep(rateStepValue, 0.25),
        seekStepSeconds: normalizeJudgementSeekStep(seekStepSeconds, 0.5),
        autoResetRate: true,
        resetRateValue: defaultPlaybackRate,
        itemsPerPage: itemsPerPage,
        autoPlay: autoPlay,
        virtualWindowEnabled: false,
        asrDiffViewEnabled: asrDiffViewEnabled,
        asrDiffColors: asrDiffColors,
        compactCardEnabled: compactCardEnabled,
        thunderQuestionEnabled: thunderQuestionEnabled,
        autoAdvanceAfterChoice: autoAdvanceAfterChoice,
        statsUploadEnabled: true,
        statsScheduleUrl: "",
        statsUploadTimes: constants.DEFAULT_JUDGEMENT_ASR_CONFIG?.statsUploadTimes || ["10:00", "16:00"],
        statsUploadJitterMinutes: constants.DEFAULT_JUDGEMENT_ASR_CONFIG?.statsUploadJitterMinutes || 10,
        statsAutoUploadOnSubtaskOpen: false,
        statsAutoUploadOnSchedule: true,
        statsUploadRequestTimeoutMs: 20000,
        aiSuggestionEnabled: true,
        aiSuggestionRequestTimeoutMs: aiSuggestionRequestTimeoutMs,
        aiSuggestionListenModel:
          aiSuggestionListenModel === String(aiDefaults.listenModel || "").trim()
            ? ""
            : aiSuggestionListenModel,
        aiSuggestionCompareModel:
          aiSuggestionCompareModel === String(aiDefaults.compareModel || "").trim()
            ? ""
            : aiSuggestionCompareModel,
        aiSuggestionListenPrompt: aiSuggestionListenPrompt,
        aiSuggestionComparePrompt: aiSuggestionComparePrompt,
        aiSuggestionTemperature: aiSuggestionTemperature,
        aiSuggestionTopP: aiSuggestionTopP,
        aiSuggestionMaxTokens: aiSuggestionMaxTokens,
        aiSuggestionMaxCompletionTokens: aiSuggestionMaxCompletionTokens,
        aiSuggestionPresencePenalty: aiSuggestionPresencePenalty,
        aiSuggestionFrequencyPenalty: aiSuggestionFrequencyPenalty,
        aiSuggestionSeed: aiSuggestionSeed,
        aiSuggestionResponseFormat: "json_object",
        aiSuggestionReasoningEffort: "",
        aiSuggestionStopSequences: aiSuggestionStopSequences,
        aiSuggestionEnableThinking: aiSuggestionEnableThinking,
        aiSuggestionWebSearchEnabled: aiSuggestionWebSearchEnabled,
        aiSuggestionModel: aiSuggestionCompareModel,
        aiSuggestionAvailableModels: aiSuggestionAvailableModels,
        shortcuts: shortcuts,
      });
      renderCurrentView();
      setStatus("judgement-status", "语音判别设置已保存；已打开的 LabelX 页面会尽量实时同步，未生效时请刷新页面。");
      return true;
    } catch (error) {
      setStatus(
        "judgement-status",
        "保存失败：" + (error && error.message ? error.message : String(error))
      );
      return false;
    }
  }

  async function renderCurrentView() {
    hideError();
    ensurePublicHeroShell();
    ensureAdminWorkspace();
    const route = getCurrentRouteState();
    const scriptId = route.view === "script" ? route.scriptId : null;
    const settings = currentSettings || (await loadSettings());
    const centerView = getElement("script-center-view");
    const downloadCenterView = getElement("download-center-view");
    const detailView = getElement("script-detail-view");
    const adminWorkspace = getElement("admin-workspace");
    const scriptVisible = scriptId ? isScriptVisibleByRelease(scriptId, settings || {}) : true;

    document.title = (constants.EXTENSION_NAME || "标注脚本中心") + " - 设置";
    getElement("extension-name").textContent = constants.EXTENSION_NAME || "标注脚本中心";
    updateHeroForRoute(route);
    const workspaceBrandTitle = getElement("workspace-brand-title");
    if (workspaceBrandTitle) {
      workspaceBrandTitle.textContent = constants.EXTENSION_NAME || "标注脚本中心";
    }
    renderWorkspaceSidebar(settings, route);
    const stageLabel = getElement("stage-label");
    if (stageLabel instanceof HTMLButtonElement) {
      if (route.view === "script") {
        stageLabel.textContent = "系统管理";
        stageLabel.title = "进入系统管理";
        stageLabel.setAttribute("aria-label", "进入系统管理");
        stageLabel.classList.remove("hidden");
      } else {
        stageLabel.classList.add("hidden");
      }
    }

    if (route.view === "admin") {
      if (centerView) {
        centerView.classList.add("hidden");
      }
      if (downloadCenterView) {
        downloadCenterView.classList.add("hidden");
      }
      if (detailView) {
        detailView.classList.add("hidden");
      }
      if (adminWorkspace) {
        adminWorkspace.classList.remove("hidden");
      }
      renderAdminWorkspace(route.adminTab);
      return;
    }

    stopAdminDashboardAutoRefresh();

    if (route.view === "downloads") {
      if (centerView) {
        centerView.classList.add("hidden");
      }
      if (downloadCenterView) {
        downloadCenterView.classList.remove("hidden");
      }
      if (detailView) {
        detailView.classList.add("hidden");
      }
      if (adminWorkspace) {
        adminWorkspace.classList.add("hidden");
      }
      renderPublicDownloadsView();
      return;
    }

    if (scriptId && !scriptVisible) {
      navigateToCenter();
      return;
    }

    if (!scriptId) {
      if (centerView) {
        centerView.classList.remove("hidden");
      }
      if (downloadCenterView) {
        downloadCenterView.classList.add("hidden");
      }
      if (detailView) {
        detailView.classList.add("hidden");
      }
      if (adminWorkspace) {
        adminWorkspace.classList.add("hidden");
      }
      renderScriptCenter(settings);
      return;
    }

    if (centerView) {
      centerView.classList.add("hidden");
    }
    if (downloadCenterView) {
      downloadCenterView.classList.add("hidden");
    }
    if (detailView) {
      detailView.classList.remove("hidden");
    }
    if (adminWorkspace) {
      adminWorkspace.classList.add("hidden");
    }
    renderDetail(settings, scriptId);
  }

  document.addEventListener("DOMContentLoaded", async function () {
    restorePendingTopToast();
    ensurePublicHeroShell();
    ensureAdminWorkspace();
    const stageLabel = getElement("stage-label");
    if (stageLabel) {
      stageLabel.addEventListener("click", function () {
        const route = getCurrentRouteState();
        if (route.view === "script") {
          navigateToAdmin(getCurrentAdminTab());
        }
      });
    }

    const workspaceNavCenter = getElement("workspace-nav-center");
    if (workspaceNavCenter instanceof HTMLButtonElement) {
      workspaceNavCenter.addEventListener("click", function () {
        navigateToCenter();
      });
    }

    const workspaceNavDownloads = getElement("workspace-nav-downloads");
    if (workspaceNavDownloads instanceof HTMLButtonElement) {
      workspaceNavDownloads.addEventListener("click", function () {
        navigateToDownloads();
      });
    }

    const workspaceNavAdmin = getElement("workspace-nav-admin");
    if (workspaceNavAdmin instanceof HTMLButtonElement) {
      workspaceNavAdmin.addEventListener("click", function () {
        navigateToAdmin(getCurrentAdminTab());
      });
    }
    const workspaceBrandIcon = getElement("workspace-brand-icon");
    if (workspaceBrandIcon instanceof HTMLElement) {
      workspaceBrandIcon.addEventListener("click", function () {
        registerBetaUnlockTap();
      });
    }
    const workspaceBetaExit = getElement("workspace-beta-exit");
    if (workspaceBetaExit instanceof HTMLButtonElement) {
      workspaceBetaExit.addEventListener("click", function () {
        void exitBetaMode();
      });
    }

    getElement("back-to-center").addEventListener("click", function () {
      navigateToCenter();
    });

    getElement("detail-enable-button").addEventListener("click", function () {
      const scriptId = getCurrentDetailScriptId();
      if (scriptId) {
        void toggleScript(scriptId, true);
      }
    });

    getElement("detail-disable-button").addEventListener("click", function () {
      const scriptId = getCurrentDetailScriptId();
      if (scriptId) {
        void toggleScript(scriptId, false);
      }
    });

    const detailToggleButton = getElement("detail-toggle-button");
    if (detailToggleButton instanceof HTMLButtonElement) {
      detailToggleButton.addEventListener("click", function () {
        const scriptId = getCurrentDetailScriptId();
        if (!scriptId) {
          return;
        }
        void toggleScript(scriptId, !isScriptEnabled(currentSettings || {}, scriptId));
      });
    }

    getElement("save-judgement-settings").addEventListener("click", function () {
      void saveJudgementSettings();
    });

    getElement("save-transcription-settings").addEventListener("click", function () {
      void saveTranscriptionSettings();
    });

    getElement("save-data-baker-settings").addEventListener("click", function () {
      void saveDataBakerSettings();
    });

    const saveDataBakerCvpcSettingsButton = getElement("save-data-baker-cvpc-settings");
    if (saveDataBakerCvpcSettingsButton) {
      saveDataBakerCvpcSettingsButton.addEventListener("click", function () {
        void saveDataBakerCvpcSettings();
      });
    }
    const saveBytedanceAidpSettingsButton = getElement("save-bytedance-aidp-settings");
    if (saveBytedanceAidpSettingsButton) {
      saveBytedanceAidpSettingsButton.addEventListener("click", function () {
        const activeScriptId = getCurrentDetailScriptId();
        if (activeScriptId === bytedanceAidpJinhuaScriptId) {
          void saveBytedanceAidpJinhuaSettings();
          return;
        }
        void saveBytedanceAidpSettings();
      });
    }
    const bytedanceAidpAiEnabledNode = getElement("bytedance-aidp-ai-enabled");
    if (bytedanceAidpAiEnabledNode instanceof HTMLInputElement) {
      bindSwitchFieldText(document);
      bytedanceAidpAiEnabledNode.addEventListener("change", function () {
        const currentScriptId = getCurrentDetailScriptId();
        if (!isBytedanceAidpScript(currentScriptId)) {
          return;
        }
        syncSwitchFieldText(bytedanceAidpAiEnabledNode);
        refreshBytedanceAidpDetailAiVisibility(currentScriptId);
      });
    }
    const dataBakerCvpcSegmentThresholdUnitNode = getElement(
      "data-baker-cvpc-segment-silence-threshold-unit"
    );
    const dataBakerCvpcSegmentThresholdValueNode = getElement(
      "data-baker-cvpc-segment-silence-threshold-dbfs"
    );
    if (
      dataBakerCvpcSegmentThresholdUnitNode instanceof HTMLSelectElement &&
      dataBakerCvpcSegmentThresholdValueNode instanceof HTMLInputElement
    ) {
      dataBakerCvpcSegmentThresholdUnitNode.addEventListener("change", function () {
        const previousUnit = normalizeDataBakerCvpcSegmentSilenceThresholdUnit(
          dataBakerCvpcSegmentThresholdUnitNode.getAttribute("data-prev-unit"),
          "db"
        );
        const nextUnit = normalizeDataBakerCvpcSegmentSilenceThresholdUnit(
          dataBakerCvpcSegmentThresholdUnitNode.value,
          "db"
        );
        const fallbackDbfs =
          dataBakerCvpcSegmentThresholdValueNode.getAttribute("data-fallback-dbfs");
        const currentDbfs = convertDataBakerCvpcSegmentThresholdDisplayValueToDbfs(
          dataBakerCvpcSegmentThresholdValueNode.value,
          previousUnit,
          fallbackDbfs
        );
        applyDataBakerCvpcSegmentThresholdFieldState(currentDbfs, nextUnit);
      });
      dataBakerCvpcSegmentThresholdValueNode.addEventListener("input", function () {
        refreshDataBakerCvpcSegmentThresholdHelpFromForm();
      });
    }

    const saveAishellSettingsButton = getElement("save-aishell-tech-settings");
    if (saveAishellSettingsButton) {
      saveAishellSettingsButton.addEventListener("click", function () {
        void saveAishellTechSettings(getCurrentDetailScriptId());
      });
    }

    const saveAishellVietnameseSettingsButton = getElement(
      "save-aishell-tech-vietnamese-settings"
    );
    if (saveAishellVietnameseSettingsButton) {
      saveAishellVietnameseSettingsButton.addEventListener("click", function () {
        void saveAishellTechSettings(getCurrentDetailScriptId());
      });
    }

    const saveAishellThaiSettingsButton = getElement("save-aishell-tech-thai-settings");
    if (saveAishellThaiSettingsButton) {
      saveAishellThaiSettingsButton.addEventListener("click", function () {
        void saveAishellTechSettings(getCurrentDetailScriptId());
      });
    }

    const saveAishellCantoneseSettingsButton = getElement(
      "save-aishell-tech-cantonese-settings"
    );
    if (saveAishellCantoneseSettingsButton) {
      saveAishellCantoneseSettingsButton.addEventListener("click", function () {
        void saveAishellTechSettings(getCurrentDetailScriptId());
      });
    }

    const saveJdTtsShanghaineseSettingsButton = getElement(
      "save-jd-tts-shanghainese-settings"
    );
    if (saveJdTtsShanghaineseSettingsButton) {
      saveJdTtsShanghaineseSettingsButton.addEventListener("click", function () {
        void saveJdTtsShanghaineseSettings();
      });
    }

    getElement("save-magic-data-settings").addEventListener("click", function () {
      void saveMagicDataSettings();
    });

    const saveAbakaSettingsButton = getElement("save-abaka-settings");
    if (saveAbakaSettingsButton) {
      saveAbakaSettingsButton.addEventListener("click", function () {
        void saveAbakaAiTaskPageSettings();
      });
    }

    const saveHaitianUtransSettingsButton = getElement("save-haitian-utrans-settings");
    if (saveHaitianUtransSettingsButton) {
      saveHaitianUtransSettingsButton.addEventListener("click", function () {
        void saveHaitianUtransAudioDownloadHelperSettings();
      });
    }

    const resetAbakaShortcutsButton = getElement("abaka-reset-shortcuts");
    if (resetAbakaShortcutsButton) {
      resetAbakaShortcutsButton.addEventListener("click", function () {
        clearAbakaAiTask21Shortcuts();
      });
    }

    getElement("home-endpoint-server").addEventListener("click", function () {
      void setHomeBackendEndpoint("server");
    });

    getElement("home-endpoint-local").addEventListener("click", function () {
      void setHomeBackendEndpoint("local");
    });
    const homeEndpointBeta = getElement("home-endpoint-beta");
    if (homeEndpointBeta instanceof HTMLButtonElement) {
      homeEndpointBeta.addEventListener("click", function () {
        void setHomeBackendEndpoint("beta");
      });
    }
    const homeEndpointServerUrl = getElement("home-endpoint-server-url");
    if (homeEndpointServerUrl instanceof HTMLInputElement) {
      homeEndpointServerUrl.addEventListener("input", function () {
        const draft = getAdminBackendDraft();
        draft.backendBaseUrls.server = homeEndpointServerUrl.value;
        renderHomeBackendEndpoint(currentSettings || {});
      });
    }
    const homeEndpointLocalUrl = getElement("home-endpoint-local-url");
    if (homeEndpointLocalUrl instanceof HTMLInputElement) {
      homeEndpointLocalUrl.addEventListener("input", function () {
        const draft = getAdminBackendDraft();
        draft.backendBaseUrls.local = homeEndpointLocalUrl.value;
        renderHomeBackendEndpoint(currentSettings || {});
      });
    }
    const homeEndpointBetaUrl = getElement("home-endpoint-beta-url");
    if (homeEndpointBetaUrl instanceof HTMLInputElement) {
      homeEndpointBetaUrl.addEventListener("input", function () {
        const draft = getAdminBackendDraft();
        draft.backendBaseUrls.beta = homeEndpointBetaUrl.value;
        renderHomeBackendEndpoint(currentSettings || {});
      });
    }
    const homeEndpointExpandToggle = getElement("home-endpoint-expand-toggle");
    if (homeEndpointExpandToggle instanceof HTMLButtonElement) {
      homeEndpointExpandToggle.addEventListener("click", function () {
        const draft = getAdminBackendDraft();
        draft.backendConfigExpanded = draft.backendConfigExpanded !== true;
        renderHomeBackendEndpoint(currentSettings || {});
      });
    }

    const homeEndpointSaveButton = getElement("home-endpoint-save");
    if (homeEndpointSaveButton instanceof HTMLButtonElement) {
      homeEndpointSaveButton.addEventListener("click", function () {
        void saveAdminBackendSettings();
      });
    }

    const projectDownloadDataset = getElement("project-download-dataset");
    if (projectDownloadDataset instanceof HTMLSelectElement) {
      projectDownloadDataset.addEventListener("change", function () {
        updateProjectDataDownloadSupplierVisibility();
      });
    }

    const projectDownloadOperator = getElement("project-download-operator");
    if (projectDownloadOperator instanceof HTMLInputElement) {
      projectDownloadOperator.addEventListener("blur", function () {
        void persistProjectDataDownloadOperatorName(projectDownloadOperator.value).catch(function () {
          setProjectDataDownloadStatus("保存获取人姓名失败，请稍后重试。");
        });
      });
    }

    const aiCallLogDataset = getElement("ai-call-log-dataset");
    if (aiCallLogDataset instanceof HTMLSelectElement) {
      aiCallLogDataset.addEventListener("change", function () {
        updateAiCallLogDateInputs();
      });
    }

    const aiCallLogOperator = getElement("ai-call-log-operator");
    if (aiCallLogOperator instanceof HTMLInputElement) {
      aiCallLogOperator.addEventListener("blur", function () {
        void persistAiCallLogOperatorName(aiCallLogOperator.value)
          .then(function () {
            aiCallLogOperator.value = getAiCallLogOperatorName(currentSettings || {});
          })
          .catch(function () {
            setAiCallLogStatus("保存获取人姓名失败，请稍后重试。");
          });
      });
    }

    const workspaceAiUsageOperatorInput = getElement("workspace-ai-usage-operator-input");
    if (workspaceAiUsageOperatorInput instanceof HTMLInputElement) {
      workspaceAiUsageOperatorInput.addEventListener("input", function () {
        setStatus("workspace-ai-usage-operator-status", "");
      });
    }

    const workspaceAiUsageOperatorSave = getElement("workspace-ai-usage-operator-save");
    if (workspaceAiUsageOperatorSave instanceof HTMLButtonElement) {
      workspaceAiUsageOperatorSave.addEventListener("click", function () {
        void saveWorkspaceAiUsageOperatorName();
      });
    }

    const projectDownloadExportButton = getElement("project-download-export");
    if (projectDownloadExportButton instanceof HTMLButtonElement) {
      projectDownloadExportButton.addEventListener("click", function () {
        void handleProjectDataDownloadExport();
      });
    }

    const aiCallLogExportButton = getElement("ai-call-log-export");
    if (aiCallLogExportButton instanceof HTMLButtonElement) {
      aiCallLogExportButton.addEventListener("click", function () {
        void handleAiCallLogExport();
      });
    }

    Array.from(document.querySelectorAll("[data-admin-tab]")).forEach(function (button) {
      button.addEventListener("click", function () {
        navigateToAdmin(button.getAttribute("data-admin-tab"));
      });
    });

    const adminReturnCenterButton = getElement("admin-return-center");
    if (adminReturnCenterButton instanceof HTMLButtonElement) {
      adminReturnCenterButton.addEventListener("click", function () {
        navigateToCenter();
      });
    }

    const adminLogoutButton = getElement("admin-logout-button");
    if (adminLogoutButton instanceof HTMLButtonElement) {
      adminLogoutButton.addEventListener("click", function () {
        void handleAdminLogout();
      });
    }

    const adminRefreshButton = getElement("admin-refresh-dashboard");
    if (adminRefreshButton instanceof HTMLButtonElement) {
      adminRefreshButton.addEventListener("click", function () {
        void loadAdminDashboard(true, "manual");
      });
    }

    const adminUnlockButton = getElement("admin-unlock-button");
    if (adminUnlockButton instanceof HTMLButtonElement) {
      adminUnlockButton.addEventListener("click", function () {
        void handleAdminUnlock();
      });
    }

    const adminPasswordInput = getElement("admin-password-input");
    if (adminPasswordInput instanceof HTMLInputElement) {
      adminPasswordInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          void handleAdminUnlock();
        }
      });
    }

    const scriptCenterView = getElement("script-center-view");
    if (scriptCenterView instanceof HTMLElement) {
      scriptCenterView.addEventListener("click", function (event) {
        const target = event.target instanceof Element ? event.target.closest("[data-platform-entry]") : null;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const url = normalizeText(target.getAttribute("data-platform-entry"));
        if (!url) {
          return;
        }
        event.preventDefault();
        openExternalUrl(url);
      });
    }

    const publicScriptReleasePanel = getElement("public-script-release-panel");
    if (publicScriptReleasePanel instanceof HTMLElement) {
      publicScriptReleasePanel.addEventListener("change", function (event) {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement) || target.id !== "public-release-version-select") {
          return;
        }
        adminSelectedReleaseVersion = normalizeText(target.value);
        renderPublicDownloadCenterPanel(adminDownloadCenterReleasesCache || {});
      });
      publicScriptReleasePanel.addEventListener("click", function (event) {
        const target = event.target instanceof Element ? event.target.closest("[data-release-download-url]") : null;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const url = normalizeText(target.getAttribute("data-release-download-url"));
        if (!url) {
          return;
        }
        event.preventDefault();
        openExternalUrl(url);
      });
    }

    try {
      await loadSettings();
      await restoreAdminSession();
      await renderCurrentView();
    } catch (error) {
      showError(error && error.message ? error.message : String(error));
    }
  });
})();
