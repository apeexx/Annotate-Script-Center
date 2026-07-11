"use strict";

const {
  DEFAULT_AUDIO_FIRST_REFERENCE_CORRECTION_THRESHOLD,
  DEFAULT_COMPARE_MODEL,
  DEFAULT_FUN_ASR_MODEL,
  DEFAULT_OMNI_MODEL,
  DATABAKER_COMPARE_MODEL_OPTIONS,
  DATABAKER_LISTEN_MODEL_OPTIONS,
  DATABAKER_SINGLE_MODEL_OPTIONS,
  DEFAULT_REQUEST_PARAMS,
  derivePipelineMode,
  getQueueGroupsHealth,
  normalizeDataBakerCompareModel,
  normalizeDataBakerListenModel,
  normalizeDataBakerSingleModel,
  normalizeModelMode,
  normalizeRecognitionStrategy,
  parseTimeoutMs,
  resolveDefaultCandidateModel,
  resolveDefaultCompareModel,
  resolveDefaultListenModel,
  resolveDefaultSingleModel,
} = require("./config");
const {
  listModelsByFamily,
} = require("../../../backend/ai/model-dispatcher");
const { buildAsyncJobRuntimeMeta } = require("../../../backend/ai-framework/runtime/ai-runtime-meta");
const {
  getLexiconState,
  LEXICON_JSON_PATH,
  LEXICON_REFERENCE_CSV_PATH,
} = require("./lexicon");

const SERVICE_NAME = "aishell-tech-minnan-helper-ai-recommend";
const SCRIPT_ID = "aishellTechMinnanAssistant";
const COMPONENT_NAME = "asr-voice-ai";
const DEFAULT_MODEL_MODE = "two_stage";
const DEFAULT_RECOGNITION_STRATEGY = "audio_first_reference";
const DEFAULT_COMPARE_FAMILY = "qwen";
const COMPARE_FAMILY_OPTIONS = [
  { value: "qwen", label: "Qwen 文本比较" },
  { value: "omni", label: "Omni 听音比较" },
];
const DEFAULT_AUDIO_FIRST_REFERENCE_LISTEN_TEMPLATE = [
  "你正在处理闽南语音频。",
  "你只负责按实际发音输出 heardText，不负责给出最终推荐文本。",
  "不要为了统一风格把整句强行改成普通话或闽南语。",
  "如果音频里某个词读的是普通话，就直接保留普通话简体写法；如果读的是闽南语词或闽南语语气词，就按实际闽南语写法输出。",
  "一句话里允许同时出现普通话词和闽南语词。",
  "如果某个词没有读出来，就不要补写。",
  "听不清时可结合上下文给出最可信写法，并通过 needHumanReview 标记不确定性。",
  "heardText 必须使用简体中文，不允许输出繁体字。",
  "输出 JSON 字段必须包含 heardText、confidence、needHumanReview。",
  "只输出 JSON，不要输出 Markdown 或解释文字。",
].join("\n");
const DEFAULT_AUDIO_FIRST_REFERENCE_CANDIDATE_TEMPLATE = [
  "你正在执行“转换”阶段的歧义兜底。",
  "规则替换已经先完成；只有 ambiguousSegments 标出的冲突片段允许你做选择。",
  "你会收到 pageText、ruleConvertedText 和 ambiguousSegments。只能在冲突片段内做选择，其余非冲突片段必须与 ruleConvertedText 完全一致。",
  "selectedText 必须从每个冲突片段的 candidateOptions 中选择；如果没有足够把握，就保留 currentText，不要自行创造词表外写法。",
  "普通中文必须输出简体，不允许出现任何繁体字。",
  "不要输出多个备选，不要解释原因，也不要做整句风格统一。",
  "输出 JSON 字段必须包含 resolvedSegments、convertedText、confidence、needHumanReview。",
  "resolvedSegments 中每项至少包含 segmentIndex 和 selectedText。",
  "只输出 JSON，不要输出 Markdown 或解释文字。",
].join("\n");
const DEFAULT_AUDIO_FIRST_REFERENCE_COMPARE_TEMPLATE = [
  "你正在执行“比较”阶段。",
  "你会收到三份上下文：pageText（平台原始文本）、convertedText（转换阶段产出的文本）、heardText（按实际发音转写出的文本）。",
  "你的任务是输出最终 recommendedText，但必须以实际发音为准；不要机械照抄 pageText，也不要把整句强行统一成闽南语。",
  "先看 heardText，再看 convertedText，最后只把 pageText 当作语义兜底参考。",
  "convertPairs 列出 pageText 与转换文本的改写项；differenceSegments 只列出 heardText 与 convertedText 的差异项，请逐项判断这些差异要保留哪一侧。",
  "允许只采纳其中一部分差异项：例如前一个差异改用转换文本、后一个差异继续保留 heardText。",
  "如果某个词在音频里读的是普通话，就保留普通话简体；如果读的是闽南语，就输出对应闽南语写法；如果没有读出来，就不要补回。",
  "一句话里允许同时保留普通话词和闽南语词。",
  "当 convertedText 与 heardText 发音接近、语义一致，且你对标准写法有把握时，可以采用转换文本中的写法。",
  "audioFirstReferenceCorrectionThreshold 是采纳阈值；当 correctionConfidence 低于该阈值时，应优先保留 heardText，并将 needHumanReview 设为 true。",
  "当低于阈值但存在明显冲突时，candidateDecisions 里要明确说明原因；不要为了命中词表而强行转换。",
  "recommendedText 与 heardText 的普通中文统一输出简体；命中闽南业务词表 JSON 的建议用字只在确认音频确实这样读，或确认候选标准化更合理时才保留。",
  "输出 JSON 字段：recommendedText、decision、changePoints、confidence、needHumanReview、correctionConfidence、candidateDecisions。",
  "只输出 JSON，不输出额外解释。",
].join("\n");
const DEFAULT_AUDIO_FIRST_REFERENCE_OMNI_COMPARE_TEMPLATE = [
  "你正在执行 Omni 比较阶段。",
  "你会收到 pageText、heardText、convertedText，以及当前音频。",
  "你的任务是结合实际发音、heardText 和 convertedText 给出最终 recommendedText。",
  "如果某个词在音频里读的是普通话，就保留普通话简体；如果读的是闽南语，就输出对应闽南语写法；如果没有读出来，就不要补回。",
  "当 convertedText 与 heardText 发音接近、语义一致，且你对标准写法有把握时，可以采用转换文本中的写法。",
  "audioFirstReferenceCorrectionThreshold 是采纳阈值；当 correctionConfidence 低于该阈值时，应优先保留 heardText，并将 needHumanReview 设为 true。",
  "输出 JSON 字段：recommendedText、decision、changePoints、confidence、needHumanReview、correctionConfidence、candidateDecisions。",
  "只输出 JSON，不输出额外解释。",
].join("\n");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizePromptText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
}

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function createHttpError(statusCode, message, code) {
  const error = new Error(String(message || "请求失败。"));
  error.statusCode = Number(statusCode) || 500;
  error.code = String(code || "request-error");
  return error;
}

function normalizeStopSequences(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];
  const result = [];
  source.forEach(function (item) {
    const text = String(item || "").trim().slice(0, 80);
    if (!text || result.indexOf(text) >= 0 || result.length >= 8) {
      return;
    }
    result.push(text);
  });
  return result;
}

function normalizeNumberInRange(value, min, max) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }
  return number;
}

function normalizeIntegerInRange(value, min, max) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }
  return number;
}

function normalizeModelText(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, 80);
}

function normalizeCompareFamily(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "omni") {
    return "omni";
  }
  if (text === "qwen") {
    return "qwen";
  }
  return String(fallback || DEFAULT_COMPARE_FAMILY).trim().toLowerCase() === "omni"
    ? "omni"
    : "qwen";
}

function isFunAsrListenModel(value) {
  return normalizeDataBakerListenModel(value, DEFAULT_OMNI_MODEL) === DEFAULT_FUN_ASR_MODEL;
}

function deriveParallelPipelineMode(listenModel, compareFamily) {
  const family = normalizeCompareFamily(compareFamily, DEFAULT_COMPARE_FAMILY);
  if (family === "omni") {
    return isFunAsrListenModel(listenModel) ? "fun_asr_omni_compare" : "omni_omni_compare";
  }
  return isFunAsrListenModel(listenModel) ? "fun_asr_text_compare" : "omni_text_compare";
}

function normalizeStageParams(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  const temperature = normalizeNumberInRange(source.temperature, 0, 2);
  if (temperature !== null) {
    result.temperature = temperature;
  }
  const topP = normalizeNumberInRange(source.top_p, 0, 1);
  if (topP !== null) {
    result.top_p = topP;
  }
  const maxTokens = normalizeIntegerInRange(source.max_tokens, 1, 8192);
  if (maxTokens !== null) {
    result.max_tokens = maxTokens;
  }
  const maxCompletionTokens = normalizeIntegerInRange(source.max_completion_tokens, 1, 8192);
  if (maxCompletionTokens !== null) {
    result.max_completion_tokens = maxCompletionTokens;
  }
  const presencePenalty = normalizeNumberInRange(source.presence_penalty, -2, 2);
  if (presencePenalty !== null) {
    result.presence_penalty = presencePenalty;
  }
  const frequencyPenalty = normalizeNumberInRange(source.frequency_penalty, -2, 2);
  if (frequencyPenalty !== null) {
    result.frequency_penalty = frequencyPenalty;
  }
  const seed = normalizeIntegerInRange(source.seed, 0, 2147483647);
  if (seed !== null) {
    result.seed = seed;
  }
  const stop = normalizeStopSequences(source.stop || source.stopSequences);
  if (stop.length > 0) {
    result.stop = stop;
  }
  return result;
}

function getStrategyPromptDefaults(recognitionStrategy) {
  const normalizedStrategy = normalizeRecognitionStrategy(
    recognitionStrategy,
    DEFAULT_RECOGNITION_STRATEGY
  );
  if (normalizedStrategy === "audio_first_reference") {
    return {
      convertPrompt: DEFAULT_AUDIO_FIRST_REFERENCE_CANDIDATE_TEMPLATE,
      compareQwenPrompt: DEFAULT_AUDIO_FIRST_REFERENCE_COMPARE_TEMPLATE,
      compareOmniPrompt: DEFAULT_AUDIO_FIRST_REFERENCE_OMNI_COMPARE_TEMPLATE,
      candidatePrompt: DEFAULT_AUDIO_FIRST_REFERENCE_CANDIDATE_TEMPLATE,
      listenPrompt: DEFAULT_AUDIO_FIRST_REFERENCE_LISTEN_TEMPLATE,
      comparePrompt: DEFAULT_AUDIO_FIRST_REFERENCE_COMPARE_TEMPLATE,
    };
  }
  return {
    convertPrompt: DEFAULT_AUDIO_FIRST_REFERENCE_CANDIDATE_TEMPLATE,
    candidatePrompt: DEFAULT_AUDIO_FIRST_REFERENCE_CANDIDATE_TEMPLATE,
    listenPrompt: DEFAULT_AUDIO_FIRST_REFERENCE_LISTEN_TEMPLATE,
    compareQwenPrompt: DEFAULT_AUDIO_FIRST_REFERENCE_COMPARE_TEMPLATE,
    compareOmniPrompt: DEFAULT_AUDIO_FIRST_REFERENCE_OMNI_COMPARE_TEMPLATE,
    comparePrompt: DEFAULT_AUDIO_FIRST_REFERENCE_COMPARE_TEMPLATE,
  };
}

function buildStageDefaults() {
  const prompts = getStrategyPromptDefaults(DEFAULT_RECOGNITION_STRATEGY);
  const convertModel = resolveDefaultCandidateModel();
  const listenModel = resolveDefaultListenModel(DEFAULT_MODEL_MODE);
  const qwenCompareModel = resolveDefaultCompareModel();
  const omniCompareModel = resolveDefaultSingleModel();
  return {
    convert: {
      model: convertModel,
      prompt: prompts.convertPrompt,
      modelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
    },
    listen: {
      model: listenModel,
      prompt: prompts.listenPrompt,
      modelOptions: DATABAKER_LISTEN_MODEL_OPTIONS.slice(),
    },
    compare: {
      family: DEFAULT_COMPARE_FAMILY,
      model: qwenCompareModel,
      prompt: prompts.compareQwenPrompt,
      familyOptions: COMPARE_FAMILY_OPTIONS.slice(),
      qwenModel: qwenCompareModel,
      omniModel: omniCompareModel,
      qwenModelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
      omniModelOptions: DATABAKER_SINGLE_MODEL_OPTIONS.slice(),
      qwenPrompt: prompts.compareQwenPrompt,
      omniPrompt: prompts.compareOmniPrompt,
      adoptionThreshold: DEFAULT_AUDIO_FIRST_REFERENCE_CORRECTION_THRESHOLD,
    },
  };
}

function normalizeAiOptions(value) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  const stringFields = [
    "candidatePrompt",
    "listenPrompt",
    "comparePrompt",
    "candidateModel",
    "listenModel",
    "compareModel",
    "singleModel",
    "omniModel",
    "mockResponseMode",
  ];

  stringFields.forEach(function (key) {
    const normalized =
      key.indexOf("Prompt") >= 0 ? normalizePromptText(source[key]) : normalizeModelText(source[key]);
    if (normalized) {
      result[key] = normalized;
    }
  });

  const temperature = normalizeNumberInRange(source.temperature, 0, 2);
  if (temperature !== null) {
    result.temperature = temperature;
  }
  const topP = normalizeNumberInRange(source.top_p, 0, 1);
  if (topP !== null) {
    result.top_p = topP;
  }
  const maxTokens = normalizeIntegerInRange(source.max_tokens, 1, 8192);
  if (maxTokens !== null) {
    result.max_tokens = maxTokens;
  }
  const maxCompletionTokens = normalizeIntegerInRange(source.max_completion_tokens, 1, 8192);
  if (maxCompletionTokens !== null) {
    result.max_completion_tokens = maxCompletionTokens;
  }
  const presencePenalty = normalizeNumberInRange(source.presence_penalty, -2, 2);
  if (presencePenalty !== null) {
    result.presence_penalty = presencePenalty;
  }
  const frequencyPenalty = normalizeNumberInRange(source.frequency_penalty, -2, 2);
  if (frequencyPenalty !== null) {
    result.frequency_penalty = frequencyPenalty;
  }
  const seed = normalizeIntegerInRange(source.seed, 0, 2147483647);
  if (seed !== null) {
    result.seed = seed;
  }
  const stop = normalizeStopSequences(source.stop);
  if (stop.length > 0) {
    result.stop = stop;
  }
  result.enable_thinking = false;
  if (Number.isFinite(Number(source.frontConcurrency))) {
    result.frontConcurrency = Math.round(Number(source.frontConcurrency));
  }
  if (Number.isFinite(Number(source.batchConcurrency))) {
    result.batchConcurrency = Math.round(Number(source.batchConcurrency));
  }
  if (normalizeModelText(source.concurrencyModelType)) {
    result.concurrencyModelType = normalizeModelText(source.concurrencyModelType);
  }
  const audioFirstReferenceCorrectionThreshold = normalizeNumberInRange(
    source.audioFirstReferenceCorrectionThreshold,
    0,
    1
  );
  result.audioFirstReferenceCorrectionThreshold =
    audioFirstReferenceCorrectionThreshold === null
      ? DEFAULT_AUDIO_FIRST_REFERENCE_CORRECTION_THRESHOLD
      : Number(audioFirstReferenceCorrectionThreshold.toFixed(3));
  return result;
}

function applyStrategyPromptDefaults(aiOptions, recognitionStrategy) {
  const next = Object.assign({}, aiOptions || {});
  const defaults = getStrategyPromptDefaults(recognitionStrategy);
  if (!normalizePromptText(next.candidatePrompt)) {
    next.candidatePrompt = defaults.candidatePrompt;
  }
  if (!normalizePromptText(next.listenPrompt)) {
    next.listenPrompt = defaults.listenPrompt;
  }
  if (!normalizePromptText(next.comparePrompt)) {
    next.comparePrompt = defaults.comparePrompt;
  }
  return next;
}

function buildLexiconState() {
  const state = getLexiconState();
  return {
    enabled: Number(state?.rowCount || 0) > 0 && normalizeText(state?.status) === "ready",
    status: normalizeText(state?.status) || "missing",
    source: "json",
    sourceFile: "minnan-lexicon.json",
    referenceSourceFile: "minnan-lexicon.csv",
    sourcePath: normalizeText(state?.filePath) || LEXICON_JSON_PATH,
    referenceSourcePath: LEXICON_REFERENCE_CSV_PATH,
    rowCount: Number(state?.rowCount || 0) || 0,
    message: normalizeText(state?.warningMessage || state?.errorMessage).slice(0, 160),
    warningMessage: normalizeText(state?.warningMessage).slice(0, 160),
  };
}

function buildRecommendLexiconMeta(metaLexicon, dataLexicon) {
  const metaSource = metaLexicon && typeof metaLexicon === "object" ? metaLexicon : {};
  const dataSource = dataLexicon && typeof dataLexicon === "object" ? dataLexicon : {};
  const fallback = buildLexiconState();
  return {
    status: normalizeText(metaSource.status || fallback.status) || "missing",
    source: normalizeText(metaSource.source || fallback.source) || "json",
    sourceFile: normalizeText(metaSource.sourceFile || fallback.sourceFile),
    referenceSourceFile: normalizeText(
      metaSource.referenceSourceFile || fallback.referenceSourceFile
    ),
    rowCount: Number(metaSource.rowCount || fallback.rowCount || 0) || 0,
    warningMessage: normalizeText(metaSource.warningMessage || fallback.warningMessage).slice(0, 160),
    rewriteMode: normalizeText(metaSource.rewriteMode || dataSource.rewriteMode || "off") || "off",
  };
}

function normalizeRecommendRequest(body) {
  const source = body && typeof body === "object" ? body : {};
  const taskId = normalizeText(source.taskId);
  const packageId = normalizeText(source.packageId);
  const taskItemId = normalizeText(source.taskItemId);
  const fileName = normalizeText(source.fileName);
  const audioUrl = normalizeText(source.audioUrl);
  const referenceText = normalizeText(source.referenceText);
  const existingMarkText = normalizeText(source.existingMarkText);
  const duration = normalizeNullableNumber(source.duration);

  if (!taskId) {
    throw createHttpError(400, "taskId 不能为空。", "invalid-task-id");
  }
  if (!packageId) {
    throw createHttpError(400, "packageId 不能为空。", "invalid-package-id");
  }
  if (!taskItemId) {
    throw createHttpError(400, "taskItemId 不能为空。", "invalid-task-item-id");
  }
  if (!isHttpUrl(audioUrl)) {
    throw createHttpError(400, "audioUrl 必须是 http/https。", "invalid-audio-url");
  }
  if (!referenceText) {
    throw createHttpError(400, "referenceText 不能为空。", "invalid-reference-text");
  }

  const legacyModelMode = normalizeModelMode(
    source.modelMode || source.aiRecommendModelMode || source.recognitionMode || source.pipelineMode,
    DEFAULT_MODEL_MODE
  );
  const recognitionStrategy = normalizeRecognitionStrategy(
    source.recognitionStrategy || source.aiRecommendRecognitionStrategy || source.pipelineMode,
    DEFAULT_RECOGNITION_STRATEGY
  );
  const legacyAiOptions = applyStrategyPromptDefaults(
    normalizeAiOptions(source.aiOptions),
    recognitionStrategy
  );
  const sharedLegacyParams = normalizeStageParams(legacyAiOptions);
  const stageDefaults = buildStageDefaults();
  const legacyConvertModel = normalizeDataBakerCompareModel(
    source.candidateModel || legacyAiOptions.candidateModel || stageDefaults.convert.model,
    stageDefaults.convert.model
  );
  const legacyListenModel = normalizeDataBakerListenModel(
    source.listenModel || legacyAiOptions.listenModel || resolveDefaultListenModel(legacyModelMode),
    stageDefaults.listen.model
  );
  const legacyCompareFamily = normalizeCompareFamily(
    source.compareFamily || source.aiRecommendCompareFamily,
    normalizeModelMode(legacyModelMode, DEFAULT_MODEL_MODE) === "omni_single" ||
      !isFunAsrListenModel(legacyListenModel)
      ? "omni"
      : "qwen"
  );
  const legacyCompareModel =
    legacyCompareFamily === "omni"
      ? normalizeDataBakerSingleModel(
          source.singleModel ||
            legacyAiOptions.singleModel ||
            legacyAiOptions.omniModel ||
            legacyListenModel ||
            stageDefaults.compare.omniModel,
          stageDefaults.compare.omniModel
        )
      : normalizeDataBakerCompareModel(
          source.compareModel || legacyAiOptions.compareModel || stageDefaults.compare.qwenModel,
          stageDefaults.compare.qwenModel
        );
  const stageSource = source.aiStages && typeof source.aiStages === "object" ? source.aiStages : {};
  const rawConvertStage = stageSource.convert && typeof stageSource.convert === "object"
    ? stageSource.convert
    : {};
  const rawListenStage = stageSource.listen && typeof stageSource.listen === "object"
    ? stageSource.listen
    : {};
  const rawCompareStage = stageSource.compare && typeof stageSource.compare === "object"
    ? stageSource.compare
    : {};
  const compareFamily = normalizeCompareFamily(
    rawCompareStage.family || rawCompareStage.compareFamily || source.compareFamily,
    legacyCompareFamily
  );
  const convertStage = {
    model: normalizeDataBakerCompareModel(
      rawConvertStage.model || rawConvertStage.convertModel || source.convertModel || legacyConvertModel,
      stageDefaults.convert.model
    ),
    prompt:
      normalizePromptText(
        rawConvertStage.prompt || rawConvertStage.convertPrompt || legacyAiOptions.candidatePrompt
      ) || stageDefaults.convert.prompt,
    params:
      Object.keys(rawConvertStage.params || {}).length > 0
        ? normalizeStageParams(rawConvertStage.params)
        : sharedLegacyParams,
  };
  const listenStage = {
    model: normalizeDataBakerListenModel(
      rawListenStage.model || rawListenStage.listenModel || source.listenModel || legacyListenModel,
      stageDefaults.listen.model
    ),
    prompt:
      normalizePromptText(
        rawListenStage.prompt || rawListenStage.listenPrompt || legacyAiOptions.listenPrompt
      ) || stageDefaults.listen.prompt,
    params:
      Object.keys(rawListenStage.params || {}).length > 0
        ? normalizeStageParams(rawListenStage.params)
        : sharedLegacyParams,
  };
  const compareStage = {
    family: compareFamily,
    model:
      compareFamily === "omni"
        ? normalizeDataBakerSingleModel(
            rawCompareStage.model ||
              rawCompareStage.omniModel ||
              source.compareModel ||
              source.singleModel ||
              legacyCompareModel,
            stageDefaults.compare.omniModel
          )
        : normalizeDataBakerCompareModel(
            rawCompareStage.model ||
              rawCompareStage.qwenModel ||
              source.compareModel ||
              legacyCompareModel,
            stageDefaults.compare.qwenModel
          ),
    prompt:
      normalizePromptText(
        rawCompareStage.prompt ||
          (compareFamily === "omni" ? rawCompareStage.omniPrompt : rawCompareStage.qwenPrompt) ||
          legacyAiOptions.comparePrompt
      ) ||
      (compareFamily === "omni"
        ? stageDefaults.compare.omniPrompt
        : stageDefaults.compare.qwenPrompt),
    params:
      Object.keys(rawCompareStage.params || {}).length > 0
        ? normalizeStageParams(rawCompareStage.params)
        : sharedLegacyParams,
    adoptionThreshold:
      normalizeNumberInRange(
        rawCompareStage.adoptionThreshold ??
          rawCompareStage.audioFirstReferenceCorrectionThreshold ??
          legacyAiOptions.audioFirstReferenceCorrectionThreshold,
        0,
        1
      ) ?? stageDefaults.compare.adoptionThreshold,
  };
  const modelMode = "three_stage_parallel";
  const pipelineMode = deriveParallelPipelineMode(
    listenStage.model,
    compareFamily
  );

  return {
    taskId,
    packageId,
    taskItemId,
    fileName,
    audioUrl,
    referenceText,
    existingMarkText,
    duration,
    itemNumber: normalizeNullableNumber(source.itemNumber ?? source.number),
    annotatorName: normalizeText(source.annotatorName || source.platformUserName),
    aiUsageOperatorName: normalizeText(source.aiUsageOperatorName).slice(0, 40),
    platformUserName: normalizeText(source.platformUserName).slice(0, 80),
    platformUserId: normalizeText(source.platformUserId).slice(0, 120),
    clientVersion: normalizeText(source.clientVersion),
    batchRunId: normalizeText(source.batchRunId),
    batchItemIndex: normalizeNullableNumber(source.batchItemIndex),
    batchProcessKey: normalizeText(source.batchProcessKey),
    clientRequestId: normalizeText(source.clientRequestId),
    frontConcurrency:
      source.frontConcurrency !== undefined && source.frontConcurrency !== null
        ? Math.round(Number(source.frontConcurrency))
        : source.batchConcurrency !== undefined && source.batchConcurrency !== null
          ? Math.round(Number(source.batchConcurrency))
          : source.aiOptions?.frontConcurrency !== undefined && source.aiOptions?.frontConcurrency !== null
            ? Math.round(Number(source.aiOptions.frontConcurrency))
            : null,
    concurrencyModelType: normalizeText(
      source.concurrencyModelType || source.aiOptions?.concurrencyModelType || "omni"
    ),
    modelMode,
    recognitionStrategy,
    recognitionMode: modelMode,
    pipelineMode,
    aiStages: {
      convert: convertStage,
      listen: listenStage,
      compare: compareStage,
    },
    convertModel: convertStage.model,
    compareFamily,
    candidateModel: convertStage.model,
    listenModel: listenStage.model,
    compareModel: compareStage.model,
    singleModel: compareFamily === "omni" ? compareStage.model : "",
    enableThinking: false,
    aiOptions: {
      candidatePrompt: convertStage.prompt,
      listenPrompt: listenStage.prompt,
      comparePrompt: compareStage.prompt,
      audioFirstReferenceCorrectionThreshold: compareStage.adoptionThreshold,
      enable_thinking: false,
    },
  };
}

function buildMeta(meta, requestId) {
  const source = meta && typeof meta === "object" ? meta : {};
  const lexicon = buildRecommendLexiconMeta(source.lexicon, null);
  return {
    requestId: normalizeText(source.requestId || requestId),
    stage: normalizeText(source.stage || "complete"),
    models: source.models && typeof source.models === "object" ? source.models : {},
    execution: source.execution && typeof source.execution === "object" ? source.execution : {},
    timing: source.timing && typeof source.timing === "object" ? source.timing : {},
    usage: source.usage && typeof source.usage === "object" ? source.usage : {},
    cost: source.cost && typeof source.cost === "object" ? source.cost : {},
    queue: source.queue && typeof source.queue === "object" ? source.queue : {},
    cache: source.cache && typeof source.cache === "object" ? source.cache : {},
    debugId: normalizeText(source.debugId),
    retryCount: Number(source.retryCount || 0) || 0,
    cancelled: source.cancelled === true,
    debug: source.debug && typeof source.debug === "object" ? source.debug : {},
    lexicon: lexicon,
    audioFirstReference:
      source.audioFirstReference && typeof source.audioFirstReference === "object"
        ? source.audioFirstReference
        : null,
  };
}

function buildRecommendSuccessBody(input) {
  const source = input && typeof input === "object" ? input : {};
  const metaSource = source.meta && typeof source.meta === "object" ? source.meta : {};
  const dataSource = source.data && typeof source.data === "object" ? source.data : {};
  const nextMeta = Object.assign({}, metaSource, {
    lexicon: buildRecommendLexiconMeta(metaSource.lexicon, dataSource.lexicon),
  });
  return {
    success: true,
    data: dataSource,
    meta: buildMeta(nextMeta, source.requestId),
  };
}

function buildRecommendErrorBody(input) {
  const source = input && typeof input === "object" ? input : {};
  const error = source.error && typeof source.error === "object" ? source.error : {};
  return {
    success: false,
    error: {
      code: normalizeText(error.code) || "request-error",
      message: normalizeText(error.safeMessage || error.message || "Aishell 闽南语助手请求失败。").slice(0, 240),
      stage: normalizeText(error.stage) || "post_process",
      retryable: error.retryable === true,
      providerStatus: Number(error.providerStatus || error.statusCode || 0) || 0,
      providerCode: normalizeText(error.providerCode),
    },
    meta: buildMeta(error.meta, source.requestId || error.requestId),
  };
}

function createHealthPayload() {
  const queueGroups = getQueueGroupsHealth();
  const stageDefaults = buildStageDefaults();
  const runtime = buildAsyncJobRuntimeMeta();
  const modelCatalog = {
    text: listModelsByFamily("text"),
    omni: listModelsByFamily("omni"),
    asr: listModelsByFamily("asr"),
  };
  return {
    success: true,
    service: SERVICE_NAME,
    scriptId: SCRIPT_ID,
    component: COMPONENT_NAME,
    status: "ready",
    timeoutMs: parseTimeoutMs(),
    enableThinking: false,
    stages: stageDefaults,
    listenModelOptions: DATABAKER_LISTEN_MODEL_OPTIONS.slice(),
    compareModelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
    candidateModelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
    singleModelOptions: DATABAKER_SINGLE_MODEL_OPTIONS.slice(),
    convertModel: stageDefaults.convert.model,
    listenModel: stageDefaults.listen.model,
    compareFamily: stageDefaults.compare.family,
    compareModel: stageDefaults.compare.qwenModel,
    compareAdoptionThreshold: stageDefaults.compare.adoptionThreshold,
    modelCatalog,
    queue: {
      groups: queueGroups,
      modelPoolPolicy: runtime.queue.defaultModelPool,
    },
    jobs: runtime.jobs,
    runtime,
    lexicon: buildLexiconState(),
    notes: {
      backendMode: "independent-aishell-pipeline",
      timeout: "Aishell 独立超时墙当前统一为 60s，前端默认通过短请求建 job + 轮询接收结果。",
      cancellation: "客户端断开、服务端超时和手动取消会统一透传 AbortSignal。",
      defaultListenPromptPreview: stageDefaults.listen.prompt,
    },
  };
}

function createDefaultsPayload() {
  const stageDefaults = buildStageDefaults();
  const runtime = buildAsyncJobRuntimeMeta();
  const modelCatalog = {
    text: listModelsByFamily("text"),
    omni: listModelsByFamily("omni"),
    asr: listModelsByFamily("asr"),
  };
  return {
    success: true,
    service: SERVICE_NAME,
    scriptId: SCRIPT_ID,
    component: COMPONENT_NAME,
    defaults: Object.assign({}, DEFAULT_REQUEST_PARAMS, {
      timeoutMs: parseTimeoutMs(),
      recognitionStrategy: DEFAULT_RECOGNITION_STRATEGY,
      modelMode: "three_stage_parallel",
      recognitionMode: "three_stage_parallel",
      enableThinking: false,
      pipelineMode: deriveParallelPipelineMode(
        stageDefaults.listen.model,
        stageDefaults.compare.family
      ),
      stages: stageDefaults,
      listenModelOptions: DATABAKER_LISTEN_MODEL_OPTIONS.slice(),
      compareModelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
      candidateModelOptions: DATABAKER_COMPARE_MODEL_OPTIONS.slice(),
      singleModelOptions: DATABAKER_SINGLE_MODEL_OPTIONS.slice(),
      convertModel: stageDefaults.convert.model,
      candidateModel: stageDefaults.convert.model,
      listenModel: stageDefaults.listen.model,
      compareFamily: stageDefaults.compare.family,
      compareModel: stageDefaults.compare.qwenModel,
      singleModel: stageDefaults.compare.omniModel,
      compareAdoptionThreshold: stageDefaults.compare.adoptionThreshold,
      candidatePrompt: stageDefaults.convert.prompt,
      listenPrompt: stageDefaults.listen.prompt,
      comparePrompt: stageDefaults.compare.qwenPrompt,
      modelCatalog,
    }),
    jobs: runtime.jobs,
    runtime,
    notes: {
      defaultsSource: "Aishell independent backend defaults",
      requestMode: "async-job-default",
      compatibilityMode: "sync-recommend-kept-for-debug",
      responseFormat: "success + data + meta / success=false + error + meta",
    },
  };
}

module.exports = {
  COMPONENT_NAME,
  LEXICON_JSON_PATH,
  LEXICON_REFERENCE_CSV_PATH,
  SCRIPT_ID,
  SERVICE_NAME,
  buildRecommendErrorBody,
  buildRecommendSuccessBody,
  createDefaultsPayload,
  createHealthPayload,
  getStrategyPromptDefaults,
  normalizeRecommendRequest,
};
