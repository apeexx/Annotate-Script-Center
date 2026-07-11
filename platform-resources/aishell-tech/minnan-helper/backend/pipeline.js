"use strict";

const {
  requestCompare,
} = require("../../../backend/ai/providers/qwen-openai-compatible");
const {
  estimateProjectCost,
} = require("../../../backend/ai/model-pricing");
const {
  requestOmniInputAudio,
} = require("./dashscope-omni-client");
const {
  requestFunAsrRecognition,
} = require("../../../backend/ai/providers/funasr");
const {
  applyLexiconRewrite,
  buildLexiconContext,
  normalizeCompareResponse,
  normalizeOmniSingleResponse,
  normalizeToSimplifiedChinesePreservingLexicon,
  normalizeUsage,
  parseModelJsonText,
  removeTextSpaces,
} = require("../../../data-baker/round-one-quality/backend/ai-service");
const { buildRecommendCacheKey } = require("./cache");
const {
  DEFAULT_AUDIO_FIRST_REFERENCE_CORRECTION_THRESHOLD,
  DEFAULT_FUN_ASR_MODEL,
  DEFAULT_OMNI_MODEL,
  derivePipelineMode,
  normalizeRecognitionStrategy,
} = require("./config");
const { createStageError } = require("./errors");
const { enqueueTask } = require("./queue");
const {
  buildRuleFirstConvertPlan,
  composeResolvedConvertText,
} = require("./lexicon");

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeCompareFamily(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "omni") {
    return "omni";
  }
  if (text === "qwen") {
    return "qwen";
  }
  return String(fallback || "qwen").trim().toLowerCase() === "omni" ? "omni" : "qwen";
}

function isFunAsrListenModel(value) {
  return normalizeText(value).toLowerCase() === DEFAULT_FUN_ASR_MODEL;
}

function deriveParallelPipelineMode(listenModel, compareFamily) {
  return normalizeCompareFamily(compareFamily, "qwen") === "omni"
    ? isFunAsrListenModel(listenModel)
      ? "fun_asr_omni_compare"
      : "omni_omni_compare"
    : isFunAsrListenModel(listenModel)
      ? "fun_asr_text_compare"
      : "omni_text_compare";
}

function now() {
  return Date.now();
}

function createPromptObject(systemPrompt, userPrompt) {
  return {
    systemPrompt: String(systemPrompt || "").trim(),
    userPrompt: String(userPrompt || "").trim(),
  };
}

function escapeCsvCell(value) {
  return '"' + String(value === undefined || value === null ? "" : value).replace(/"/g, '""') + '"';
}

function buildLexiconStructuredEntries(lexiconContext) {
  const items = Array.isArray(lexiconContext?.items) ? lexiconContext.items : [];
  return items.slice(0, 60).map(function (item) {
    return {
      id: normalizeText(item?.id),
      suggested: normalizeText(item?.suggested),
      mandarin: normalizeText(item?.mandarin),
      source: normalizeText(item?.source) || "csv",
    };
  });
}

function buildLexiconCsvAttachmentText(lexiconContext) {
  const entries = buildLexiconStructuredEntries(lexiconContext);
  if (entries.length === 0) {
    return "";
  }
  const lines = ['"编号","建议用字","对应华语","来源"'];
  entries.forEach(function (entry) {
    lines.push(
      [
        escapeCsvCell(entry.id),
        escapeCsvCell(entry.suggested),
        escapeCsvCell(entry.mandarin),
        escapeCsvCell(entry.source),
      ].join(",")
    );
  });
  return lines.join("\n");
}

function buildConvertPromptAmbiguousSegments(convertPlan) {
  return Array.isArray(convertPlan?.ambiguousSegments)
    ? convertPlan.ambiguousSegments.map(function (segment) {
        return {
          segmentIndex: Number(segment?.segmentIndex || 0) || 0,
          sourceText: normalizeText(segment?.sourceText),
          currentText: normalizeText(segment?.currentText || segment?.sourceText),
          candidateOptions: Array.isArray(segment?.candidateOptions)
            ? segment.candidateOptions.map(normalizeText).filter(Boolean)
            : [],
          matchedMandarinVariants: Array.isArray(segment?.matchedMandarinVariants)
            ? segment.matchedMandarinVariants.map(normalizeText).filter(Boolean)
            : [],
          entryIds: Array.isArray(segment?.entryIds)
            ? segment.entryIds.map(normalizeText).filter(Boolean)
            : [],
          start: Number(segment?.start || 0) || 0,
          end: Number(segment?.end || 0) || 0,
          reason: normalizeText(segment?.reason),
        };
      })
    : [];
}

function buildAudioFirstReferencePayload(correctionContext, correctionThreshold) {
  const context = correctionContext && typeof correctionContext === "object" ? correctionContext : {};
  return {
    convertedText: normalizeText(context.convertedText || context.lexiconCandidateText),
    convertPairs: Array.isArray(context.convertPairs || context.candidatePairs)
      ? context.convertPairs || context.candidatePairs
      : [],
    differenceSegments: Array.isArray(context.differenceSegments) ? context.differenceSegments : [],
    convertDiffCount: Number(context.convertDiffCount || context.candidateDiffCount || 0) || 0,
    audioFirstReferenceCorrectionThreshold:
      normalizeAudioFirstReferenceCorrectionThreshold(correctionThreshold),
  };
}

function isAudioFirstReferenceStrategy(request) {
  return normalizeRecognitionStrategy(request?.recognitionStrategy, "mandarin_to_dialect") ===
    "audio_first_reference";
}

function normalizeAudioFirstReferenceCorrectionThreshold(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return DEFAULT_AUDIO_FIRST_REFERENCE_CORRECTION_THRESHOLD;
  }
  return Math.max(0, Math.min(1, Number(number.toFixed(3))));
}

function normalizeCorrectionConfidence(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return Math.max(0, Math.min(1, Number(number.toFixed(3))));
}

function normalizeCandidateDecisions(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .slice(0, 20)
    .map(function (item) {
      const source = item && typeof item === "object" ? item : {};
      return {
        sourceText: normalizeText(source.sourceText),
        candidateText: normalizeText(source.candidateText),
        heardFragment: normalizeText(source.heardFragment),
        applyCandidate: source.applyCandidate === true,
        confidence: normalizeCorrectionConfidence(source.confidence),
        reason: normalizeText(source.reason).slice(0, 240),
      };
    })
    .filter(function (item) {
      return item.sourceText || item.candidateText || item.heardFragment;
    });
}

function buildAudioFirstReferenceMeta(compareJson, correctionContext, correctionThreshold) {
  const source = compareJson && typeof compareJson === "object" ? compareJson : {};
  const context = correctionContext && typeof correctionContext === "object" ? correctionContext : {};
  return {
    convertedText: normalizeText(context.convertedText || context.lexiconCandidateText),
    convertPairs: Array.isArray(context.convertPairs || context.candidatePairs)
      ? context.convertPairs || context.candidatePairs
      : [],
    differenceSegments: Array.isArray(context.differenceSegments) ? context.differenceSegments : [],
    convertConfidence: normalizeCorrectionConfidence(context.confidence),
    convertNeedHumanReview: context.needHumanReview === true,
    correctionThreshold: normalizeAudioFirstReferenceCorrectionThreshold(correctionThreshold),
    correctionConfidence: normalizeCorrectionConfidence(source.correctionConfidence),
    candidateDecisions: normalizeCandidateDecisions(source.candidateDecisions),
    candidateText: normalizeText(context.convertedText || context.lexiconCandidateText),
    candidatePairs: Array.isArray(context.convertPairs || context.candidatePairs)
      ? context.convertPairs || context.candidatePairs
      : [],
    candidateConfidence: normalizeCorrectionConfidence(context.confidence),
    candidateNeedHumanReview: context.needHumanReview === true,
  };
}

function resolveAudioFirstReferenceCompareResult(input) {
  const source = input && typeof input === "object" ? input : {};
  const normalizedCompare =
    source.normalizedCompare && typeof source.normalizedCompare === "object"
      ? source.normalizedCompare
      : {};
  const heardText = normalizeText(source.heardText);
  const meta = source.meta && typeof source.meta === "object" ? source.meta : {};
  const convertPairs = Array.isArray(meta.convertPairs || meta.candidatePairs)
    ? meta.convertPairs || meta.candidatePairs
    : [];
  const candidateDecisions = Array.isArray(meta.candidateDecisions) ? meta.candidateDecisions : [];
  const correctionConfidence = normalizeCorrectionConfidence(meta.correctionConfidence);
  const correctionThreshold = normalizeAudioFirstReferenceCorrectionThreshold(
    meta.correctionThreshold
  );
  const normalizedRecommendedText = normalizeText(normalizedCompare.recommendedText);
  const convertedText = normalizeText(meta.convertedText || meta.candidateText);
  const correctionAttempted =
    Boolean(convertedText) &&
    normalizedRecommendedText &&
    normalizedRecommendedText !== heardText;
  const shouldKeepHeardText =
    correctionAttempted === true &&
    correctionConfidence !== null &&
    correctionConfidence < correctionThreshold;

  return {
    recommendedText: shouldKeepHeardText === true
      ? heardText
      : normalizedCompare.recommendedText,
    needHumanReview:
      normalizedCompare.needHumanReview === true ||
      (convertPairs.length > 0 &&
        correctionConfidence !== null &&
        correctionConfidence < correctionThreshold) ||
      (candidateDecisions.length > 0 &&
        candidateDecisions.some(function (item) {
          return item.applyCandidate !== true && item.confidence !== null && item.confidence < correctionThreshold;
        })),
  };
}

function createListenPrompt(request) {
  return createPromptObject(
    "你是 Aishell 闽南语听音助手。你必须只输出 JSON，不要输出 Markdown 或额外解释。",
    [
      request.aiStages?.listen?.prompt || request.aiOptions?.listenPrompt || "",
      "输入：",
      JSON.stringify(
        {
          pageText: request.referenceText,
          fileName: request.fileName,
          duration: request.duration,
          itemNumber: request.itemNumber,
        },
        null,
        2
      ),
    ].join("\n")
  );
}

function createComparePrompt(request, heardText, lexiconContext, correctionContext) {
  const compareInput = {
    pageText: request.referenceText,
    heardText,
    fileName: request.fileName,
    duration: request.duration,
    itemNumber: request.itemNumber,
  };
  const promptLines = [
    request.aiStages?.compare?.prompt || request.aiOptions?.comparePrompt || "",
  ];
  if (lexiconContext?.text) {
    promptLines.push("词表上下文：", lexiconContext.text);
  }
  if (isAudioFirstReferenceStrategy(request) && correctionContext?.enabled === true) {
    compareInput.convertedText = correctionContext.convertedText;
    compareInput.convertPairs = Array.isArray(correctionContext.convertPairs)
      ? correctionContext.convertPairs
      : [];
    compareInput.differenceSegments = Array.isArray(correctionContext.differenceSegments)
      ? correctionContext.differenceSegments
      : [];
    compareInput.convertDiffCount = compareInput.differenceSegments.length;
    compareInput.audioFirstReferenceCorrectionThreshold =
      normalizeAudioFirstReferenceCorrectionThreshold(
        request.aiStages?.compare?.adoptionThreshold ??
          request.aiOptions?.audioFirstReferenceCorrectionThreshold
      );
    promptLines.push(
      "转换结果校正：",
      JSON.stringify(
        buildAudioFirstReferencePayload(
          correctionContext,
          request.aiStages?.compare?.adoptionThreshold ??
            request.aiOptions?.audioFirstReferenceCorrectionThreshold
        ),
        null,
        2
      )
    );
  }
  promptLines.push(
    "输入：",
    JSON.stringify(compareInput, null, 2)
  );
  return createPromptObject(
    "你是 Aishell 闽南语推荐助手。你必须只输出 JSON，不要输出 Markdown 或额外解释。",
    promptLines.join("\n")
  );
}

function createConvertPrompt(request, convertPlan) {
  const promptLines = [request.aiStages?.convert?.prompt || request.aiOptions?.candidatePrompt || ""];
  promptLines.push(
    "输入：",
    JSON.stringify(
      {
        pageText: request.referenceText,
        ruleConvertedText: convertPlan?.convertedText || request.referenceText,
        ambiguousSegments: buildConvertPromptAmbiguousSegments(convertPlan),
        fileName: request.fileName,
        duration: request.duration,
        itemNumber: request.itemNumber,
      },
      null,
      2
    )
  );
  return createPromptObject(
    "你是 Aishell 闽南语转换助手。你必须只输出 JSON，不要输出 Markdown 或额外解释。",
    promptLines.join("\n")
  );
}

function createOmniComparePrompt(request, heardText, lexiconContext, correctionContext) {
  const promptLines = [
    request.aiStages?.compare?.prompt || request.aiOptions?.comparePrompt || "",
    "输入：",
    JSON.stringify(
      {
        pageText: request.referenceText,
        convertedText: normalizeText(correctionContext?.convertedText || ""),
        heardText,
        fileName: request.fileName,
        duration: request.duration,
        itemNumber: request.itemNumber,
      },
      null,
      2
    ),
  ];
  if (lexiconContext?.text) {
    promptLines.splice(1, 0, "词表上下文：", lexiconContext.text);
  }
  if (isAudioFirstReferenceStrategy(request) && correctionContext?.enabled === true) {
    promptLines.splice(
      1,
      0,
      "转换结果校正：",
      JSON.stringify(
        buildAudioFirstReferencePayload(
          correctionContext,
          request.aiStages?.compare?.adoptionThreshold ??
            request.aiOptions?.audioFirstReferenceCorrectionThreshold
        ),
        null,
        2
      )
    );
  }
  return createPromptObject(
    "你是 Aishell 闽南语 Omni 比较助手。你必须只输出 JSON，不要输出 Markdown 或额外解释。",
    promptLines.join("\n")
  );
}

function createProviderInput(request) {
  return {
    pageText: request.referenceText,
    readRequire: request.fileName,
    sentenceNumber: request.itemNumber,
    effectiveTime: request.duration,
    audioDuration: request.duration,
    audioUrl: request.audioUrl,
    aiOptions: request.aiOptions,
  };
}

function normalizeListenResponse(modelJson) {
  const heardText = normalizeToSimplifiedChinesePreservingLexicon(
    removeTextSpaces(String(modelJson?.heardText || ""))
  );
  return {
    heardText,
    confidence: Number(modelJson?.confidence || 0) || 0,
    needHumanReview: modelJson?.needHumanReview === true,
  };
}

function normalizeCandidateResponse(modelJson, request) {
  const fallbackText = normalizeRecommendedText(request?.referenceText || "");
  const convertedText = normalizeRecommendedText(
    modelJson?.convertedText ||
      modelJson?.lexiconCandidateText ||
      modelJson?.candidateText ||
      modelJson?.recommendedText ||
      fallbackText
  );
  return {
    convertedText: convertedText || fallbackText,
    confidence: Number(modelJson?.confidence || 0) || 0,
    needHumanReview: modelJson?.needHumanReview === true,
  };
}

function resolveConvertedTextFromFallback(convertPlan, modelJson, normalizedConvert, request, deps) {
  const ruleText = deps.normalizeRecommendedText(
    convertPlan?.convertedText || request?.referenceText || ""
  );
  if (Array.isArray(modelJson?.resolvedSegments) && modelJson.resolvedSegments.length > 0) {
    return deps.normalizeRecommendedText(
      composeResolvedConvertText(convertPlan, modelJson.resolvedSegments)
    );
  }
  const fallbackText = deps.normalizeRecommendedText(
    normalizedConvert?.convertedText || modelJson?.convertedText || ruleText
  );
  return fallbackText || ruleText;
}

function normalizeRecommendedText(text) {
  return normalizeToSimplifiedChinesePreservingLexicon(removeTextSpaces(String(text || "")));
}

function buildTextAlignment(leftText, rightText) {
  const leftChars = Array.from(String(leftText || ""));
  const rightChars = Array.from(String(rightText || ""));
  const dp = Array.from({ length: leftChars.length + 1 }, function () {
    return new Array(rightChars.length + 1).fill(0);
  });

  for (let leftIndex = leftChars.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightChars.length - 1; rightIndex >= 0; rightIndex -= 1) {
      dp[leftIndex][rightIndex] =
        leftChars[leftIndex] === rightChars[rightIndex]
          ? dp[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(dp[leftIndex + 1][rightIndex], dp[leftIndex][rightIndex + 1]);
    }
  }

  const alignment = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < leftChars.length && rightIndex < rightChars.length) {
    if (leftChars[leftIndex] === rightChars[rightIndex]) {
      alignment.push({
        leftChar: leftChars[leftIndex],
        rightChar: rightChars[rightIndex],
        same: true,
      });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    if (dp[leftIndex + 1][rightIndex] >= dp[leftIndex][rightIndex + 1]) {
      alignment.push({
        leftChar: leftChars[leftIndex],
        rightChar: "",
        same: false,
      });
      leftIndex += 1;
      continue;
    }
    alignment.push({
      leftChar: "",
      rightChar: rightChars[rightIndex],
      same: false,
    });
    rightIndex += 1;
  }

  while (leftIndex < leftChars.length) {
    alignment.push({
      leftChar: leftChars[leftIndex],
      rightChar: "",
      same: false,
    });
    leftIndex += 1;
  }
  while (rightIndex < rightChars.length) {
    alignment.push({
      leftChar: "",
      rightChar: rightChars[rightIndex],
      same: false,
    });
    rightIndex += 1;
  }

  return alignment;
}

function buildDifferenceSegments(leftText, rightText, leftKey, rightKey) {
  const alignment = buildTextAlignment(leftText, rightText);
  const segments = [];
  let leftBuffer = "";
  let rightBuffer = "";

  function flush() {
    const normalizedLeft = normalizeText(leftBuffer);
    const normalizedRight = normalizeText(rightBuffer);
    if (!normalizedLeft && !normalizedRight) {
      leftBuffer = "";
      rightBuffer = "";
      return;
    }
    segments.push({
      [leftKey]: normalizedLeft,
      [rightKey]: normalizedRight,
    });
    leftBuffer = "";
    rightBuffer = "";
  }

  alignment.forEach(function (entry) {
    if (entry.same === true) {
      flush();
      return;
    }
    leftBuffer += String(entry.leftChar || "");
    rightBuffer += String(entry.rightChar || "");
  });
  flush();

  return segments
    .filter(function (entry) {
      return normalizeText(entry?.[leftKey]) || normalizeText(entry?.[rightKey]);
    })
    .slice(0, 20);
}

function buildConvertPairs(pageText, candidateText) {
  return buildDifferenceSegments(pageText, candidateText, "sourceText", "candidateText").map(
    function (entry) {
      return {
        sourceText: normalizeText(entry.sourceText),
        candidateText: normalizeText(entry.candidateText),
        convertedText: normalizeText(entry.candidateText),
        source: "model",
      };
    }
  );
}

function buildHeardConvertDifferenceSegments(heardText, candidateText) {
  return buildDifferenceSegments(heardText, candidateText, "heardFragment", "candidateText").map(
    function (entry) {
      return Object.assign({}, entry, {
        convertedText: normalizeText(entry.candidateText),
      });
    }
  );
}

function resolveLexiconRewriteMode(recognitionStrategy) {
  return normalizeRecognitionStrategy(recognitionStrategy, "mandarin_to_dialect") ===
    "audio_first_reference"
    ? "off"
    : "aggressive";
}

function buildQueueMeta(queueMetas) {
  const groups = Array.isArray(queueMetas) ? queueMetas : [];
  return {
    groups: groups.map(function (item) {
      return {
        groupName: String(item?.groupName || ""),
        queueWaitMs: Math.max(0, Number(item?.queueWaitMs) || 0),
        retryCount: Math.max(0, Number(item?.retryCount) || 0),
        durationMs: Math.max(0, Number(item?.durationMs) || 0),
        activeCount: Math.max(0, Number(item?.activeCount) || 0),
        maxConcurrent: Math.max(0, Number(item?.maxConcurrent) || 0),
      };
    }),
    totalQueueWaitMs: groups.reduce(function (total, item) {
      return total + Math.max(0, Number(item?.queueWaitMs) || 0);
    }, 0),
  };
}

function buildRetryCount(queueMetas) {
  return (Array.isArray(queueMetas) ? queueMetas : []).reduce(function (total, item) {
    return total + Math.max(0, Number(item?.retryCount) || 0);
  }, 0);
}

function buildErrorMeta(requestId, queueMetas, timing, request, stage) {
  const compareFamily = normalizeText(request?.compareFamily || request?.aiStages?.compare?.family);
  const listenModel = normalizeText(request?.listenModel || request?.aiStages?.listen?.model);
  return {
    requestId: normalizeText(requestId),
    stage: normalizeText(stage) || "post_process",
    models: {
      modelMode: normalizeText(request?.modelMode),
      recognitionStrategy: normalizeText(request?.recognitionStrategy),
      pipelineMode: normalizeText(request?.pipelineMode),
      convertModel: normalizeText(request?.convertModel || request?.candidateModel),
      compareModelFamily: compareFamily,
      candidateModel: normalizeText(request?.candidateModel),
      listenModel: listenModel,
      compareModel: normalizeText(request?.compareModel),
      singleModel: normalizeText(request?.singleModel),
      funAsrProvider:
        isFunAsrListenModel(listenModel) ? "rest" : "",
    },
    timing: Object.assign({}, timing),
    usage: {},
    queue: buildQueueMeta(queueMetas),
    cache: {
      hit: false,
      sourceRequestId: "",
    },
    debugId: "",
    retryCount: buildRetryCount(queueMetas),
    cancelled: false,
    debug: {
      frontConcurrencyOriginal: request?.frontConcurrency ?? null,
      frontConcurrencyNormalized: request?.frontConcurrency ?? null,
      concurrencyModelType: normalizeText(request?.concurrencyModelType),
    },
  };
}

function ensureNotAborted(signal, requestId, queueMetas, timing, request, stage) {
  if (signal && signal.aborted === true) {
    throw createStageError(stage, signal.reason || new Error("当前同步请求已取消。"), {
      requestId,
      request,
      stage,
      timing,
      queue: buildQueueMeta(queueMetas),
      retryCount: buildRetryCount(queueMetas),
      cancelled: true,
    });
  }
}

function withStageMeta(requestId, request, queueMetas, timing, stage, fn) {
  return Promise.resolve()
    .then(fn)
    .catch(function (error) {
      throw createStageError(stage, error, {
        requestId,
        request,
        stage,
        timing,
        queue: buildQueueMeta(queueMetas),
        retryCount: buildRetryCount(queueMetas),
        cancelled: error?.code === "aborted" || error?.code === "client-disconnected",
      });
    });
}

function getRemainingTimeoutMs(startedAtMs, timeoutMs) {
  return Math.max(1000, Number(timeoutMs) - Math.max(0, now() - startedAtMs));
}

function createRecommendPipeline(overrides) {
  const deps = Object.assign(
    {
      applyLexiconRewrite,
      buildConvertPrompt: createConvertPrompt,
      buildComparePrompt: createComparePrompt,
      buildLexiconContext,
      buildListenPrompt: createListenPrompt,
      buildOmniComparePrompt: createOmniComparePrompt,
      buildConvertPairs,
      buildHeardConvertDifferenceSegments,
      enqueueTask,
      normalizeConvertResponse: normalizeCandidateResponse,
      normalizeCompareResponse,
      normalizeListenResponse,
      normalizeOmniSingleResponse,
      normalizeRecommendedText,
      normalizeUsage,
      now,
      parseModelJsonText,
      requestCompare,
      requestFunAsrRecognition,
      requestOmniInputAudio,
    },
    overrides || {}
  );

  return {
    async run(normalizedRequest, runtimeOptions) {
      const request = normalizedRequest && typeof normalizedRequest === "object" ? normalizedRequest : {};
      const options = runtimeOptions && typeof runtimeOptions === "object" ? runtimeOptions : {};
      const requestId = normalizeText(options.requestId);
      const startedAtMs = Number(options.startedAtMs || deps.now());
      const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 60000);
      const signal = options.signal || null;
      const queueMetas = [];
      const compareFamily = normalizeCompareFamily(
        request.compareFamily || request.aiStages?.compare?.family,
        "qwen"
      );
      const pipelineMode =
        normalizeText(request.pipelineMode) ||
        deriveParallelPipelineMode(request.listenModel, compareFamily);
      const cacheKey = buildRecommendCacheKey({
        taskItemId: request.taskItemId,
        audioUrl: request.audioUrl,
        referenceText: request.referenceText,
        modelMode: request.modelMode,
        recognitionStrategy: request.recognitionStrategy,
        pipelineMode,
        convertModel: request.convertModel || request.candidateModel,
        listenModel: request.listenModel,
        compareFamily,
        compareModel: request.compareModel,
        convertPrompt: request.aiStages?.convert?.prompt || request.aiOptions?.candidatePrompt,
        listenPrompt: request.aiStages?.listen?.prompt || request.aiOptions?.listenPrompt,
        comparePrompt: request.aiStages?.compare?.prompt || request.aiOptions?.comparePrompt,
        audioFirstReferenceCorrectionThreshold:
          request.aiStages?.compare?.adoptionThreshold ??
          request.aiOptions?.audioFirstReferenceCorrectionThreshold,
      });

      const timing = {
        listenDurationMs: 0,
        convertDurationMs: 0,
        candidateDurationMs: 0,
        compareDurationMs: 0,
        totalDurationMs: 0,
      };

      const providerInput = createProviderInput(request);
      const runQueuedTask = async function runQueuedTask(groupName, stage, task, queueOptions) {
        const queued = await withStageMeta(
          requestId,
          request,
          queueMetas,
          Object.assign({}, timing),
          stage,
          function () {
            return deps.enqueueTask(groupName, task, Object.assign({ signal }, queueOptions || {}));
          }
        );
        queueMetas.push(queued.queueMeta || {});
        return queued.value;
      };

      ensureNotAborted(signal, requestId, queueMetas, timing, request, "queue");

      let heardText = "";
      let convertedText = deps.normalizeRecommendedText(request.referenceText);
      let decision = "";
      let changePoints = [];
      let needHumanReview = false;
      let compareConfidence = 0;
      let listenConfidence = 0;
      let convertUsage = {};
      let listenUsage = {};
      let compareUsage = {};
      let audioFirstReferenceMeta = null;
      const activeConvertModel =
        normalizeText(request.convertModel || request.candidateModel) ||
        normalizeText(request.compareModel);
      const activeListenModel = normalizeText(request.listenModel) || DEFAULT_OMNI_MODEL;
      const activeCompareModel =
        compareFamily === "omni"
          ? normalizeText(request.compareModel) || DEFAULT_OMNI_MODEL
          : normalizeText(request.compareModel);
      const lexiconRewriteMode = resolveLexiconRewriteMode(request.recognitionStrategy);
      let lexicon = {
        enabled: false,
        rewriteMode: lexiconRewriteMode,
        rewriteChanged: false,
        matchedCount: 0,
        rewriteChanges: [],
      };

      let lexiconContext = deps.buildLexiconContext({
        pageText: request.referenceText,
        heardText: "",
        limit: 60,
      });
      let conversionContext = null;
      const execution = {
        mergedStages: [],
      };

      const correctionThreshold =
        request.aiStages?.compare?.adoptionThreshold ??
        request.aiOptions?.audioFirstReferenceCorrectionThreshold;
      const convertPlan = buildRuleFirstConvertPlan(request.referenceText);
      const buildConversionContext = function (nextConvertedText, nextHeardText, convertStageResult) {
        const context = {
          enabled: Boolean(nextConvertedText),
          convertedText: nextConvertedText,
          lexiconCandidateText: nextConvertedText,
          convertPairs: deps.buildConvertPairs(request.referenceText, nextConvertedText),
          candidatePairs: deps.buildConvertPairs(request.referenceText, nextConvertedText),
          convertDiffCount: 0,
          candidateDiffCount: 0,
          differenceSegments: deps.buildHeardConvertDifferenceSegments(nextHeardText, nextConvertedText),
          confidence: normalizeCorrectionConfidence(convertStageResult?.confidence),
          needHumanReview: convertStageResult?.needHumanReview === true,
        };
        context.convertDiffCount = context.differenceSegments.length;
        context.candidateDiffCount = context.differenceSegments.length;
        return context;
      };

      const runConvertStage = async function () {
        ensureNotAborted(signal, requestId, queueMetas, timing, request, "convert");
        const convertStartedAt = deps.now();
        if (!convertPlan.requiresModelFallback) {
          timing.convertDurationMs = Math.max(0, deps.now() - convertStartedAt);
          timing.candidateDurationMs = timing.convertDurationMs;
          return {
            convertedText: deps.normalizeRecommendedText(convertPlan.convertedText || request.referenceText),
            confidence: 1,
            needHumanReview: false,
            usage: {},
          };
        }
        const convertPrompt = deps.buildConvertPrompt(request, convertPlan);
        const convertResult = await runQueuedTask("aishell_text_compare", "convert", function () {
          return deps.requestCompare(providerInput, convertPrompt, request.referenceText, Object.assign(
            {},
            request.aiStages?.convert?.params || {},
            {
              model: activeConvertModel,
              timeoutMs: getRemainingTimeoutMs(startedAtMs, timeoutMs),
              enableThinking: false,
              signal,
            }
          ));
        }, {
          modelName: activeConvertModel,
        });
        timing.convertDurationMs = Math.max(0, deps.now() - convertStartedAt);
        timing.candidateDurationMs = timing.convertDurationMs;
        const convertJson = deps.parseModelJsonText(convertResult.rawText, {
          requestId,
          stage: "convert",
          model: convertResult.model,
        });
        const normalizedConvert = deps.normalizeConvertResponse(convertJson, request);
        return {
          convertedText: resolveConvertedTextFromFallback(
            convertPlan,
            convertJson,
            normalizedConvert,
            request,
            deps
          ),
          confidence: normalizedConvert.confidence,
          needHumanReview: normalizedConvert.needHumanReview === true,
          usage: deps.normalizeUsage(convertResult.usage || {}),
        };
      };

      const runListenStage = async function () {
        if (isFunAsrListenModel(activeListenModel)) {
          const listenStartedAt = deps.now();
          const funAsrResult = await runQueuedTask("aishell_fun_asr", "listen", function () {
            return deps.requestFunAsrRecognition(providerInput, Object.assign(
              {},
              request.aiStages?.listen?.params || {},
              {
                model: activeListenModel,
                timeoutMs: getRemainingTimeoutMs(startedAtMs, timeoutMs),
                requestId,
                signal,
              }
            ));
          }, {
            modelName: activeListenModel,
          });
          timing.listenDurationMs = Math.max(0, deps.now() - listenStartedAt);
          return {
            heardText: normalizeText(funAsrResult.heardText),
            confidence: Number(funAsrResult.confidence || 0) || 0,
            needHumanReview: funAsrResult.needHumanReview === true,
            usage: deps.normalizeUsage(funAsrResult.usage || {}),
          };
        }

        const listenPrompt = deps.buildListenPrompt(request);
        const listenStartedAt = deps.now();
        const omniListenResult = await runQueuedTask("aishell_qwen_omni", "listen", function () {
          return deps.requestOmniInputAudio(providerInput, listenPrompt, Object.assign(
            {},
            request.aiStages?.listen?.params || {},
            {
              model: activeListenModel,
              timeoutMs: getRemainingTimeoutMs(startedAtMs, timeoutMs),
              enableThinking: false,
              signal,
            }
          ));
        }, {
          modelName: activeListenModel,
        });
        timing.listenDurationMs = Math.max(0, deps.now() - listenStartedAt);
        const listenJson = deps.parseModelJsonText(omniListenResult.rawText, {
          requestId,
          stage: "listen",
          model: omniListenResult.model,
        });
        const normalizedListen = deps.normalizeOmniSingleResponse(listenJson, {
          pageText: request.referenceText,
        });
        return {
          heardText: normalizeText(normalizedListen.heardText),
          confidence: Number(normalizedListen.confidence || 0) || 0,
          needHumanReview: normalizedListen.needHumanReview === true,
          usage: deps.normalizeUsage(omniListenResult.usage || {}),
        };
      };

      let convertStageResult = null;
      let listenStageResult = null;
      let resolvedCompare = null;
      const stageResults = await Promise.all([runConvertStage(), runListenStage()]);
      convertStageResult = stageResults[0] || {};
      listenStageResult = stageResults[1] || {};
      convertedText = normalizeText(convertStageResult.convertedText || request.referenceText);
      heardText = normalizeText(listenStageResult.heardText);
      listenConfidence = Number(listenStageResult.confidence || 0) || 0;
      convertUsage = convertStageResult.usage || {};
      listenUsage = listenStageResult.usage || {};

      lexiconContext = deps.buildLexiconContext({
        pageText: request.referenceText,
        heardText,
        limit: 60,
      });
      conversionContext = buildConversionContext(convertedText, heardText, convertStageResult);

      ensureNotAborted(signal, requestId, queueMetas, timing, request, "compare");
      if (compareFamily === "omni") {
        const omniComparePrompt = deps.buildOmniComparePrompt(
          request,
          heardText,
          lexiconContext,
          conversionContext
        );
        const compareStartedAt = deps.now();
        const omniCompareResult = await runQueuedTask("aishell_qwen_omni", "compare", function () {
          return deps.requestOmniInputAudio(providerInput, omniComparePrompt, Object.assign(
            {},
            request.aiStages?.compare?.params || {},
            {
              model: activeCompareModel || DEFAULT_OMNI_MODEL,
              timeoutMs: getRemainingTimeoutMs(startedAtMs, timeoutMs),
              enableThinking: false,
              signal,
            }
          ));
        }, {
          modelName: activeCompareModel || DEFAULT_OMNI_MODEL,
        });
        timing.compareDurationMs = Math.max(0, deps.now() - compareStartedAt);
        const compareJson = deps.parseModelJsonText(omniCompareResult.rawText, {
          requestId,
          stage: "omni_compare",
          model: omniCompareResult.model,
        });
        const normalizedCompare = deps.normalizeOmniSingleResponse(compareJson, {
          pageText: request.referenceText,
        });
        audioFirstReferenceMeta = buildAudioFirstReferenceMeta(
          compareJson,
          conversionContext,
          correctionThreshold
        );
        resolvedCompare = isAudioFirstReferenceStrategy(request)
          ? resolveAudioFirstReferenceCompareResult({
              normalizedCompare,
              heardText,
              meta: audioFirstReferenceMeta,
            })
          : normalizedCompare;
        decision = normalizeText(normalizedCompare.decision);
        changePoints = Array.isArray(normalizedCompare.changePoints)
          ? normalizedCompare.changePoints
          : [];
        compareConfidence = Number(normalizedCompare.confidence || 0) || 0;
        compareUsage = deps.normalizeUsage(omniCompareResult.usage || {});
        needHumanReview =
          resolvedCompare.needHumanReview === true ||
          listenStageResult.needHumanReview === true ||
          convertStageResult.needHumanReview === true;
      } else {
        const comparePrompt = deps.buildComparePrompt(
          request,
          heardText,
          lexiconContext,
          conversionContext
        );
        const compareStartedAt = deps.now();
        const compareResult = await runQueuedTask("aishell_text_compare", "compare", function () {
          return deps.requestCompare(providerInput, comparePrompt, heardText, Object.assign(
            {},
            request.aiStages?.compare?.params || {},
            {
              model: activeCompareModel,
              timeoutMs: getRemainingTimeoutMs(startedAtMs, timeoutMs),
              enableThinking: false,
              signal,
            }
          ));
        }, {
          modelName: activeCompareModel,
        });
        timing.compareDurationMs = Math.max(0, deps.now() - compareStartedAt);
        const compareJson = deps.parseModelJsonText(compareResult.rawText, {
          requestId,
          stage: "compare",
          model: compareResult.model,
        });
        const normalizedCompare = deps.normalizeCompareResponse(compareJson, {
          pageText: request.referenceText,
          heardText,
        });
        audioFirstReferenceMeta = buildAudioFirstReferenceMeta(
          compareJson,
          conversionContext,
          correctionThreshold
        );
        resolvedCompare = isAudioFirstReferenceStrategy(request)
          ? resolveAudioFirstReferenceCompareResult({
              normalizedCompare,
              heardText,
              meta: audioFirstReferenceMeta,
            })
          : normalizedCompare;
        decision = normalizeText(normalizedCompare.decision);
        changePoints = Array.isArray(normalizedCompare.changePoints)
          ? normalizedCompare.changePoints
          : [];
        compareConfidence = Number(normalizedCompare.confidence || 0) || 0;
        compareUsage = deps.normalizeUsage(compareResult.usage || {});
        needHumanReview =
          resolvedCompare.needHumanReview === true ||
          listenStageResult.needHumanReview === true ||
          convertStageResult.needHumanReview === true;
      }

      const rewriteState = deps.applyLexiconRewrite(
        deps.normalizeRecommendedText(resolvedCompare?.recommendedText || heardText || convertedText),
        {
          mode: lexiconRewriteMode,
        }
      );
      needHumanReview = needHumanReview || rewriteState.changed === true;
      lexicon = {
        enabled: lexiconContext.enabled === true,
        rewriteMode: lexiconRewriteMode,
        rewriteChanged: rewriteState.changed === true,
        matchedCount: Number(lexiconContext.matchedCount || 0) || 0,
        rewriteChanges: Array.isArray(rewriteState.changes) ? rewriteState.changes : [],
      };
      timing.totalDurationMs = Math.max(0, deps.now() - startedAtMs);
      const cost = estimateProjectCost({
        convert: {
          modelId: activeConvertModel,
          usage: convertUsage,
          outputMode: "text",
        },
        listen: {
          modelId: activeListenModel,
          usage: listenUsage,
          outputMode: "text",
        },
        compare: {
          modelId: activeCompareModel,
          usage: compareUsage,
          outputMode: "text",
        },
      });

      return {
        cacheEntry: {
          key: cacheKey,
        },
        data: {
          taskId: request.taskId,
          packageId: request.packageId,
          taskItemId: request.taskItemId,
          fileName: request.fileName,
          referenceText: request.referenceText,
          existingMarkText: request.existingMarkText,
          convertedText,
          lexiconCandidateText: convertedText,
          heardText,
          recommendedText: rewriteState.text,
          isChanged: normalizeText(rewriteState.text) !== normalizeText(request.referenceText),
          needHumanReview,
          decision,
          changePoints,
          lexicon,
        },
        meta: {
          requestId,
          stage: "complete",
          models: {
            modelMode: request.modelMode,
            recognitionStrategy: request.recognitionStrategy,
            pipelineMode,
            convertModel: activeConvertModel,
            compareModelFamily: compareFamily,
            candidateModel: activeConvertModel,
            listenModel: activeListenModel,
            compareModel: activeCompareModel,
            singleModel: compareFamily === "omni" ? activeCompareModel : "",
            funAsrProvider: isFunAsrListenModel(activeListenModel) ? "rest" : "",
          },
          execution: Object.assign({}, execution),
          timing: Object.assign({}, timing),
          usage: {
            promptTokens:
              Number(convertUsage.promptTokens || 0) +
              Number(listenUsage.promptTokens || 0) +
              Number(compareUsage.promptTokens || 0),
            completionTokens:
              Number(convertUsage.completionTokens || 0) +
              Number(listenUsage.completionTokens || 0) +
              Number(compareUsage.completionTokens || 0),
            totalTokens:
              Number(convertUsage.totalTokens || 0) +
              Number(listenUsage.totalTokens || 0) +
              Number(compareUsage.totalTokens || 0),
            convert: convertUsage,
            candidate: convertUsage,
            listen: listenUsage,
            compare: compareUsage,
          },
          cost,
          queue: buildQueueMeta(queueMetas),
          cache: {
            hit: false,
            sourceRequestId: "",
          },
          debugId: "",
          retryCount: buildRetryCount(queueMetas),
          cancelled: false,
          debug: {
            frontConcurrencyOriginal: request.frontConcurrency ?? null,
            frontConcurrencyNormalized: request.frontConcurrency ?? null,
            concurrencyModelType: normalizeText(request.concurrencyModelType),
          },
          audioFirstReference: audioFirstReferenceMeta,
        },
      };
    },
    buildErrorMeta,
  };
}

module.exports = {
  createRecommendPipeline,
};
