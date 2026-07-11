/**
 * @fileoverview Shared settings schema, defaults, and compatibility constants.
 */

(function () {
  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function createShortcut(key, extra) {
    return Object.assign(
      {
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
        key: key || null,
        button: null,
      },
      extra || {}
    );
  }

  function createEmptyShortcutMap(actions) {
    const result = {};
    const source = Array.isArray(actions) ? actions : [];
    source.forEach(function (action) {
      const key = String(action?.key || "").trim();
      if (!key) {
        return;
      }
      result[key] = null;
    });
    return result;
  }

  const EXTENSION_NAME = "标注脚本中心";
  const DEFAULT_AI_REQUEST_TIMEOUT_MS = 60000;
  const LEGACY_DEFAULT_AI_REQUEST_TIMEOUT_MS = 60 * 1000;
  const DATABAKER_AI_ASYNC_JOBS_ENABLED_DEFAULT = false;
  const DATABAKER_AI_REQUEST_STAGGER_MS = 50;
  const STAGE_ID = "labelx-script-center";
  const STAGE_LABEL = "脚本中心";
  const SCHEMA_VERSION = 29;
  const RELEASE_CHANNEL_PUBLIC = "public";
  const RELEASE_VISIBILITY_PUBLIC = "public";
  const ALIBABA_LABELX_PLATFORM_ID = "alibabaLabelx";
  const LIGHTWHEEL_PLATFORM_ID = "lightwheel";
  const DATA_BAKER_PLATFORM_ID = "dataBaker";
  const MAGIC_DATA_PLATFORM_ID = "magicData";
  const ABAKA_AI_PLATFORM_ID = "abakaAi";
  const HAITIAN_UTRANS_PLATFORM_ID = "haitianUtrans";
  const AISHELL_TECH_PLATFORM_ID = "aishellTech";
  const TRANSCRIPTION_PROJECT_ID = "transcription";
  const JUDGEMENT_PROJECT_ID = "judgement";
  const LIGHTWHEEL_VIEW_PANEL_SCRIPT_ID = "lightwheelViewPanel";
  const DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID = "dataBakerRoundOneQuality";
  const MAGIC_DATA_ANNOTATOR_SCRIPT_ID = "magicDataAnnotatorAiReview";
  const MAGIC_DATA_MINNAN_SCRIPT_ID = "magicDataMinnanAssistant";
  const ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID = "abakaAiTaskPageCapture";
  const HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID = "haitianUtransAudioDownloadHelper";
  const AISHELL_TECH_MINNAN_SCRIPT_ID = "aishellTechMinnanAssistant";
  const AISHELL_TECH_VIETNAMESE_SCRIPT_ID = "aishellTechVietnameseAssistant";
  const AISHELL_TECH_THAI_SCRIPT_ID = "aishellTechThaiAssistant";
  const AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID = "aishellTechCnEnShortDrama";
  const BACKEND_ENDPOINT_MODE_SERVER = "server";
  const BACKEND_ENDPOINT_MODE_LOCAL = "local";
  const BUILD_META = globalThis.ASREdgeBuildMeta || {};
  function normalizeReleaseChannel(value, fallback) {
    return RELEASE_CHANNEL_PUBLIC;
  }
  function normalizeBackendBaseUrl(value, fallback) {
    const text = String(value || "")
      .trim()
      .replace(/\/+$/, "");
    if (/^https?:\/\//i.test(text)) {
      return text;
    }
    const fallbackText = String(fallback || "")
      .trim()
      .replace(/\/+$/, "");
    return /^https?:\/\//i.test(fallbackText) ? fallbackText : "";
  }
  const RELEASE_CHANNEL = normalizeReleaseChannel(
    BUILD_META.releaseChannel,
    RELEASE_CHANNEL_PUBLIC
  );
  const DEFAULT_BACKEND_BASE_URLS = Object.freeze({
    server: normalizeBackendBaseUrl("https://script.xiangtianzhen.store"),
    local: normalizeBackendBaseUrl("http://127.0.0.1:3333"),
  });
  const BACKEND_ENDPOINTS = DEFAULT_BACKEND_BASE_URLS;
  const DATABAKER_AI_RECOMMEND_PATH = "/api/data-baker/round-one-quality/ai/recommend";
  const DATABAKER_EXPORT_UPLOAD_PATH = "/api/data-baker/round-one-quality/export/upload";
  const DATABAKER_EXPORT_DOWNLOAD_PATH = "/api/data-baker/round-one-quality/export/download";
  const JUDGEMENT_STATS_UPLOAD_PATH = "/api/alibaba-labelx/asr-judgement/statistics/upload";
  const JUDGEMENT_STATS_DOWNLOAD_PATH = "/api/alibaba-labelx/asr-judgement/statistics/download";
  const JUDGEMENT_AI_SUGGEST_PATH = "/api/alibaba-labelx/asr-judgement/ai/suggest";
  const TRANSCRIPTION_AI_SUGGEST_CURRENT_PATH =
    "/api/alibaba-labelx/asr-transcription/ai/suggest-current";
  const AISHELL_TECH_AI_RECOMMEND_PATH = "/api/aishell-tech/minnan-helper/ai/recommend";
  const AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_PATH =
    "/api/aishell-tech/vietnamese-helper/ai/recommend";
  const AISHELL_TECH_THAI_AI_RECOMMEND_PATH =
    "/api/aishell-tech/thai-helper/ai/recommend";
  const TRANSCRIPTION_STATS_UPLOAD_PATH = "/api/alibaba-labelx/asr-transcription/statistics/upload";
  const TRANSCRIPTION_STATS_DOWNLOAD_PATH =
    "/api/alibaba-labelx/asr-transcription/statistics/download";
  const PROJECT_DATA_DOWNLOAD_OPTIONS_PATH = "/api/admin/project-data-download/options";
  const PROJECT_DATA_DOWNLOAD_REQUEST_PATH = "/api/admin/project-data-download/request";
  const PROJECT_DATA_DOWNLOAD_FILE_PATH = "/api/admin/project-data-download/file";
  const AI_CALL_LOG_DOWNLOAD_OPTIONS_PATH = "/api/admin/ai-call-log/options";
  const AI_CALL_LOG_DOWNLOAD_REQUEST_PATH = "/api/admin/ai-call-log/request";
  const AI_CALL_LOG_DOWNLOAD_FILE_PATH = "/api/admin/ai-call-log/file";
  const DATABAKER_AI_RECOMMEND_SERVER_ENDPOINT =
    BACKEND_ENDPOINTS.server + DATABAKER_AI_RECOMMEND_PATH;
  const DATABAKER_AI_RECOMMEND_LOCAL_ENDPOINT =
    BACKEND_ENDPOINTS.local + DATABAKER_AI_RECOMMEND_PATH;
  const DATABAKER_EXPORT_UPLOAD_SERVER_ENDPOINT =
    BACKEND_ENDPOINTS.server + DATABAKER_EXPORT_UPLOAD_PATH;
  const DATABAKER_EXPORT_UPLOAD_LOCAL_ENDPOINT =
    BACKEND_ENDPOINTS.local + DATABAKER_EXPORT_UPLOAD_PATH;
  const DATABAKER_EXPORT_DOWNLOAD_SERVER_ENDPOINT =
    BACKEND_ENDPOINTS.server + DATABAKER_EXPORT_DOWNLOAD_PATH;
  const DATABAKER_EXPORT_DOWNLOAD_LOCAL_ENDPOINT =
    BACKEND_ENDPOINTS.local + DATABAKER_EXPORT_DOWNLOAD_PATH;
  const TRANSCRIPTION_STATS_SERVER_ENDPOINT =
    BACKEND_ENDPOINTS.server + TRANSCRIPTION_STATS_UPLOAD_PATH;
  const TRANSCRIPTION_STATS_LOCAL_ENDPOINT =
    BACKEND_ENDPOINTS.local + TRANSCRIPTION_STATS_UPLOAD_PATH;
  const JUDGEMENT_STATS_SERVER_ENDPOINT =
    BACKEND_ENDPOINTS.server + JUDGEMENT_STATS_UPLOAD_PATH;
  const JUDGEMENT_STATS_LOCAL_ENDPOINT =
    BACKEND_ENDPOINTS.local + JUDGEMENT_STATS_UPLOAD_PATH;
  const JUDGEMENT_AI_SUGGEST_SERVER_ENDPOINT =
    BACKEND_ENDPOINTS.server + JUDGEMENT_AI_SUGGEST_PATH;
  const JUDGEMENT_AI_SUGGEST_LOCAL_ENDPOINT =
    BACKEND_ENDPOINTS.local + JUDGEMENT_AI_SUGGEST_PATH;
  const TRANSCRIPTION_AI_SUGGEST_CURRENT_SERVER_ENDPOINT =
    BACKEND_ENDPOINTS.server + TRANSCRIPTION_AI_SUGGEST_CURRENT_PATH;
  const TRANSCRIPTION_AI_SUGGEST_CURRENT_LOCAL_ENDPOINT =
    BACKEND_ENDPOINTS.local + TRANSCRIPTION_AI_SUGGEST_CURRENT_PATH;
  const AISHELL_TECH_AI_RECOMMEND_SERVER_ENDPOINT =
    BACKEND_ENDPOINTS.server + AISHELL_TECH_AI_RECOMMEND_PATH;
  const AISHELL_TECH_AI_RECOMMEND_LOCAL_ENDPOINT =
    BACKEND_ENDPOINTS.local + AISHELL_TECH_AI_RECOMMEND_PATH;
  const AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_SERVER_ENDPOINT =
    BACKEND_ENDPOINTS.server + AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_PATH;
  const AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_LOCAL_ENDPOINT =
    BACKEND_ENDPOINTS.local + AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_PATH;
  const AISHELL_TECH_THAI_AI_RECOMMEND_SERVER_ENDPOINT =
    BACKEND_ENDPOINTS.server + AISHELL_TECH_THAI_AI_RECOMMEND_PATH;
  const AISHELL_TECH_THAI_AI_RECOMMEND_LOCAL_ENDPOINT =
    BACKEND_ENDPOINTS.local + AISHELL_TECH_THAI_AI_RECOMMEND_PATH;
  const DATABAKER_PAGE_SIZE_OPTIONS = ["5条/页", "10条/页", "20条/页", "50条/页", "100条/页"];
  const DATABAKER_AI_PIPELINE_MODE_OPTIONS = [
    { value: "two_stage", label: "双模型：听音模型 + 比较模型" },
    { value: "omni_single", label: "单模型：Omni 单模型" },
  ];
  const MAGIC_DATA_HELPER_MODEL_MODE_OPTIONS = [
    { value: "two_stage", label: "双模型：听音模型 + 比较模型" },
    { value: "omni_single", label: "单模型：Omni 单模型" },
  ];
  const MAGIC_DATA_HELPER_RECOGNITION_STRATEGY_OPTIONS = [
    { value: "direct_dialect", label: "直接识别方言文本" },
    {
      value: "mandarin_to_dialect",
      label: "识别转换：先听成普通话，再按字词表转方言",
    },
  ];
  const AISHELL_TECH_RECOGNITION_STRATEGY_OPTIONS = [
    { value: "audio_first_reference", label: "三文本对照（音频优先，文本参考）" },
  ];
  const BAILIAN_MODEL_DOC_URLS = {
    pricing:
      "https://help.aliyun.com/zh/model-studio/model-pricing",
    api:
      "https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016807",
    text:
      "https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2841718",
    omni:
      "https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2867839",
    asr:
      "https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2880903",
    recordApi: "https://help.aliyun.com/zh/model-studio/recording-file-recognition-api-details",
    market: "https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-market/all",
  };
  const BAILIAN_CORE_MODEL_CATALOG = [
    {
      value: "qwen3.6-plus",
      label: "qwen3.6-plus",
      family: "text",
      tier: "plus",
      supportsThinking: true,
      defaultThinking: false,
      docUrl: BAILIAN_MODEL_DOC_URLS.text,
      apiUrl: BAILIAN_MODEL_DOC_URLS.api,
      pricingUrl: BAILIAN_MODEL_DOC_URLS.pricing,
    },
    {
      value: "qwen3.5-plus",
      label: "qwen3.5-plus",
      family: "text",
      tier: "plus",
      supportsThinking: true,
      defaultThinking: false,
      docUrl: BAILIAN_MODEL_DOC_URLS.text,
      apiUrl: BAILIAN_MODEL_DOC_URLS.api,
      pricingUrl: BAILIAN_MODEL_DOC_URLS.pricing,
    },
    {
      value: "qwen3.6-flash",
      label: "qwen3.6-flash",
      family: "text",
      tier: "flash",
      supportsThinking: true,
      defaultThinking: false,
      docUrl: BAILIAN_MODEL_DOC_URLS.text,
      apiUrl: BAILIAN_MODEL_DOC_URLS.api,
      pricingUrl: BAILIAN_MODEL_DOC_URLS.pricing,
    },
    {
      value: "qwen3.5-flash",
      label: "qwen3.5-flash",
      family: "text",
      tier: "flash",
      supportsThinking: true,
      defaultThinking: false,
      docUrl: BAILIAN_MODEL_DOC_URLS.text,
      apiUrl: BAILIAN_MODEL_DOC_URLS.api,
      pricingUrl: BAILIAN_MODEL_DOC_URLS.pricing,
    },
    {
      value: "qwen3.5-omni-plus",
      label: "qwen3.5-omni-plus",
      family: "omni",
      tier: "plus",
      supportsThinking: true,
      defaultThinking: false,
      docUrl: BAILIAN_MODEL_DOC_URLS.omni,
      apiUrl: BAILIAN_MODEL_DOC_URLS.api,
      pricingUrl: BAILIAN_MODEL_DOC_URLS.pricing,
    },
    {
      value: "qwen3.5-omni-flash",
      label: "qwen3.5-omni-flash",
      family: "omni",
      tier: "flash",
      supportsThinking: true,
      defaultThinking: false,
      docUrl: BAILIAN_MODEL_DOC_URLS.omni,
      apiUrl: BAILIAN_MODEL_DOC_URLS.api,
      pricingUrl: BAILIAN_MODEL_DOC_URLS.pricing,
    },
    {
      value: "fun-asr",
      label: "fun-asr",
      family: "asr",
      tier: "flash",
      supportsThinking: false,
      defaultThinking: false,
      docUrl: BAILIAN_MODEL_DOC_URLS.asr,
      apiUrl: BAILIAN_MODEL_DOC_URLS.recordApi,
      pricingUrl: BAILIAN_MODEL_DOC_URLS.pricing,
    },
  ];
  function buildBailianModelOptionsByFamily(family) {
    return BAILIAN_CORE_MODEL_CATALOG.filter(function (item) {
      return item.family === family;
    }).map(function (item) {
      return Object.assign({}, item);
    });
  }
  const DATABAKER_AI_LISTEN_MODEL_OPTIONS = buildBailianModelOptionsByFamily("asr").concat(
    buildBailianModelOptionsByFamily("omni")
  );
  const DATABAKER_AI_SINGLE_MODEL_OPTIONS = buildBailianModelOptionsByFamily("omni");
  const DATABAKER_AI_OMNI_MODEL_OPTIONS = buildBailianModelOptionsByFamily("omni");
  const DATABAKER_AI_FUN_ASR_MODEL_OPTIONS = buildBailianModelOptionsByFamily("asr");
  const DATABAKER_AI_COMPARE_MODEL_OPTIONS = buildBailianModelOptionsByFamily("text");
  const DATABAKER_ROUND_ONE_SHORTCUT_ACTIONS = [
    { key: "aiRecommendCurrentItem", label: "AI 推荐文本" },
    { key: "autoFillQualifiedItem", label: "AI并发分析并连续填入合格项" },
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
  const AISHELL_TECH_MINNAN_SHORTCUT_ACTIONS = [
    { key: "aiRecommendCurrentItem", label: "AI 推荐当前条" },
    { key: "autoFillQualifiedItem", label: "批量识别并保存" },
    { key: "copyAiHeardText", label: "复制 AI 听音文本" },
    { key: "copyRecommendedText", label: "复制 AI 推荐文本" },
    { key: "fillRecommendedText", label: "填入并保存当前条" },
    { key: "ignoreAiResult", label: "忽略 AI 结果" },
  ];
  const AISHELL_TECH_VIETNAMESE_SHORTCUT_ACTIONS = [
    { key: "aiRecommendCurrentItem", label: "AI 识别当前条" },
    { key: "autoFillQualifiedItem", label: "批量识别并保存" },
    { key: "copyRecommendedText", label: "复制识别文本" },
    { key: "fillRecommendedText", label: "填入并保存当前条" },
    { key: "ignoreAiResult", label: "忽略 AI 结果" },
  ];
  const AISHELL_TECH_THAI_SHORTCUT_ACTIONS = AISHELL_TECH_VIETNAMESE_SHORTCUT_ACTIONS.map(
    function (item) {
      return clone(item);
    }
  );
  const AISHELL_TECH_CN_EN_SHORT_DRAMA_SHORTCUT_ACTIONS = [];
  const DATABAKER_AI_OMNI_MODEL_VALUES = DATABAKER_AI_OMNI_MODEL_OPTIONS.map(function (item) {
    return String(item?.value || "").trim();
  }).filter(Boolean);
  const ABAKA_AI_TASK21_SHORTCUT_ACTIONS = [
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
  const BAILIAN_DOC_URLS = {
    helpVision:
      "https://help.aliyun.com/zh/model-studio/vision?spm=a2c4g.11186623.help-menu-2400256.d_0_3_1_0.34b2141cE5YHDK",
    visionUnderstanding:
      "https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=3026912",
    imageVideoUnderstanding:
      "https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2845871",
    ocr:
      "https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2860683",
    visualReasoning:
      "https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2877996",
    modelList:
      "https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-market/all",
  };
  const ABAKA_AI_TASK21_AI_ANALYSIS_MODES = [
    { value: "two_stage", label: "双模型方案（默认）" },
    { value: "single_model", label: "单模型方案" },
  ];
  const ABAKA_AI_TASK21_VISION_MODEL_OPTIONS = [
    {
      value: "qwen3.6-plus",
      label: "qwen3.6-plus",
      role: "vision",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3.6-flash",
      label: "qwen3.6-flash",
      role: "vision",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3-vl-plus",
      label: "qwen3-vl-plus",
      role: "vision",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: "unknown",
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3-vl-flash",
      label: "qwen3-vl-flash",
      role: "vision",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: "unknown",
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3.5-plus",
      label: "qwen3.5-plus",
      role: "vision",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3.5-flash",
      label: "qwen3.5-flash",
      role: "vision",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen-vl-max",
      label: "qwen-vl-max",
      role: "vision",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: "unknown",
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen-vl-plus",
      label: "qwen-vl-plus",
      role: "vision",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: "unknown",
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
  ];
  const ABAKA_AI_TASK21_OCR_MODEL_OPTIONS = [];
  const ABAKA_AI_TASK21_REASONING_MODEL_OPTIONS = [
    {
      value: "qwen3.6-plus",
      label: "qwen3.6-plus",
      role: "reasoning",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3.6-flash",
      label: "qwen3.6-flash",
      role: "reasoning",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3.5-plus",
      label: "qwen3.5-plus",
      role: "reasoning",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3.5-flash",
      label: "qwen3.5-flash",
      role: "reasoning",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
  ];
  const ABAKA_AI_TASK21_SINGLE_MODEL_OPTIONS = [
    {
      value: "qwen3.6-plus",
      label: "qwen3.6-plus",
      role: "single",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3.6-flash",
      label: "qwen3.6-flash",
      role: "single",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3-vl-plus",
      label: "qwen3-vl-plus",
      role: "single",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: "unknown",
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3-vl-flash",
      label: "qwen3-vl-flash",
      role: "single",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: "unknown",
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3.5-plus",
      label: "qwen3.5-plus",
      role: "single",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen3.5-flash",
      label: "qwen3.5-flash",
      role: "single",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: true,
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen-vl-max",
      label: "qwen-vl-max",
      role: "single",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: "unknown",
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
    {
      value: "qwen-vl-plus",
      label: "qwen-vl-plus",
      role: "single",
      callMode: "openai-compatible-chat",
      supportsVision: true,
      supportsOcr: false,
      supportsThinking: "unknown",
      supportsJsonObject: true,
      docUrl: BAILIAN_DOC_URLS.helpVision,
    },
  ];
  const ABAKA_AI_TASK21_AI_MODEL_OPTIONS = clone(ABAKA_AI_TASK21_SINGLE_MODEL_OPTIONS);

  const MESSAGE_TYPES = {
    PANEL_PING: "ASR_EDGE_SETTINGS_PANEL_PING",
    JUDGEMENT_STATS_UPLOAD: "ASR_EDGE_JUDGEMENT_STATS_UPLOAD",
  };

  function normalizeBackendEndpointMode(value, fallback) {
    const fallbackText = String(fallback || "").trim().toLowerCase();
    const fallbackMode =
      fallbackText === BACKEND_ENDPOINT_MODE_LOCAL
        ? BACKEND_ENDPOINT_MODE_LOCAL
        : BACKEND_ENDPOINT_MODE_SERVER;
    const text = String(value || "").trim().toLowerCase();
    if (text === BACKEND_ENDPOINT_MODE_LOCAL || text === "localhost" || text === "127.0.0.1") {
      return BACKEND_ENDPOINT_MODE_LOCAL;
    }
    if (text === BACKEND_ENDPOINT_MODE_SERVER) {
      return BACKEND_ENDPOINT_MODE_SERVER;
    }
    return fallbackMode;
  }

  function inferBackendEndpointModeFromEndpoint(value, fallback) {
    const fallbackMode = normalizeBackendEndpointMode(fallback, BACKEND_ENDPOINT_MODE_SERVER);
    const text = String(value || "").trim().toLowerCase();
    if (!text) {
      return fallbackMode;
    }
    if (text.indexOf("127.0.0.1") >= 0 || text.indexOf("localhost") >= 0) {
      return BACKEND_ENDPOINT_MODE_LOCAL;
    }
    if (text.indexOf("http://") === 0 || text.indexOf("https://") === 0) {
      return BACKEND_ENDPOINT_MODE_SERVER;
    }
    return fallbackMode;
  }

  function getBackendBaseUrlsFromSettings(settings) {
    const meta = settings?.meta && typeof settings.meta === "object" ? settings.meta : {};
    const storedBaseUrls =
      meta.backendBaseUrls && typeof meta.backendBaseUrls === "object" ? meta.backendBaseUrls : {};
    return {
      server: normalizeBackendBaseUrl(
        storedBaseUrls.server,
        DEFAULT_BACKEND_BASE_URLS.server
      ),
      local: normalizeBackendBaseUrl(
        storedBaseUrls.local,
        DEFAULT_BACKEND_BASE_URLS.local
      ),
    };
  }

  function getBackendEndpointModeFromSettings(settings) {
    const mode =
      settings?.meta?.backendEndpointMode ||
      settings?.backend?.endpointMode ||
      settings?.backendEndpointMode;
    const normalizedMode = normalizeBackendEndpointMode(mode, BACKEND_ENDPOINT_MODE_SERVER);
    return normalizedMode;
  }

  function getBackendBaseUrlByMode(mode, settings) {
    const normalizedMode = normalizeBackendEndpointMode(mode, BACKEND_ENDPOINT_MODE_SERVER);
    const backendBaseUrls = getBackendBaseUrlsFromSettings(settings || {});
    return normalizedMode === BACKEND_ENDPOINT_MODE_LOCAL
      ? backendBaseUrls.local
      : backendBaseUrls.server;
  }

  function getBackendBaseUrlFromSettings(settings) {
    return getBackendBaseUrlByMode(getBackendEndpointModeFromSettings(settings), settings);
  }

  function buildBackendUrl(path, settingsOrMode) {
    const text = String(path || "").trim();
    if (!text) {
      return "";
    }
    if (/^https?:\/\//i.test(text)) {
      return text;
    }
    const mode =
      typeof settingsOrMode === "string"
        ? settingsOrMode
        : getBackendEndpointModeFromSettings(settingsOrMode || {});
    const baseUrl = getBackendBaseUrlByMode(mode, settingsOrMode || {}).replace(/\/+$/, "");
    const normalizedPath = text.charAt(0) === "/" ? text : "/" + text;
    return baseUrl + normalizedPath;
  }

  function buildDownloadUrl(path, settingsOrMode) {
    const text = String(path || "").trim();
    if (/^https?:\/\//i.test(text)) {
      return text;
    }
    const mode =
      typeof settingsOrMode === "string"
        ? settingsOrMode
        : getBackendEndpointModeFromSettings(settingsOrMode || {});
    const baseUrl = getBackendBaseUrlByMode(mode, settingsOrMode || {}).replace(/\/+$/, "");
    const suffix = text
      ? text.charAt(0) === "/"
        ? text
        : "/" + text
      : "/";
    return baseUrl + "/downloads" + suffix;
  }

  const TARGET_PLATFORM = {
    id: "alibaba-labelx",
    label: "Alibaba LabelX",
    host: "labelx.alibaba-inc.com",
    matches: ["https://labelx.alibaba-inc.com/*"],
  };

  const LIGHTWHEEL_PLATFORM = {
    id: "lightwheel",
    label: "Lightwheel",
    host: "label-cloud.lightwheel.net",
    matches: ["https://label-cloud.lightwheel.net/*"],
  };

  const DATA_BAKER_PLATFORM = {
    id: "data-baker",
    label: "标贝易采",
    host: "datafactory.data-baker.com",
    displayHost: "datafactory.data-baker.com/v2",
    entryUrl: "https://datafactory.data-baker.com/v2",
    matches: ["https://datafactory.data-baker.com/*"],
  };

  const MAGIC_DATA_PLATFORM = {
    id: "magic-data",
    label: "Magic Data ANNOTATOR",
    host: "work.magicdatatech.com",
    matches: ["https://work.magicdatatech.com/*"],
  };

  const ABAKA_AI_PLATFORM = {
    id: "abaka-ai",
    label: "Abaka AI",
    host: "abao.fortidyndns.com",
    displayHost: "abao.fortidyndns.com:30473",
    entryUrl: "http://abao.fortidyndns.com:30473",
    matches: ["http://abao.fortidyndns.com:30473/*"],
  };

  const HAITIAN_UTRANS_PLATFORM = {
    id: "haitian-utrans",
    label: "Haitian uTrans",
    host: "123.56.253.145:10070",
    displayHost: "uTrans /index.php?d=worker&c=work",
    entryUrl: "http://123.56.253.145:10070/index.php?d=worker&c=work",
    matches: ["http://*/*"],
  };

  const AISHELL_TECH_PLATFORM = {
    id: "aishell-tech",
    label: "希尔贝壳",
    host: "mark.aishelltech.com",
    matches: ["https://mark.aishelltech.com/*"],
  };

  const PAGE_OPTIONS = [
    "1 条/页",
    "2 条/页",
    "3 条/页",
    "4 条/页",
    "5 条/页",
    "10 条/页",
    "20 条/页",
    "30 条/页",
    "40 条/页",
    "50 条/页",
  ];

  const JUDGEMENT_AI_LISTEN_MODELS = [
    "qwen3.5-omni-flash",
    "qwen3-omni-flash",
    "qwen3.5-omni-plus",
  ];
  const JUDGEMENT_AI_COMPARE_MODELS = ["qwen3.5-plus", "qwen-plus", "qwen-turbo"];
  const JUDGEMENT_AI_AVAILABLE_MODELS = clone(JUDGEMENT_AI_COMPARE_MODELS);
  const JUDGEMENT_AI_ADVANCED_PARAM_DEFINITIONS = [
    {
      key: "aiSuggestionTemperature",
      apiKey: "temperature",
      label: "temperature",
      type: "number",
      min: 0,
      max: 2,
      step: 0.1,
      placeholder: "留空使用后端默认",
      help: "控制输出随机性，建议 0~0.5。",
      supported: true,
      target: "both",
    },
    {
      key: "aiSuggestionTopP",
      apiKey: "top_p",
      label: "top_p",
      type: "number",
      min: 0,
      max: 1,
      step: 0.05,
      placeholder: "留空使用后端默认",
      help: "核采样阈值，通常与 temperature 二选一微调。",
      supported: true,
      target: "both",
    },
    {
      key: "aiSuggestionMaxTokens",
      apiKey: "max_tokens",
      label: "max_tokens",
      type: "int",
      min: 1,
      max: 8192,
      step: 1,
      placeholder: "留空使用后端默认",
      help: "最大生成 token 数（兼容字段）。",
      supported: true,
      target: "both",
    },
    {
      key: "aiSuggestionMaxCompletionTokens",
      apiKey: "max_completion_tokens",
      label: "max_completion_tokens",
      type: "int",
      min: 1,
      max: 8192,
      step: 1,
      placeholder: "留空使用后端默认",
      help: "最大 completion token 数（新字段）。",
      supported: true,
      target: "both",
    },
    {
      key: "aiSuggestionPresencePenalty",
      apiKey: "presence_penalty",
      label: "presence_penalty",
      type: "number",
      min: -2,
      max: 2,
      step: 0.1,
      placeholder: "留空使用后端默认",
      help: "主题多样性惩罚。",
      supported: true,
      target: "both",
    },
    {
      key: "aiSuggestionFrequencyPenalty",
      apiKey: "frequency_penalty",
      label: "frequency_penalty",
      type: "number",
      min: -2,
      max: 2,
      step: 0.1,
      placeholder: "留空使用后端默认",
      help: "重复频率惩罚。",
      supported: true,
      target: "both",
    },
    {
      key: "aiSuggestionSeed",
      apiKey: "seed",
      label: "seed",
      type: "int",
      min: 0,
      max: 2147483647,
      step: 1,
      placeholder: "留空不发送",
      help: "固定随机种子，便于复现。",
      supported: true,
      target: "both",
    },
    {
      key: "aiSuggestionResponseFormat",
      apiKey: "response_format",
      label: "response_format",
      type: "enum",
      options: ["json_object", "text"],
      help: "快判默认建议 json_object。",
      supported: false,
      target: "both",
    },
    {
      key: "aiSuggestionStopSequences",
      apiKey: "stop",
      label: "stop sequences",
      type: "multiline",
      placeholder: "每行一个 stop 序列",
      help: "最多 8 行，每行最多 80 字。",
      supported: true,
      target: "both",
    },
    {
      key: "aiSuggestionEnableThinking",
      apiKey: "enable_thinking",
      label: "enable thinking / reasoning",
      type: "boolean",
      help:
        "关闭会显式传 enable_thinking=false，开启会显式传 enable_thinking=true；模型不支持时后端仅移除该参数重试一次。",
      supported: true,
      target: "both",
    },
    {
      key: "aiSuggestionReasoningEffort",
      apiKey: "reasoning_effort",
      label: "reasoningEffort",
      type: "enum",
      options: ["low", "medium", "high"],
      help: "当前快判链路暂不支持。",
      supported: false,
      target: "both",
    },
  ];

  const DEFAULT_CUSTOM_REPLACEMENTS = [
    { from: "小二,小恶,小乐,小额", to: "小饿" },
    { from: "小二小二,小额小额,小恶小恶", to: "小饿小饿" },
    { from: "批掉,劈掉", to: "p" },
    { from: "饿了吗,二了,饿了么？,饿了吧,饿了马", to: "饿了么" },
    { from: "淘宝选购,淘宝上购,淘宝返购", to: "淘宝闪购" },
    {
      from:
        "千份,千分,千万,先问,前问,前文,亲们,请吻,千吻,前吻,qw,家人们,千温,天问,钱问,钱文,千文,千味,田伟,田问,田文,亲我,前卫,钱伟,千闷,千梦",
      to: "千问",
    },
    { from: "请问请问,千万千万", to: "千问千问" },
    { from: "临时有名", to: "零食有鸣" },
    { from: "物探", to: "木炭" },
    { from: "河马", to: "盒马" },
    { from: "飞驰人生三,奔驰人生三,飞驰三,真实人生三", to: "《飞驰人生3》" },
    { from: "飞驰人生", to: "《飞驰人生》" },
    { from: "坦斯丁,塔斯丁", to: "塔斯汀" },
    { from: "博雅绝学,伯牙绝学", to: "伯牙绝弦" },
    { from: "VIVO", to: "vivo" },
    { from: "瑞星,瑞信", to: "瑞幸" },
    { from: "惊蛰无声", to: "《惊蛰无声》" },
    { from: "龙江猪脚饭", to: "隆江猪脚饭" },
    { from: "雨雨涵,余雨涵,雨余涵,俞宇航", to: "余宇涵" },
    { from: "李若陶", to: "李若桃" },
    { from: "风跑", to: "蜂跑" },
    { from: "一键到电,确认到电", to: "一键到店" },
    { from: "全部都电", to: "全部到店" },
    { from: "确认照片,确认到点,确认到地", to: "确认到店" },
    { from: "散购便利店", to: "闪购便利店" },
    { from: "申咐", to: "申诉" },
    { from: "舞栋", to: "5栋" },
    { from: "拒绝接待", to: "拒绝接单" },
    { from: "充门奖", to: "冲单奖" },
  ];

  const DEFAULT_CUSTOM_RATES = [
    { rate: 0.5, shortcut: createShortcut("f1") },
    { rate: 1.0, shortcut: createShortcut("f2") },
    { rate: 1.5, shortcut: createShortcut("f3") },
    { rate: 2.0, shortcut: createShortcut("f4") },
  ];

  const DEFAULT_ASR_CONFIG = {
    itemsPerPage: "50 条/页",
    autoPlay: true,
    defaultValid: false,
    fillOnValid: true,
    clearOnInvalid: true,
    autoNext: false,
    shortcutRemoveSpaces: createShortcut("h"),
    autoResetRate: false,
    resetRateValue: 1.5,
    playbackRateValue: 1.5,
    rateStepValue: 0.25,
    seekStepSeconds: 0.5,
    volumeValue: 100,
    autoClearInvalidValidation: false,
    autoFillOnValidValidation: false,
    autoFillOnLoad: false,
    numConvertMode: "千问",
    customReplacements: clone(DEFAULT_CUSTOM_REPLACEMENTS),
    customRates: clone(DEFAULT_CUSTOM_RATES),
    shortcutPanel: createShortcut("p", { ctrl: true }),
    shortcutPlayPause: createShortcut(" "),
    shortcutForward: createShortcut("arrowright"),
    shortcutBackward: createShortcut("arrowleft"),
    shortcutToggleFocus: createShortcut("tab"),
    shortcutVolUp: createShortcut("]"),
    shortcutVolDown: createShortcut("["),
    shortcutResetVol: createShortcut("\\"),
    shortcutSpeedDown: createShortcut("z"),
    shortcutSpeedUp: createShortcut("x"),
    shortcutResetSpeed: createShortcut("c"),
    shortcutValid: createShortcut("1"),
    shortcutInvalid: createShortcut("2"),
    shortcutFill: createShortcut("f"),
    shortcutConvertNum: createShortcut("v"),
    shortcutCopyDuration: createShortcut("b"),
    shortcutUploadStats: null,
    shortcutAiSuggest: null,
    shortcutApplyAiSuggestion: null,
    shortcutSubmitTask: null,
    shortcutSubmitTaskAndFinish: null,
    aiSuggestionRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
    statsUploadEnabled: true,
    statsUploadEndpoint: TRANSCRIPTION_STATS_SERVER_ENDPOINT,
    statsUploadTimes: ["10:00", "16:00"],
    statsUploadJitterMinutes: 10,
    statsAutoUploadOnSchedule: true,
    statsUploadRequestTimeoutMs: 20000,
  };

  const DEFAULT_JUDGEMENT_ASR_DIFF_COLORS = {
    changeBackground: "#fef3c7",
    gapBackground: "#fee2e2",
    punctuationBackground: "#ede9fe",
  };

  const DEFAULT_JUDGEMENT_ASR_CONFIG = {
    itemsPerPage: "50 条/页",
    autoPlay: true,
    autoResetRate: true,
    resetRateValue: 2.0,
    playbackRateValue: 2.0,
    rateStepValue: 0.25,
    seekStepSeconds: 0.5,
    volumeValue: 100,
    virtualWindowEnabled: false,
    asrDiffViewEnabled: true,
    asrDiffColors: clone(DEFAULT_JUDGEMENT_ASR_DIFF_COLORS),
    compactCardEnabled: true,
    thunderQuestionEnabled: true,
    autoAdvanceAfterChoice: false,
    statsUploadEnabled: true,
    statsUploadEndpoint:
      JUDGEMENT_STATS_SERVER_ENDPOINT,
    statsScheduleUrl: "",
    statsUploadTimes: ["10:00", "16:00"],
    statsUploadJitterMinutes: 10,
    statsAutoUploadOnSubtaskOpen: false,
    statsAutoUploadOnSchedule: true,
    statsUploadRequestTimeoutMs: 20000,
    aiSuggestionEnabled: true,
    aiSuggestionEndpoint: JUDGEMENT_AI_SUGGEST_SERVER_ENDPOINT,
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
    aiSuggestionAvailableModels: clone(JUDGEMENT_AI_AVAILABLE_MODELS),
    shortcuts: {
      choiceFirstBetter: createShortcut("1"),
      choiceSecondBetter: createShortcut("2"),
      choiceBothBad: createShortcut("3"),
      choiceUnsure: createShortcut("4"),
      choiceOtherDialect: createShortcut("5"),
      volumeUp: createShortcut("["),
      volumeDown: createShortcut("]"),
      volumeReset: createShortcut("\\"),
      rateUp: null,
      rateDown: null,
      rateReset: null,
      seekBackward: createShortcut("ArrowLeft"),
      seekForward: createShortcut("ArrowRight"),
      playPause: createShortcut("Space"),
      aiSuggestCurrentItem: null,
      applyAiSuggestion: null,
      retryAiSuggestion: null,
      ignoreAiSuggestion: null,
      copyAsrTextPair: null,
      submitTask: null,
      submitTaskAndFinish: null,
    },
  };

  const JUDGEMENT_SHORTCUT_ACTIONS = [
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

  const JUDGEMENT_PROJECT_ASR_KEYS = [
    "itemsPerPage",
    "autoPlay",
    "autoResetRate",
    "resetRateValue",
    "playbackRateValue",
    "rateStepValue",
    "seekStepSeconds",
    "volumeValue",
    "virtualWindowEnabled",
    "asrDiffViewEnabled",
    "asrDiffColors",
    "compactCardEnabled",
    "autoAdvanceAfterChoice",
    "statsUploadEnabled",
    "statsUploadEndpoint",
    "statsScheduleUrl",
    "statsUploadTimes",
    "statsUploadJitterMinutes",
    "statsAutoUploadOnSubtaskOpen",
    "statsAutoUploadOnSchedule",
    "statsUploadRequestTimeoutMs",
    "aiSuggestionEnabled",
    "aiSuggestionEndpoint",
    "aiSuggestionRequestTimeoutMs",
    "aiSuggestionListenModel",
    "aiSuggestionCompareModel",
    "aiSuggestionListenPrompt",
    "aiSuggestionComparePrompt",
    "aiSuggestionTemperature",
    "aiSuggestionTopP",
    "aiSuggestionMaxTokens",
    "aiSuggestionMaxCompletionTokens",
    "aiSuggestionPresencePenalty",
    "aiSuggestionFrequencyPenalty",
    "aiSuggestionSeed",
    "aiSuggestionResponseFormat",
    "aiSuggestionReasoningEffort",
    "aiSuggestionStopSequences",
    "aiSuggestionEnableThinking",
    "aiSuggestionWebSearchEnabled",
    "aiSuggestionModel",
    "aiSuggestionAvailableModels",
    "shortcuts",
  ];

  const SCRIPT_PROJECTS = {
    transcription: {
      id: TRANSCRIPTION_PROJECT_ID,
      shortLabel: "语音转写",
      label: "普通话语音转写",
      description: "基础转写能力（当前题处理 + 当前音频控制 + 页面工具栏）。",
      note: "支持当前题 AI 推荐（人工确认填入），不自动保存/提交/流转；保持轻量统计导出能力。",
      capabilityScope: "basic-transcription",
    },
    judgement: {
      id: JUDGEMENT_PROJECT_ID,
      shortLabel: "语音判别",
      label: "普通话语音判别",
      description: "同域名下的轻量音频判别项目。",
      note: "当前启用音量、倍速、快捷键提示与自动播放音频能力。",
      capabilityScope: "audio-lite",
    },
  };

  const PLATFORM_LIBRARY = {
    alibabaLabelx: {
      id: ALIBABA_LABELX_PLATFORM_ID,
      label: "Alibaba LabelX",
      host: TARGET_PLATFORM.host,
      matches: clone(TARGET_PLATFORM.matches),
      runtimeBridge: "labelx-content",
      description: "阿里内部 LabelX 标注/审核平台。",
    },
    lightwheel: {
      id: LIGHTWHEEL_PLATFORM_ID,
      label: "Lightwheel",
      host: LIGHTWHEEL_PLATFORM.host,
      matches: clone(LIGHTWHEEL_PLATFORM.matches),
      runtimeBridge: "none",
      description: "Lightwheel 视频标注查看态平台。",
    },
    dataBaker: {
      id: DATA_BAKER_PLATFORM_ID,
      label: "标贝易采",
      host: DATA_BAKER_PLATFORM.host,
      displayHost: DATA_BAKER_PLATFORM.displayHost,
      entryUrl: DATA_BAKER_PLATFORM.entryUrl,
      matches: clone(DATA_BAKER_PLATFORM.matches),
      runtimeBridge: "data-baker-round-one-quality",
      description: "标贝易采质检站点。",
    },
    magicData: {
      id: MAGIC_DATA_PLATFORM_ID,
      label: "Magic Data ANNOTATOR",
      host: MAGIC_DATA_PLATFORM.host,
      matches: clone(MAGIC_DATA_PLATFORM.matches),
      runtimeBridge: "magic-data-assistants",
      description: "Magic Data 当前条 AI 质检助手平台（客家话/闽南语）。",
    },
    abakaAi: {
      id: ABAKA_AI_PLATFORM_ID,
      label: "Abaka AI",
      host: ABAKA_AI_PLATFORM.host,
      displayHost: ABAKA_AI_PLATFORM.displayHost,
      entryUrl: ABAKA_AI_PLATFORM.entryUrl,
      matches: clone(ABAKA_AI_PLATFORM.matches),
      runtimeBridge: "abaka-ai-task-page-capture",
      description: "Abaka AI 任务页结构与 Network 只读采集平台。",
    },
    haitianUtrans: {
      id: HAITIAN_UTRANS_PLATFORM_ID,
      label: "Haitian uTrans",
      host: HAITIAN_UTRANS_PLATFORM.host,
      displayHost: HAITIAN_UTRANS_PLATFORM.displayHost,
      entryUrl: HAITIAN_UTRANS_PLATFORM.entryUrl,
      matches: clone(HAITIAN_UTRANS_PLATFORM.matches),
      runtimeBridge: "haitian-utrans-audio-download-helper",
      description: "uTrans 任务详情页悬浮音频下载助手平台。",
    },
    aishellTech: {
      id: AISHELL_TECH_PLATFORM_ID,
      label: "希尔贝壳",
      host: AISHELL_TECH_PLATFORM.host,
      matches: clone(AISHELL_TECH_PLATFORM.matches),
      runtimeBridge: "aishell-tech-assistants",
      description: "希尔贝壳标注页语言助手平台（闽南语/越南语/泰语）。",
    },
  };

  const SCRIPT_LIBRARY = {
    transcription: {
      id: TRANSCRIPTION_PROJECT_ID,
      platformId: ALIBABA_LABELX_PLATFORM_ID,
      label: SCRIPT_PROJECTS.transcription.label,
      shortLabel: SCRIPT_PROJECTS.transcription.shortLabel,
      description: SCRIPT_PROJECTS.transcription.description,
      note: SCRIPT_PROJECTS.transcription.note,
      capabilityScope: SCRIPT_PROJECTS.transcription.capabilityScope,
      statusLabel: "基础能力阶段",
      detailView: "labelx-transcription",
    },
    judgement: {
      id: JUDGEMENT_PROJECT_ID,
      platformId: ALIBABA_LABELX_PLATFORM_ID,
      label: SCRIPT_PROJECTS.judgement.label,
      shortLabel: SCRIPT_PROJECTS.judgement.shortLabel,
      description: SCRIPT_PROJECTS.judgement.description,
      note: SCRIPT_PROJECTS.judgement.note,
      capabilityScope: SCRIPT_PROJECTS.judgement.capabilityScope,
      statusLabel: "已接入音频基础能力",
      detailView: "labelx-judgement",
    },
    lightwheelViewPanel: {
      id: LIGHTWHEEL_VIEW_PANEL_SCRIPT_ID,
      platformId: LIGHTWHEEL_PLATFORM_ID,
      label: "Lightwheel 查看态面板",
      shortLabel: "查看态面板",
      description:
        "access=1 查看态面板：状态筛选、名称列表、上下条跳转、编辑回退与 access-key 处理。",
      note: "当前扩展版先纳入脚本中心管理与 URL 检测，运行时迁移待继续接入。",
      capabilityScope: "legacy-reference-only",
      statusLabel: "待迁移",
      detailView: "lightwheel-view-panel",
      host: LIGHTWHEEL_PLATFORM.host,
      pathPattern: "^/w/video3/index\\.html$",
      requiredQuery: {
        access: "1",
      },
    },
    dataBakerRoundOneQuality: {
      id: DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID,
      platformId: DATA_BAKER_PLATFORM_ID,
      label: "闽南语助手",
      shortLabel: "闽南语助手",
      description: "标贝易采 roundOneCollect 页面闽南语 AI 推荐文本能力。",
      note:
        "当前只提供单条 AI 推荐文本，不自动保存、提交、批量识别或自动流转。",
      capabilityScope: "ai-recommend-text",
      statusLabel: "闽南语助手",
      detailView: "data-baker-round-one-quality",
      host: DATA_BAKER_PLATFORM.host,
      matchUrl:
        "https://datafactory.data-baker.com/v2/#/quality/roundOneCollect?collectId=...&checkType=0",
    },
    magicDataAnnotatorAiReview: {
      id: MAGIC_DATA_ANNOTATOR_SCRIPT_ID,
      platformId: MAGIC_DATA_PLATFORM_ID,
      label: "客家话助手",
      shortLabel: "客家话助手",
      description: "用于 Magic Data #/asrmark 当前条客家话规则质检，不自动保存、不自动提交。",
      note: "页面内结果区仅辅助复核，平台两行文本为基准答案，AI 输出以风险提示为主。",
      capabilityScope: "rule-first-ai-review",
      statusLabel: "客家话助手",
      detailView: "magic-data-annotator-ai-review",
      host: MAGIC_DATA_PLATFORM.host,
      matchUrl: "https://work.magicdatatech.com/#/asrmark?taskItemId=...",
    },
    magicDataMinnanAssistant: {
      id: MAGIC_DATA_MINNAN_SCRIPT_ID,
      platformId: MAGIC_DATA_PLATFORM_ID,
      label: "闽南语助手",
      shortLabel: "闽南语助手",
      description: "用于 Magic Data #/asrmark 当前条闽南语规则质检，不自动保存、不自动提交。",
      note: "页面内结果区仅辅助复核，平台两行文本为基准答案，AI 输出以风险提示为主。",
      capabilityScope: "rule-first-ai-review",
      statusLabel: "闽南语助手",
      detailView: "magic-data-minnan-assistant",
      host: MAGIC_DATA_PLATFORM.host,
      matchUrl: "https://work.magicdatatech.com/#/asrmark?taskItemId=...",
    },
    abakaAiTaskPageCapture: {
      id: ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID,
      platformId: ABAKA_AI_PLATFORM_ID,
      label: "Task21助手",
      shortLabel: "Task21助手",
      description:
        "Task21 same_font、文本移除和 other_changes 的快捷键与 AI 辅助填写。",
      note:
        "快捷键与按钮动作仅 DOM 点击；AI 面板仅调用统一后端分析，不自动保存/提交/送审。",
      capabilityScope: "task21-shortcuts-and-ai-analysis-debug",
      statusLabel: "Task21 助手",
      detailView: "abaka-ai-task-page-capture",
      host: ABAKA_AI_PLATFORM.host,
      matchUrl: "http://abao.fortidyndns.com:30473/login",
    },
    haitianUtransAudioDownloadHelper: {
      id: HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID,
      platformId: HAITIAN_UTRANS_PLATFORM_ID,
      label: "音频下载助手",
      shortLabel: "音频下载助手",
      description: "uTrans 任务详情页悬浮窗音频下载助手。",
      note:
        "当前只提供“下载当前音频”悬浮按钮；不做预览、不做批量、不做自动下载，也不改动平台提交链路。",
      capabilityScope: "current-audio-download",
      statusLabel: "音频下载助手",
      detailView: "haitian-utrans-audio-download-helper",
      host: HAITIAN_UTRANS_PLATFORM.host,
      matchUrl:
        "http://123.56.253.145:10070/index.php?d=worker&c=work&uid=...&project_id=...&process_id=...&task_id=...",
    },
    aishellTechMinnanAssistant: {
      id: AISHELL_TECH_MINNAN_SCRIPT_ID,
      platformId: AISHELL_TECH_PLATFORM_ID,
      label: "闽南语助手",
      shortLabel: "闽南语助手",
      description: "希尔贝壳 /mytask/mark 当前条推荐文本与批量串行保存助手。",
      note:
        "批量模式只处理当前分包，从当前选中条开始跳过已完成条目；每条填入后点击页面真实保存按钮，不自动提交任务。",
      capabilityScope: "ai-recommend-text-with-real-save",
      statusLabel: "闽南语助手",
      detailView: "aishell-tech-minnan-helper",
      host: AISHELL_TECH_PLATFORM.host,
      matchUrl:
        "https://mark.aishelltech.com/mytask/mark?taskId=...&packageId=...",
    },
    aishellTechVietnameseAssistant: {
      id: AISHELL_TECH_VIETNAMESE_SCRIPT_ID,
      platformId: AISHELL_TECH_PLATFORM_ID,
      label: "越南语助手",
      shortLabel: "越南语助手",
      description: "希尔贝壳 /mytask/mark 越南语单模型识别、语速建议与批量串行保存助手。",
      note:
        "批量模式只处理当前分包；AI 请求并发预取，页面填入文本与语速并点击真实保存按钮严格串行；不自动提交任务。",
      capabilityScope: "ai-recommend-text-and-speed-with-real-save",
      statusLabel: "越南语助手",
      detailView: "aishell-tech-vietnamese-helper",
      host: AISHELL_TECH_PLATFORM.host,
      matchUrl:
        "https://mark.aishelltech.com/mytask/mark?taskId=...&packageId=...",
    },
    aishellTechThaiAssistant: {
      id: AISHELL_TECH_THAI_SCRIPT_ID,
      platformId: AISHELL_TECH_PLATFORM_ID,
      label: "泰语助手",
      shortLabel: "泰语助手",
      description: "希尔贝壳 /mytask/mark 泰语单模型识别与语速建议串行保存助手。",
      note:
        "批量模式只处理当前分包；AI 请求并发预取，页面填入文本与语速并点击真实保存按钮严格串行；不自动提交任务。",
      capabilityScope: "ai-recommend-text-and-speed-with-real-save",
      statusLabel: "泰语助手",
      detailView: "aishell-tech-thai-helper",
      host: AISHELL_TECH_PLATFORM.host,
      matchUrl:
        "https://mark.aishelltech.com/mytask/mark?taskId=...&packageId=...",
    },
    aishellTechCnEnShortDrama: {
      id: AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID,
      platformId: AISHELL_TECH_PLATFORM_ID,
      label: "中英短剧脚本",
      shortLabel: "中英短剧脚本",
      description: "希尔贝壳 /mytask/mark 当前媒体信息只读面板。",
      note:
        "当前版本只展示题目、模板、总时长、分段数、视频和音频；不接入 AI 推荐，不自动保存，不自动提交任务。",
      capabilityScope: "readonly-current-media-panel",
      statusLabel: "中英短剧脚本",
      detailView: "aishell-tech-cn-en-short-drama",
      host: AISHELL_TECH_PLATFORM.host,
      matchUrl:
        "https://mark.aishelltech.com/mytask/mark?taskId=...&packageId=...",
    },
  };

  const SHORTCUT_DEFINITIONS = [
    { key: "shortcutPanel", label: "面板开关" },
    { key: "shortcutPlayPause", label: "播放 / 暂停" },
    { key: "shortcutValid", label: "标记有效" },
    { key: "shortcutInvalid", label: "标记无效" },
    { key: "shortcutFill", label: "快速填入" },
    { key: "shortcutToggleFocus", label: "切换输入(焦点)" },
    { key: "shortcutConvertNum", label: "转当前选择阿拉伯数字" },
    { key: "shortcutSpeedDown", label: "倍速 -0.1" },
    { key: "shortcutSpeedUp", label: "倍速 +0.1" },
    { key: "shortcutResetSpeed", label: "重置倍速" },
    { key: "shortcutBackward", label: "后退 1 秒" },
    { key: "shortcutForward", label: "前进 1 秒" },
    { key: "shortcutCopyDuration", label: "复制总时长(秒)" },
    { key: "shortcutVolDown", label: "音量 -50%" },
    { key: "shortcutVolUp", label: "音量 +50%" },
    { key: "shortcutResetVol", label: "重置音量 (100%)" },
    { key: "shortcutRemoveSpaces", label: "去除当前空格" },
    { key: "shortcutUploadStats", label: "上传转写统计" },
    { key: "shortcutAiSuggest", label: "AI 推荐当前题" },
    { key: "shortcutApplyAiSuggestion", label: "填入 AI 推荐" },
    { key: "shortcutSubmitTask", label: "提交任务" },
    { key: "shortcutSubmitTaskAndFinish", label: "提交任务并结束" },
  ];

  const SHORTCUT_KEYS = SHORTCUT_DEFINITIONS.map(function (item) {
    return item.key;
  });

  const SHORTCUT_COMPATIBILITY_MAP = {
    panel: "shortcutPanel",
    playPause: "shortcutPlayPause",
    valid: "shortcutValid",
    invalid: "shortcutInvalid",
    quickfill: "shortcutFill",
    toggleFocus: "shortcutToggleFocus",
    convertNumbers: "shortcutConvertNum",
    speedDown: "shortcutSpeedDown",
    speedUp: "shortcutSpeedUp",
    resetSpeed: "shortcutResetSpeed",
    backward: "shortcutBackward",
    forward: "shortcutForward",
    copyDuration: "shortcutCopyDuration",
    volumeDown: "shortcutVolDown",
    volumeUp: "shortcutVolUp",
    resetVolume: "shortcutResetVol",
    removeSpaces: "shortcutRemoveSpaces",
    uploadStats: "shortcutUploadStats",
    aiSuggest: "shortcutAiSuggest",
    applyAiSuggestion: "shortcutApplyAiSuggestion",
    submitTask: "shortcutSubmitTask",
    submitTaskAndFinish: "shortcutSubmitTaskAndFinish",
  };

  const BOOLEAN_CONFIG_KEYS = [
    "autoPlay",
    "defaultValid",
    "fillOnValid",
    "clearOnInvalid",
    "autoNext",
    "autoResetRate",
    "autoClearInvalidValidation",
    "autoFillOnValidValidation",
    "autoFillOnLoad",
  ];

  const NUMBER_CONFIG_KEYS = [
    "resetRateValue",
    "playbackRateValue",
    "rateStepValue",
    "seekStepSeconds",
    "volumeValue",
  ];

  const STRING_CONFIG_KEYS = ["itemsPerPage", "numConvertMode"];

  const ASR_CONFIG_KEYS = Object.keys(DEFAULT_ASR_CONFIG);

  const LEGACY_ROOT_DEBUG_KEY = "asr_debug_mode";
  const LEGACY_ROOT_CACHE_KEYS = {
    lastUpdateCheckTime: "asr_last_update_check_time",
    scriptVersion: "asr_script_version",
    currentTotalDuration: "currentTotalDuration",
    audioFilenameToDuration: "audioFilenameToDuration",
    cachedDataList: "cachedDataList",
  };

  const DEFAULT_CACHE = {
    lastUpdateCheckTime: 0,
    scriptVersion: "0",
    currentTotalDuration: 0,
    audioFilenameToDuration: {},
    cachedDataList: [],
    versionCheck: null,
    runtime: {},
  };

  const BUSINESS_ACTIONS = [
    { key: "checkUpdate", label: "手动检查更新", placeholder: "待接版本检查" },
    { key: "syncDictionary", label: "同步云端词库", placeholder: "待接云端词库同步" },
    { key: "uploadDictionary", label: "上传本地数据", placeholder: "待接词库上传" },
  ];

  function createShortcutMapFromAsr(asrConfig) {
    const map = {};
    Object.keys(SHORTCUT_COMPATIBILITY_MAP).forEach(function (compatKey) {
      const sourceKey = SHORTCUT_COMPATIBILITY_MAP[compatKey];
      map[compatKey] = clone(asrConfig[sourceKey]);
    });
    return map;
  }

  function createDefaultPlatformSettings() {
    const asr = clone(DEFAULT_ASR_CONFIG);

    return {
      enabled: true,
      scriptCenter: {
        activeProjectId: TRANSCRIPTION_PROJECT_ID,
        projects: {
          transcription: {
            id: TRANSCRIPTION_PROJECT_ID,
            label: SCRIPT_PROJECTS.transcription.label,
            shortLabel: SCRIPT_PROJECTS.transcription.shortLabel,
            description: SCRIPT_PROJECTS.transcription.description,
            note: SCRIPT_PROJECTS.transcription.note,
            capabilityScope: SCRIPT_PROJECTS.transcription.capabilityScope,
            active: true,
            asrConfig: clone(asr),
          },
          judgement: {
            id: JUDGEMENT_PROJECT_ID,
            label: SCRIPT_PROJECTS.judgement.label,
            shortLabel: SCRIPT_PROJECTS.judgement.shortLabel,
            description: SCRIPT_PROJECTS.judgement.description,
            note: SCRIPT_PROJECTS.judgement.note,
            capabilityScope: SCRIPT_PROJECTS.judgement.capabilityScope,
            active: false,
            asrConfig: clone(DEFAULT_JUDGEMENT_ASR_CONFIG),
          },
        },
      },
      annotation: {
        itemsPerPage: asr.itemsPerPage,
        autoPlay: asr.autoPlay,
        defaultValid: asr.defaultValid,
        fillOnValid: asr.fillOnValid,
        clearOnInvalid: asr.clearOnInvalid,
        autoNext: asr.autoNext,
        autoResetRate: asr.autoResetRate,
        resetRateValue: asr.resetRateValue,
        playbackRateValue: asr.playbackRateValue,
        rateStepValue: asr.rateStepValue,
        seekStepSeconds: asr.seekStepSeconds,
        volumeValue: asr.volumeValue,
        autoClearInvalidValidation: asr.autoClearInvalidValidation,
        autoFillOnValidValidation: asr.autoFillOnValidValidation,
        autoFillOnLoad: asr.autoFillOnLoad,
        numConvertMode: asr.numConvertMode,
        shortcuts: createShortcutMapFromAsr(asr),
        customReplacements: clone(asr.customReplacements),
        customRates: clone(asr.customRates),
      },
      automation: {
        autoAssignCheckTasks: false,
        autoAssignTaskKeyword: "",
        autoAssignTargetUser: "",
        autoAssignBatchSize: 0,
        autoAssignAllTasks: false,
        autoAssignFetchAll: false,
        autoAssignPollIntervalMs: 60000,
        autoBatchSubmit: false,
        autoBatchSubmitDelayMs: 10000,
        autoNavigateNextTask: false,
        autoFillOnLoad: asr.autoFillOnLoad,
        validateBeforeSubmit: false,
        autoSubmitAfterValidation: false,
        autoReceiveOnSubmit: false,
      },
      aiPunctuation: {
        apiKey: "",
        useAdvancedRules: false,
        model: "",
      },
      ai: {
        qwenApiKey: "",
        useAdvancedRules: false,
        qwenModel: "",
      },
      dictionary: {
        customReplacements: clone(asr.customReplacements),
        lastSyncedAt: null,
        lastUploadedAt: null,
      },
      safety: {
        interceptPlatformAutosave: true,
        blurBeforeManualSave: false,
        submitRequiresManualSave: false,
        uploadStatsBeforeSubmit: false,
        reloadAfterBulkSave: false,
        saveReloadDelayMs: 1200,
        validateBeforeSubmit: false,
        autoClearInvalidValidation: asr.autoClearInvalidValidation,
        autoFillOnValidValidation: asr.autoFillOnValidValidation,
        autoSubmitAfterValidation: false,
      },
      legacyServer: {
        apiBaseUrl: "http://47.108.254.138:3101",
        debugApiBaseUrl: "http://127.0.0.1:3101",
        useDebugApiBaseUrl: false,
        requestTimeoutMs: 20000,
        updateManifestUrl: "",
      },
      reporting: {
        itemsPerPage: asr.itemsPerPage,
        exportUploadEnabled: true,
      },
    };
  }

  function createDefaultLightwheelPlatformSettings() {
    return {
      enabled: false,
      scripts: {
        viewPanel: {
          id: LIGHTWHEEL_VIEW_PANEL_SCRIPT_ID,
          enabled: false,
          migrationStatus: "legacy-reference-only",
          note:
            "legacy-reference/Lightwheel 查看态面板.js 已纳入参考，扩展版运行时待迁移。",
        },
      },
    };
  }

  function createDefaultDataBakerPlatformSettings() {
    const shortcuts = {};
    DATABAKER_ROUND_ONE_SHORTCUT_ACTIONS.forEach(function (action) {
      shortcuts[action.key] = null;
    });
    shortcuts.autoFillQualifiedItem = createShortcut("q", { alt: true });

    return {
      enabled: true,
      scripts: {
        roundOneQuality: {
          id: DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID,
          enabled: true,
          aiRecommendEnabled: true,
          aiRecommendEndpoint: DATABAKER_AI_RECOMMEND_SERVER_ENDPOINT,
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
          shortcuts: shortcuts,
        },
      },
    };
  }

  function normalizeDataBakerRecognitionModeValue(value, fallback) {
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

  function getDataBakerModelValue(value) {
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

  function isDataBakerOmniModelValue(value) {
    const model = getDataBakerModelValue(value);
    return DATABAKER_AI_OMNI_MODEL_VALUES.indexOf(model) >= 0;
  }

  function getDataBakerAiQualifiedAutofillConcurrencyRule(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const recognitionMode = normalizeDataBakerRecognitionModeValue(
      source.recognitionMode || source.aiRecommendPipelineMode || source.pipelineMode,
      "two_stage"
    );
    const listenModel = getDataBakerModelValue(
      source.listenModel || source.aiRecommendListenModel
    );
    const singleModel = getDataBakerModelValue(
      source.singleModel || source.aiRecommendSingleModel || source.aiModel
    );
    if (recognitionMode === "two_stage" && listenModel === "fun-asr") {
      return {
        min: 1,
        max: 50,
        defaultValue: 5,
        modelType: "fun_asr",
      };
    }
    if (recognitionMode === "omni_single" && isDataBakerOmniModelValue(singleModel)) {
      return {
        min: 1,
        max: 25,
        defaultValue: 5,
        modelType: "omni",
      };
    }
    if (recognitionMode === "two_stage" && isDataBakerOmniModelValue(listenModel)) {
      return {
        min: 1,
        max: 25,
        defaultValue: 5,
        modelType: "omni",
      };
    }
    return {
      min: 1,
      max: 25,
      defaultValue: 5,
      modelType: "omni",
    };
  }

  function normalizeDataBakerAiQualifiedAutofillConcurrency(value, settings) {
    const rule = getDataBakerAiQualifiedAutofillConcurrencyRule(settings);
    const numeric = Number(value);
    const base = Number.isFinite(numeric) ? Math.round(numeric) : rule.defaultValue;
    return Math.max(rule.min, Math.min(rule.max, base));
  }

  function createDefaultAbakaAiPlatformSettings() {
    const shortcuts = createEmptyShortcutMap(ABAKA_AI_TASK21_SHORTCUT_ACTIONS);
    return {
      enabled: true,
      scripts: {
        taskPageCapture: {
          id: ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID,
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
          shortcuts: shortcuts,
        },
      },
    };
  }

  function createDefaultHaitianUtransPlatformSettings() {
    return {
      enabled: true,
      scripts: {
        audioDownloadHelper: {
          id: HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID,
          enabled: true,
        },
      },
    };
  }

  function createDefaultAishellTechPlatformSettings() {
    const minnanShortcuts = createEmptyShortcutMap(AISHELL_TECH_MINNAN_SHORTCUT_ACTIONS);
    const vietnameseShortcuts = createEmptyShortcutMap(AISHELL_TECH_VIETNAMESE_SHORTCUT_ACTIONS);
    const thaiShortcuts = createEmptyShortcutMap(AISHELL_TECH_THAI_SHORTCUT_ACTIONS);
    const cnEnShortDramaShortcuts = createEmptyShortcutMap(
      AISHELL_TECH_CN_EN_SHORT_DRAMA_SHORTCUT_ACTIONS
    );

    return {
      enabled: true,
      activeScriptId: AISHELL_TECH_MINNAN_SCRIPT_ID,
      scripts: {
        minnanHelper: {
          id: AISHELL_TECH_MINNAN_SCRIPT_ID,
          enabled: true,
          aiRecommendEnabled: true,
          aiRecommendEndpoint: AISHELL_TECH_AI_RECOMMEND_SERVER_ENDPOINT,
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
          aiRecommendEnableThinking: false,
          shortcuts: minnanShortcuts,
        },
        vietnameseHelper: {
          id: AISHELL_TECH_VIETNAMESE_SCRIPT_ID,
          enabled: false,
          aiRecommendEnabled: false,
          aiRecommendEndpoint: AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_SERVER_ENDPOINT,
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
          aiRecommendEnableThinking: false,
          shortcuts: vietnameseShortcuts,
        },
        thaiHelper: {
          id: AISHELL_TECH_THAI_SCRIPT_ID,
          enabled: false,
          aiRecommendEnabled: false,
          aiRecommendEndpoint: AISHELL_TECH_THAI_AI_RECOMMEND_SERVER_ENDPOINT,
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
          aiRecommendEnableThinking: false,
          shortcuts: thaiShortcuts,
        },
        cnEnShortDrama: {
          id: AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID,
          enabled: false,
          aiRecommendEnabled: false,
          shortcuts: cnEnShortDramaShortcuts,
        },
      },
    };
  }

  const DEFAULT_SETTINGS = {
    stage: STAGE_ID,
    scriptCenter: {
      projects: {
        magicDataAnnotator: {
          enabled: true,
          aiReviewEnabled: true,
          aiReviewModelMode: "two_stage",
          aiReviewRecognitionStrategy: "direct_dialect",
          aiReviewRecognitionMode: "two_stage",
          aiReviewListenModel: "qwen3.5-omni-flash",
          aiReviewCompareModel: "qwen3.5-flash",
          aiReviewSingleModel: "qwen3.5-omni-flash",
          aiReviewEnableThinking: false,
          listenModel: "qwen3.5-omni-flash",
          reviewModel: "qwen3.5-flash",
          reviewMode: "rule_first",
          showHeardText: true,
          showEstimatedIncome: true,
          enableThinking: false,
          aiReviewRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
          aiReviewListenPrompt: "",
          aiReviewComparePrompt: "",
          aiReviewTemperature: "",
          aiReviewTopP: "",
          aiReviewMaxTokens: "",
          aiReviewMaxCompletionTokens: "",
          aiReviewPresencePenalty: "",
          aiReviewFrequencyPenalty: "",
          aiReviewSeed: "",
          aiReviewStopSequences: "",
          shortcuts: {},
        },
        magicDataMinnanAssistant: {
          enabled: false,
          aiReviewEnabled: false,
          aiReviewModelMode: "two_stage",
          aiReviewRecognitionStrategy: "direct_dialect",
          aiReviewRecognitionMode: "two_stage",
          aiReviewListenModel: "qwen3.5-omni-flash",
          aiReviewCompareModel: "qwen3.5-plus",
          aiReviewSingleModel: "qwen3.5-omni-flash",
          aiReviewEnableThinking: false,
          listenModel: "qwen3.5-omni-flash",
          reviewModel: "qwen3.5-plus",
          reviewMode: "rule_first",
          showHeardText: true,
          showEstimatedIncome: true,
          enableThinking: false,
          aiReviewRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
          aiReviewListenPrompt: "",
          aiReviewComparePrompt: "",
          aiReviewTemperature: "",
          aiReviewTopP: "",
          aiReviewMaxTokens: "",
          aiReviewMaxCompletionTokens: "",
          aiReviewPresencePenalty: "",
          aiReviewFrequencyPenalty: "",
          aiReviewSeed: "",
          aiReviewStopSequences: "",
          shortcuts: {},
        },
      },
    },
    platforms: {
      alibabaLabelx: createDefaultPlatformSettings(),
      lightwheel: createDefaultLightwheelPlatformSettings(),
      dataBaker: createDefaultDataBakerPlatformSettings(),
      magicData: {
        enabled: true,
        activeScriptId: MAGIC_DATA_ANNOTATOR_SCRIPT_ID,
        scripts: {
          hakkaHelper: {
            id: MAGIC_DATA_ANNOTATOR_SCRIPT_ID,
            enabled: true,
            aiReviewEnabled: true,
            aiReviewModelMode: "two_stage",
            aiReviewRecognitionStrategy: "direct_dialect",
            aiReviewRecognitionMode: "two_stage",
            aiReviewListenModel: "qwen3.5-omni-flash",
            aiReviewCompareModel: "qwen3.5-flash",
            aiReviewSingleModel: "qwen3.5-omni-flash",
            aiReviewEnableThinking: false,
            listenModel: "qwen3.5-omni-flash",
            reviewModel: "qwen3.5-flash",
            reviewMode: "rule_first",
            showHeardText: true,
            showEstimatedIncome: true,
            enableThinking: false,
            aiReviewRequestTimeoutMs: DEFAULT_AI_REQUEST_TIMEOUT_MS,
            aiReviewListenPrompt: "",
            aiReviewComparePrompt: "",
            aiReviewTemperature: "",
            aiReviewTopP: "",
            aiReviewMaxTokens: "",
            aiReviewMaxCompletionTokens: "",
            aiReviewPresencePenalty: "",
            aiReviewFrequencyPenalty: "",
            aiReviewSeed: "",
            aiReviewStopSequences: "",
            shortcuts: {},
          },
          minnanHelper: {
            id: MAGIC_DATA_MINNAN_SCRIPT_ID,
            enabled: false,
            aiReviewEnabled: false,
          },
        },
      },
      abakaAi: createDefaultAbakaAiPlatformSettings(),
      haitianUtrans: createDefaultHaitianUtransPlatformSettings(),
      aishellTech: createDefaultAishellTechPlatformSettings(),
    },
    asr: clone(DEFAULT_ASR_CONFIG),
    debug: {
      enabled: false,
      lastToggledAt: null,
    },
    cache: clone(DEFAULT_CACHE),
    meta: {
      schemaVersion: SCHEMA_VERSION,
      backendEndpointMode: BACKEND_ENDPOINT_MODE_SERVER,
      backendBaseUrls: clone(DEFAULT_BACKEND_BASE_URLS),
      aiUsageOperatorName: "",
      aiCallLogDownloadOperatorName: "",
      publicCenterPlatformOrder: [],
      lastBootstrapReason: null,
      lastBootstrappedAt: null,
    },
  };

  function normalizeReleaseVisibility(value, fallback) {
    return RELEASE_VISIBILITY_PUBLIC;
  }

  function getPlatformDefinition(platformId) {
    const normalizedId = String(platformId || "").trim();
    return normalizedId ? PLATFORM_LIBRARY[normalizedId] || null : null;
  }

  function getScriptDefinition(scriptId) {
    const normalizedId = String(scriptId || "").trim();
    return normalizedId ? SCRIPT_LIBRARY[normalizedId] || null : null;
  }

  function isPlatformVisible(platformId, settings) {
    const platform = getPlatformDefinition(platformId);
    if (!platform) {
      return false;
    }
    return normalizeReleaseVisibility(platform.visibility, RELEASE_VISIBILITY_PUBLIC) === RELEASE_VISIBILITY_PUBLIC;
  }

  function isScriptVisible(scriptId, settings) {
    const script = getScriptDefinition(scriptId);
    if (!script) {
      return false;
    }
    return isPlatformVisible(script.platformId, settings);
  }

  function isScriptRuntimeAccessible(scriptId, settings) {
    const script = getScriptDefinition(scriptId);
    if (!script || !isScriptVisible(scriptId, settings)) {
      return false;
    }

    if (script.id === LIGHTWHEEL_VIEW_PANEL_SCRIPT_ID) {
      return Boolean(
        settings?.platforms?.lightwheel?.enabled &&
          settings?.platforms?.lightwheel?.scripts?.viewPanel?.enabled
      );
    }

    if (script.platformId === ALIBABA_LABELX_PLATFORM_ID) {
      return Boolean(
        settings?.platforms?.alibabaLabelx?.enabled &&
          settings?.platforms?.alibabaLabelx?.scriptCenter?.activeProjectId === scriptId
      );
    }

    if (script.platformId === DATA_BAKER_PLATFORM_ID) {
      return Boolean(
        settings?.platforms?.dataBaker?.enabled !== false &&
          settings?.platforms?.dataBaker?.scripts?.roundOneQuality?.enabled !== false
      );
    }

    if (script.platformId === AISHELL_TECH_PLATFORM_ID) {
      const activeScriptId = String(settings?.platforms?.aishellTech?.activeScriptId || "").trim();
      const scriptKey =
        scriptId === AISHELL_TECH_VIETNAMESE_SCRIPT_ID
          ? "vietnameseHelper"
          : scriptId === AISHELL_TECH_THAI_SCRIPT_ID
            ? "thaiHelper"
            : scriptId === AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID
              ? "cnEnShortDrama"
              : "minnanHelper";
      const scriptSettings = settings?.platforms?.aishellTech?.scripts?.[scriptKey] || {};
      const requiresAiRecommend = scriptId !== AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID;
      return Boolean(
        settings?.platforms?.aishellTech?.enabled !== false &&
          scriptSettings.enabled !== false &&
          (!requiresAiRecommend || scriptSettings.aiRecommendEnabled !== false) &&
          (!activeScriptId || activeScriptId === scriptId)
      );
    }

    if (script.platformId === ABAKA_AI_PLATFORM_ID) {
      return Boolean(
        settings?.platforms?.abakaAi?.enabled !== false &&
          settings?.platforms?.abakaAi?.scripts?.taskPageCapture?.enabled !== false
      );
    }

    if (script.platformId === HAITIAN_UTRANS_PLATFORM_ID) {
      return Boolean(
        settings?.platforms?.haitianUtrans?.enabled !== false &&
          settings?.platforms?.haitianUtrans?.scripts?.audioDownloadHelper?.enabled !== false
      );
    }

    if (script.platformId === MAGIC_DATA_PLATFORM_ID) {
      const activeScriptId = String(settings?.platforms?.magicData?.activeScriptId || "").trim();
      const scriptKey =
        scriptId === MAGIC_DATA_ANNOTATOR_SCRIPT_ID
          ? "hakkaHelper"
          : "minnanHelper";
      const scriptSettings = settings?.platforms?.magicData?.scripts?.[scriptKey] || {};
      return Boolean(
        settings?.platforms?.magicData?.enabled !== false &&
          scriptSettings.enabled !== false &&
          scriptSettings.aiReviewEnabled !== false &&
          (!activeScriptId || activeScriptId === scriptId)
      );
    }

    return false;
  }

  const api = {
    EXTENSION_NAME: EXTENSION_NAME,
    STAGE_ID: STAGE_ID,
    STAGE_LABEL: STAGE_LABEL,
    STAGE_DESCRIPTION:
      "脚本中心统一管理多平台脚本，options 页负责启停与必要配置，运行时功能由各脚本独立维护。",
    CAPABILITY_SCOPE:
      "当前支持多平台脚本中心、LabelX 语音转写轻量工具栏与统计导出、语音判别音频能力、Lightwheel 脚本占位管理、DataBaker 与 Aishell 语言助手 AI 推荐文本。",
    SCHEMA_VERSION: SCHEMA_VERSION,
    RELEASE_CHANNEL_PUBLIC: RELEASE_CHANNEL_PUBLIC,
    RELEASE_CHANNEL: RELEASE_CHANNEL,
    RELEASE_VISIBILITY_PUBLIC: RELEASE_VISIBILITY_PUBLIC,
    DEFAULT_BACKEND_BASE_URLS: clone(DEFAULT_BACKEND_BASE_URLS),
    STORAGE_KEY: "asrEdgeSettings",
    PRESENCE_BADGE_ID: "asr-edge-presence-host",
    TARGET_PLATFORM: TARGET_PLATFORM,
    LIGHTWHEEL_PLATFORM: LIGHTWHEEL_PLATFORM,
    DATA_BAKER_PLATFORM: DATA_BAKER_PLATFORM,
    MAGIC_DATA_PLATFORM: MAGIC_DATA_PLATFORM,
    ABAKA_AI_PLATFORM: ABAKA_AI_PLATFORM,
    AISHELL_TECH_PLATFORM: AISHELL_TECH_PLATFORM,
    PLATFORM_LIBRARY: clone(PLATFORM_LIBRARY),
    MESSAGE_TYPES: MESSAGE_TYPES,
    PAGE_OPTIONS: PAGE_OPTIONS,
    JUDGEMENT_AI_LISTEN_MODELS: clone(JUDGEMENT_AI_LISTEN_MODELS),
    JUDGEMENT_AI_COMPARE_MODELS: clone(JUDGEMENT_AI_COMPARE_MODELS),
    JUDGEMENT_AI_AVAILABLE_MODELS: clone(JUDGEMENT_AI_AVAILABLE_MODELS),
    JUDGEMENT_AI_ADVANCED_PARAM_DEFINITIONS: clone(JUDGEMENT_AI_ADVANCED_PARAM_DEFINITIONS),
    DEFAULT_CUSTOM_REPLACEMENTS: clone(DEFAULT_CUSTOM_REPLACEMENTS),
    DEFAULT_CUSTOM_RATES: clone(DEFAULT_CUSTOM_RATES),
    SHORTCUT_DEFINITIONS: SHORTCUT_DEFINITIONS,
    SHORTCUT_KEYS: SHORTCUT_KEYS,
    SHORTCUT_COMPATIBILITY_MAP: SHORTCUT_COMPATIBILITY_MAP,
    TRANSCRIPTION_PROJECT_ID: TRANSCRIPTION_PROJECT_ID,
    JUDGEMENT_PROJECT_ID: JUDGEMENT_PROJECT_ID,
    LIGHTWHEEL_VIEW_PANEL_SCRIPT_ID: LIGHTWHEEL_VIEW_PANEL_SCRIPT_ID,
    DATA_BAKER_PLATFORM_ID: DATA_BAKER_PLATFORM_ID,
    MAGIC_DATA_PLATFORM_ID: MAGIC_DATA_PLATFORM_ID,
    ABAKA_AI_PLATFORM_ID: ABAKA_AI_PLATFORM_ID,
    HAITIAN_UTRANS_PLATFORM_ID: HAITIAN_UTRANS_PLATFORM_ID,
    AISHELL_TECH_PLATFORM_ID: AISHELL_TECH_PLATFORM_ID,
    DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID: DATA_BAKER_ROUND_ONE_QUALITY_SCRIPT_ID,
    MAGIC_DATA_ANNOTATOR_SCRIPT_ID: MAGIC_DATA_ANNOTATOR_SCRIPT_ID,
    MAGIC_DATA_MINNAN_SCRIPT_ID: MAGIC_DATA_MINNAN_SCRIPT_ID,
    ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID: ABAKA_AI_TASK_PAGE_CAPTURE_SCRIPT_ID,
    HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID:
      HAITIAN_UTRANS_AUDIO_DOWNLOAD_HELPER_SCRIPT_ID,
    AISHELL_TECH_MINNAN_SCRIPT_ID: AISHELL_TECH_MINNAN_SCRIPT_ID,
    AISHELL_TECH_VIETNAMESE_SCRIPT_ID: AISHELL_TECH_VIETNAMESE_SCRIPT_ID,
    AISHELL_TECH_THAI_SCRIPT_ID: AISHELL_TECH_THAI_SCRIPT_ID,
    AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID: AISHELL_TECH_CN_EN_SHORT_DRAMA_SCRIPT_ID,
    DATABAKER_AI_RECOMMEND_SERVER_ENDPOINT: DATABAKER_AI_RECOMMEND_SERVER_ENDPOINT,
    DATABAKER_AI_RECOMMEND_LOCAL_ENDPOINT: DATABAKER_AI_RECOMMEND_LOCAL_ENDPOINT,
    DATABAKER_AI_RECOMMEND_PATH: DATABAKER_AI_RECOMMEND_PATH,
    DATABAKER_EXPORT_UPLOAD_PATH: DATABAKER_EXPORT_UPLOAD_PATH,
    DATABAKER_EXPORT_DOWNLOAD_PATH: DATABAKER_EXPORT_DOWNLOAD_PATH,
    DATABAKER_EXPORT_UPLOAD_SERVER_ENDPOINT: DATABAKER_EXPORT_UPLOAD_SERVER_ENDPOINT,
    DATABAKER_EXPORT_UPLOAD_LOCAL_ENDPOINT: DATABAKER_EXPORT_UPLOAD_LOCAL_ENDPOINT,
    DATABAKER_EXPORT_DOWNLOAD_SERVER_ENDPOINT: DATABAKER_EXPORT_DOWNLOAD_SERVER_ENDPOINT,
    DATABAKER_EXPORT_DOWNLOAD_LOCAL_ENDPOINT: DATABAKER_EXPORT_DOWNLOAD_LOCAL_ENDPOINT,
    JUDGEMENT_STATS_UPLOAD_PATH: JUDGEMENT_STATS_UPLOAD_PATH,
    JUDGEMENT_STATS_DOWNLOAD_PATH: JUDGEMENT_STATS_DOWNLOAD_PATH,
    JUDGEMENT_AI_SUGGEST_PATH: JUDGEMENT_AI_SUGGEST_PATH,
    TRANSCRIPTION_AI_SUGGEST_CURRENT_PATH: TRANSCRIPTION_AI_SUGGEST_CURRENT_PATH,
    AISHELL_TECH_AI_RECOMMEND_PATH: AISHELL_TECH_AI_RECOMMEND_PATH,
    AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_PATH: AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_PATH,
    AISHELL_TECH_THAI_AI_RECOMMEND_PATH: AISHELL_TECH_THAI_AI_RECOMMEND_PATH,
    TRANSCRIPTION_STATS_UPLOAD_PATH: TRANSCRIPTION_STATS_UPLOAD_PATH,
    TRANSCRIPTION_STATS_DOWNLOAD_PATH: TRANSCRIPTION_STATS_DOWNLOAD_PATH,
    PROJECT_DATA_DOWNLOAD_OPTIONS_PATH: PROJECT_DATA_DOWNLOAD_OPTIONS_PATH,
    PROJECT_DATA_DOWNLOAD_REQUEST_PATH: PROJECT_DATA_DOWNLOAD_REQUEST_PATH,
    PROJECT_DATA_DOWNLOAD_FILE_PATH: PROJECT_DATA_DOWNLOAD_FILE_PATH,
    AI_CALL_LOG_DOWNLOAD_OPTIONS_PATH: AI_CALL_LOG_DOWNLOAD_OPTIONS_PATH,
    AI_CALL_LOG_DOWNLOAD_REQUEST_PATH: AI_CALL_LOG_DOWNLOAD_REQUEST_PATH,
    AI_CALL_LOG_DOWNLOAD_FILE_PATH: AI_CALL_LOG_DOWNLOAD_FILE_PATH,
    BACKEND_ENDPOINT_MODE_SERVER: BACKEND_ENDPOINT_MODE_SERVER,
    BACKEND_ENDPOINT_MODE_LOCAL: BACKEND_ENDPOINT_MODE_LOCAL,
    BACKEND_ENDPOINTS: clone(BACKEND_ENDPOINTS),
    JUDGEMENT_STATS_SERVER_ENDPOINT: JUDGEMENT_STATS_SERVER_ENDPOINT,
    JUDGEMENT_STATS_LOCAL_ENDPOINT: JUDGEMENT_STATS_LOCAL_ENDPOINT,
    JUDGEMENT_AI_SUGGEST_SERVER_ENDPOINT: JUDGEMENT_AI_SUGGEST_SERVER_ENDPOINT,
    JUDGEMENT_AI_SUGGEST_LOCAL_ENDPOINT: JUDGEMENT_AI_SUGGEST_LOCAL_ENDPOINT,
    TRANSCRIPTION_AI_SUGGEST_CURRENT_SERVER_ENDPOINT:
      TRANSCRIPTION_AI_SUGGEST_CURRENT_SERVER_ENDPOINT,
    TRANSCRIPTION_AI_SUGGEST_CURRENT_LOCAL_ENDPOINT:
      TRANSCRIPTION_AI_SUGGEST_CURRENT_LOCAL_ENDPOINT,
    AISHELL_TECH_AI_RECOMMEND_SERVER_ENDPOINT: AISHELL_TECH_AI_RECOMMEND_SERVER_ENDPOINT,
    AISHELL_TECH_AI_RECOMMEND_LOCAL_ENDPOINT: AISHELL_TECH_AI_RECOMMEND_LOCAL_ENDPOINT,
    AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_SERVER_ENDPOINT:
      AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_SERVER_ENDPOINT,
    AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_LOCAL_ENDPOINT:
      AISHELL_TECH_VIETNAMESE_AI_RECOMMEND_LOCAL_ENDPOINT,
    AISHELL_TECH_THAI_AI_RECOMMEND_SERVER_ENDPOINT:
      AISHELL_TECH_THAI_AI_RECOMMEND_SERVER_ENDPOINT,
    AISHELL_TECH_THAI_AI_RECOMMEND_LOCAL_ENDPOINT:
      AISHELL_TECH_THAI_AI_RECOMMEND_LOCAL_ENDPOINT,
    normalizeBackendEndpointMode: normalizeBackendEndpointMode,
    normalizeBackendBaseUrl: normalizeBackendBaseUrl,
    normalizeReleaseChannel: normalizeReleaseChannel,
    inferBackendEndpointModeFromEndpoint: inferBackendEndpointModeFromEndpoint,
    getBackendEndpointModeFromSettings: getBackendEndpointModeFromSettings,
    getBackendBaseUrlsFromSettings: getBackendBaseUrlsFromSettings,
    getBackendBaseUrlByMode: getBackendBaseUrlByMode,
    getBackendBaseUrlFromSettings: getBackendBaseUrlFromSettings,
    buildBackendUrl: buildBackendUrl,
    buildDownloadUrl: buildDownloadUrl,
    TRANSCRIPTION_STATS_SERVER_ENDPOINT: TRANSCRIPTION_STATS_SERVER_ENDPOINT,
    TRANSCRIPTION_STATS_LOCAL_ENDPOINT: TRANSCRIPTION_STATS_LOCAL_ENDPOINT,
    DATABAKER_PAGE_SIZE_OPTIONS: clone(DATABAKER_PAGE_SIZE_OPTIONS),
    DATABAKER_AI_PIPELINE_MODE_OPTIONS: clone(DATABAKER_AI_PIPELINE_MODE_OPTIONS),
    MAGIC_DATA_HELPER_MODEL_MODE_OPTIONS: clone(MAGIC_DATA_HELPER_MODEL_MODE_OPTIONS),
    MAGIC_DATA_HELPER_RECOGNITION_STRATEGY_OPTIONS: clone(
      MAGIC_DATA_HELPER_RECOGNITION_STRATEGY_OPTIONS
    ),
    AISHELL_TECH_RECOGNITION_STRATEGY_OPTIONS: clone(
      AISHELL_TECH_RECOGNITION_STRATEGY_OPTIONS
    ),
    DATABAKER_AI_LISTEN_MODEL_OPTIONS: clone(DATABAKER_AI_LISTEN_MODEL_OPTIONS),
    DATABAKER_AI_SINGLE_MODEL_OPTIONS: clone(DATABAKER_AI_SINGLE_MODEL_OPTIONS),
    DATABAKER_AI_OMNI_MODEL_OPTIONS: clone(DATABAKER_AI_OMNI_MODEL_OPTIONS),
    DATABAKER_AI_FUN_ASR_MODEL_OPTIONS: clone(DATABAKER_AI_FUN_ASR_MODEL_OPTIONS),
    DATABAKER_AI_COMPARE_MODEL_OPTIONS: clone(DATABAKER_AI_COMPARE_MODEL_OPTIONS),
    getDataBakerAiQualifiedAutofillConcurrencyRule: getDataBakerAiQualifiedAutofillConcurrencyRule,
    normalizeDataBakerAiQualifiedAutofillConcurrency:
      normalizeDataBakerAiQualifiedAutofillConcurrency,
    DATABAKER_ROUND_ONE_SHORTCUT_ACTIONS: clone(DATABAKER_ROUND_ONE_SHORTCUT_ACTIONS),
    AISHELL_TECH_MINNAN_SHORTCUT_ACTIONS: clone(AISHELL_TECH_MINNAN_SHORTCUT_ACTIONS),
    AISHELL_TECH_VIETNAMESE_SHORTCUT_ACTIONS: clone(AISHELL_TECH_VIETNAMESE_SHORTCUT_ACTIONS),
    AISHELL_TECH_THAI_SHORTCUT_ACTIONS: clone(AISHELL_TECH_THAI_SHORTCUT_ACTIONS),
    AISHELL_TECH_CN_EN_SHORT_DRAMA_SHORTCUT_ACTIONS: clone(
      AISHELL_TECH_CN_EN_SHORT_DRAMA_SHORTCUT_ACTIONS
    ),
    ABAKA_AI_TASK21_SHORTCUT_ACTIONS: clone(ABAKA_AI_TASK21_SHORTCUT_ACTIONS),
    ABAKA_AI_TASK21_AI_ANALYSIS_MODES: clone(ABAKA_AI_TASK21_AI_ANALYSIS_MODES),
    ABAKA_AI_TASK21_VISION_MODEL_OPTIONS: clone(ABAKA_AI_TASK21_VISION_MODEL_OPTIONS),
    ABAKA_AI_TASK21_OCR_MODEL_OPTIONS: clone(ABAKA_AI_TASK21_OCR_MODEL_OPTIONS),
    ABAKA_AI_TASK21_REASONING_MODEL_OPTIONS: clone(ABAKA_AI_TASK21_REASONING_MODEL_OPTIONS),
    ABAKA_AI_TASK21_SINGLE_MODEL_OPTIONS: clone(ABAKA_AI_TASK21_SINGLE_MODEL_OPTIONS),
    ABAKA_AI_TASK21_AI_MODEL_OPTIONS: clone(ABAKA_AI_TASK21_AI_MODEL_OPTIONS),
    SCRIPT_PROJECTS: clone(SCRIPT_PROJECTS),
    SCRIPT_LIBRARY: clone(SCRIPT_LIBRARY),
    isPlatformVisible: isPlatformVisible,
    isScriptVisible: isScriptVisible,
    isScriptRuntimeAccessible: isScriptRuntimeAccessible,
    JUDGEMENT_SHORTCUT_ACTIONS: clone(JUDGEMENT_SHORTCUT_ACTIONS),
    JUDGEMENT_PROJECT_ASR_KEYS: clone(JUDGEMENT_PROJECT_ASR_KEYS),
    BUSINESS_ACTIONS: BUSINESS_ACTIONS,
    BOOLEAN_CONFIG_KEYS: BOOLEAN_CONFIG_KEYS,
    NUMBER_CONFIG_KEYS: NUMBER_CONFIG_KEYS,
    STRING_CONFIG_KEYS: STRING_CONFIG_KEYS,
    ASR_CONFIG_KEYS: ASR_CONFIG_KEYS,
    DEFAULT_AI_REQUEST_TIMEOUT_MS: DEFAULT_AI_REQUEST_TIMEOUT_MS,
    LEGACY_DEFAULT_AI_REQUEST_TIMEOUT_MS: LEGACY_DEFAULT_AI_REQUEST_TIMEOUT_MS,
    DATABAKER_AI_ASYNC_JOBS_ENABLED_DEFAULT: DATABAKER_AI_ASYNC_JOBS_ENABLED_DEFAULT,
    DATABAKER_AI_REQUEST_STAGGER_MS: DATABAKER_AI_REQUEST_STAGGER_MS,
    DEFAULT_ASR_CONFIG: clone(DEFAULT_ASR_CONFIG),
    DEFAULT_JUDGEMENT_ASR_CONFIG: clone(DEFAULT_JUDGEMENT_ASR_CONFIG),
    DEFAULT_CACHE: clone(DEFAULT_CACHE),
    DEFAULT_PLATFORM_SETTINGS: createDefaultPlatformSettings(),
    DEFAULT_LIGHTWHEEL_PLATFORM_SETTINGS: createDefaultLightwheelPlatformSettings(),
    DEFAULT_DATA_BAKER_PLATFORM_SETTINGS: createDefaultDataBakerPlatformSettings(),
    DEFAULT_ABAKA_AI_PLATFORM_SETTINGS: createDefaultAbakaAiPlatformSettings(),
    DEFAULT_HAITIAN_UTRANS_PLATFORM_SETTINGS: createDefaultHaitianUtransPlatformSettings(),
    DEFAULT_AISHELL_TECH_PLATFORM_SETTINGS: createDefaultAishellTechPlatformSettings(),
    DEFAULT_SETTINGS: clone(DEFAULT_SETTINGS),
    LEGACY_ROOT_DEBUG_KEY: LEGACY_ROOT_DEBUG_KEY,
    LEGACY_ROOT_CACHE_KEYS: Object.assign({}, LEGACY_ROOT_CACHE_KEYS),
  };

  globalThis.ASREdgeConstants = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
