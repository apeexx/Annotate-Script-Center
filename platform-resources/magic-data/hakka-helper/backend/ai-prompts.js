"use strict";

const RULE_VERSION = "magic-data-hakka-helper-ai-review-v2-prompt-simplified-only";
const DEFAULT_LISTEN_TEMPLATE = [
  "你是客家话音频辅助检查助手。",
  "听音结果只作为辅助证据，不作为平台文本自动替换依据。",
  "请优先判断音频有效性与风险，并辅助判断说话人属性。",
  "所有普通中文字段一律输出简体中文，禁止输出普通繁体字；只有命中客家话词表统一用字时才保留该写法。",
  "严格输出 JSON，不输出 Markdown 或额外解释。",
].join("\n");
const DEFAULT_COMPARE_TEMPLATE = [
  "当前任务是客家话三项预测质检，不是直接改写平台文本。",
  "请分别检查：说话人书写（性别/年龄）、客家话内容、普通话文本。",
  "每项必须给出是否正确、平台值、建议值、原因、置信度。",
  "所有普通中文字段一律输出简体中文，禁止输出普通繁体字；只有命中客家话词表统一用字时才保留该写法。",
  "严格输出 JSON，不输出额外解释。",
].join("\n");
const DEFAULT_OMNI_SINGLE_TEMPLATE = [
  "你要一次完成：听音 + 三项预测质检（说话人书写、客家话内容、普通话文本）。",
  "平台已填内容是被检对象，音频实际发声优先。",
  "输出 JSON 字段必须包含 speakerCheck、dialectTextCheck、mandarinTextCheck、overall、heard。",
  "普通中文统一简体；命中词表建议用字优先保留。",
  "只输出 JSON，不输出 Markdown 或解释文字。",
].join("\n");
const DEFAULT_RECOGNITION_CONVERT_LISTEN_TEMPLATE = [
  "你是客家话音频识别助手。",
  "请先把客家话语音识别为普通话表达，不要直接生成客家话字形。",
  "输出仅用于后续词表转换和三项质检。",
  "所有普通中文字段一律输出简体中文，禁止输出普通繁体字。",
  "严格输出 JSON，不输出 Markdown 或额外解释。",
].join("\n");
const DEFAULT_RECOGNITION_CONVERT_COMPARE_TEMPLATE = [
  "当前任务是识别转换 + 三项预测质检。",
  "先基于识别到的普通话文本，结合词表和平台上下文，生成建议客家话文本。",
  "命中词表的客家话建议用字优先保留词表写法，不强制繁体。",
  "词表未覆盖时不要强行转换为生僻客家字，可保留稳妥表达并标记待人工复核。",
  "所有普通中文字段一律输出简体中文，禁止输出普通繁体字；只有命中客家话词表统一用字时才保留该写法。",
  "再检查三项：说话人属性、客家话内容、普通话文本。",
  "严格输出 JSON，不输出 Markdown 或额外解释。",
].join("\n");

function getLexiconText(lexiconContext) {
  return String(lexiconContext?.text || "").trim();
}

function normalizePromptTemplate(value, fallback) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!text) {
    return String(fallback || "");
  }
  return text.slice(0, 8000);
}

function buildListenPrompt(request, lexiconContext) {
  const template = normalizePromptTemplate(
    request?.aiOptions?.listenPrompt,
    DEFAULT_LISTEN_TEMPLATE
  );
  const lexiconText = getLexiconText(lexiconContext);
  const meta = {
    taskItemId: request.taskItemId,
    samplingRecordId: request.samplingRecordId,
    projectName: request.projectName,
    speaker: request.speaker,
    effectiveStartTime: request.effectiveStartTime,
    effectiveEndTime: request.effectiveEndTime,
    effectiveTime: request.effectiveTime,
    audioDuration: request.audioDuration,
    platformDialectText: request.platformDialectText,
    platformMandarinText: request.platformMandarinText,
  };

  const promptLines = [
    template,
    "请优先判断音频有效性与风险：无有效人声、噪音、方言区域错误、切音、多人重叠、听不清、非方言、敏感数据、机器合成音。",
    "请辅助判断说话人性别和年龄段，可输出 uncertain。",
    "输出严格 JSON 字段：heardDialectText, heardMandarinMeaning, isValidAudio, validityDecision, invalidReasons, riskFlags, genderGuess, ageRangeGuess, confidence。",
    "validityDecision 只能是 valid|invalid|uncertain。",
    "ageRangeGuess 只能是 0-5|6-12|13-18|19-25|26-36|37-50|51-65|65以上|uncertain。",
    "heardDialectText 与 heardMandarinMeaning 中的普通中文必须使用简体，禁止输出 這/個/聽/講/說/學/競/賽/輔/導 等普通繁体字。",
  ];

  if (lexiconText) {
    promptLines.push("客家话词表上下文（仅提示，不做强替换）：", lexiconText);
  }

  promptLines.push("输入信息：", JSON.stringify(meta, null, 2));

  return {
    ruleVersion: RULE_VERSION,
    systemPrompt:
      "你是客家话音频复核助手。严格输出 JSON，不要输出 Markdown，不要输出额外解释。",
    userPrompt: promptLines.join("\n"),
  };
}

function buildComparePrompt(request, listen, lexiconContext) {
  const template = normalizePromptTemplate(
    request?.aiOptions?.comparePrompt,
    DEFAULT_COMPARE_TEMPLATE
  );
  const lexiconText = getLexiconText(lexiconContext);
  const input = {
    reviewMode: request.reviewMode || "rule_first",
    rulesProfile: request.rulesProfile,
    platformBaseline: {
      dialectText: request.platformDialectText,
      mandarinText: request.platformMandarinText,
      gender: request?.speaker?.gender || "",
      ageRange: request?.speaker?.ageRange || "",
    },
    listenEvidence: {
      heardDialectText: listen.heardDialectText,
      heardMandarinMeaning: listen.heardMandarinMeaning,
      isValidAudio: listen.isValidAudio,
      validityDecision: listen.validityDecision,
      riskFlags: listen.riskFlags,
      genderGuess: listen.genderGuess,
      ageRangeGuess: listen.ageRangeGuess,
      confidence: listen.confidence,
    },
  };

  const promptLines = [
    template,
    "输出结构必须包含：speakerCheck, dialectTextCheck, mandarinTextCheck, overall, heard。",
    "speakerCheck 中必须包含 gender 与 ageRange 两个对象，每个对象字段为：isCorrect, platformValue, suggestedValue, reason, confidence。",
    "dialectTextCheck / mandarinTextCheck 字段为：isCorrect, platformValue, suggestedValue, reason, confidence。",
    "overall 字段包含：reviewConclusion(pass|need_review|risky|invalid_audio), shouldReview, summary。",
    "heard 字段包含：heardDialectText, heardMandarinMeaning。",
    "不要默认推翻平台文本。没有明显问题时 suggestedValue 应保持与平台值一致。",
    "普通中文统一简体；禁止输出普通繁体字；命中词表建议用字优先保留。",
    "第二行普通话含义需与方言行含义一致；若无法确认请 shouldReview=true。",
  ];

  if (lexiconText) {
    promptLines.push("客家话词表上下文：", lexiconText);
  }

  promptLines.push("输入信息：", JSON.stringify(input, null, 2));

  return {
    ruleVersion: RULE_VERSION,
    systemPrompt: "你是客家话标注规则质检助手。只能输出 JSON，不能输出额外文本。",
    userPrompt: promptLines.join("\n"),
  };
}

function buildOmniSinglePrompt(request, lexiconContext) {
  const template = normalizePromptTemplate(
    request?.aiOptions?.listenPrompt || request?.aiOptions?.comparePrompt,
    DEFAULT_OMNI_SINGLE_TEMPLATE
  );
  const lexiconText = getLexiconText(lexiconContext);
  const input = {
    rulesProfile: request.rulesProfile || "hakka",
    projectName: request.projectName || "",
    speaker: request.speaker || {},
    effectiveStartTime: request.effectiveStartTime,
    effectiveEndTime: request.effectiveEndTime,
    effectiveTime: request.effectiveTime,
    audioDuration: request.audioDuration,
    platformDialectText: request.platformDialectText,
    platformMandarinText: request.platformMandarinText,
  };
  const promptLines = [
    template,
    "规则：",
    "1. 说话人书写需检查性别和年龄段；不确定时 isCorrect=null 且 shouldReview=true。",
    "2. 如果实际发声与平台方言行一致，优先保留平台方言行。",
    "3. 如果实际发声明显不同，方言建议按实际发声输出。",
    "4. 第二行普通话含义必须与方言行含义一致；不确定时 shouldReview=true。",
    "5. 词表只用于字形选择，不用于无依据改写。",
    "6. 输出字段：speakerCheck / dialectTextCheck / mandarinTextCheck / overall / heard。",
    "7. overall.reviewConclusion 只能是 pass|need_review|risky|invalid_audio。",
    "8. 所有普通中文字段必须使用简体，禁止输出普通繁体字；只有命中词表统一用字时才保留。",
    "9. 只输出 JSON，不输出额外说明。",
  ];

  if (lexiconText) {
    promptLines.push("客家话词表上下文：", lexiconText);
  }

  promptLines.push("输入信息：", JSON.stringify(input, null, 2));

  return {
    ruleVersion: RULE_VERSION,
    systemPrompt: "你是客家话音频与文本复核助手。严格输出 JSON，不要输出 Markdown。",
    userPrompt: promptLines.join("\n"),
  };
}

function buildRecognitionConvertListenPrompt(request, lexiconContext) {
  const template = normalizePromptTemplate(
    request?.aiOptions?.listenPrompt,
    DEFAULT_RECOGNITION_CONVERT_LISTEN_TEMPLATE
  );
  const lexiconText = getLexiconText(lexiconContext);
  const input = {
    taskItemId: request.taskItemId,
    samplingRecordId: request.samplingRecordId,
    projectName: request.projectName,
    speaker: request.speaker,
    effectiveStartTime: request.effectiveStartTime,
    effectiveEndTime: request.effectiveEndTime,
    effectiveTime: request.effectiveTime,
    audioDuration: request.audioDuration,
    platformDialectText: request.platformDialectText,
    platformMandarinText: request.platformMandarinText,
  };
  const promptLines = [
    template,
    "先判断音频是否有效，再输出识别到的普通话文本。",
    "JSON 必须包含字段：recognizedMandarinText, isValidAudio, validityDecision, invalidReasons, riskFlags, genderGuess, ageRangeGuess, confidence。",
    "validityDecision 只能是 valid|invalid|uncertain。",
    "genderGuess 只能是 男|女|uncertain。",
    "ageRangeGuess 只能是 0-5|6-12|13-18|19-25|26-36|37-50|51-65|65以上|uncertain。",
    "recognizedMandarinText 必须使用简体中文，禁止输出普通繁体字。",
  ];
  if (lexiconText) {
    promptLines.push("词表上下文（仅辅助理解，不要求在本阶段输出客家话）：", lexiconText);
  }
  promptLines.push("输入信息：", JSON.stringify(input, null, 2));
  return {
    ruleVersion: RULE_VERSION,
    systemPrompt:
      "你是客家话语音识别助手。严格输出 JSON，不要输出 Markdown，不要输出额外解释。",
    userPrompt: promptLines.join("\n"),
  };
}

function buildRecognitionConvertComparePrompt(request, context) {
  const template = normalizePromptTemplate(
    request?.aiOptions?.comparePrompt,
    DEFAULT_RECOGNITION_CONVERT_COMPARE_TEMPLATE
  );
  const lexiconText = getLexiconText(context?.lexiconContext);
  const input = {
    rulesProfile: request.rulesProfile || "hakka",
    recognizedMandarinText: context?.recognizedMandarinText || "",
    convertedDialectText: context?.convertedDialectText || "",
    platformBaseline: {
      dialectText: request.platformDialectText || "",
      mandarinText: request.platformMandarinText || "",
      gender: request?.speaker?.gender || "",
      ageRange: request?.speaker?.ageRange || "",
    },
    listenEvidence: context?.listenEvidence || {},
    lexiconMatches: Array.isArray(context?.lexiconMatches) ? context.lexiconMatches : [],
  };
  const promptLines = [
    template,
    "输出结构必须包含：speakerCheck, dialectTextCheck, mandarinTextCheck, overall, heard。",
    "speakerCheck 内必须有 gender 和 ageRange，字段：isCorrect, platformValue, suggestedValue, reason, confidence。",
    "dialectTextCheck / mandarinTextCheck 字段：isCorrect, platformValue, suggestedValue, reason, confidence。",
    "overall 字段：reviewConclusion(pass|need_review|risky|invalid_audio), shouldReview, summary。",
    "heard 字段：heardDialectText, heardMandarinMeaning。",
    "同时输出 recognizedMandarinText, convertedDialectText, lexiconMatches, conversionWarnings。",
    "命中词表的客家话建议用字优先保留词表写法，不强制繁体。",
    "所有普通中文字段必须使用简体中文，禁止输出普通繁体字；只有命中词表统一用字时才保留。",
    "词表找不到对应写法时不要编造冷门客家字，保守输出并在 conversionWarnings 标记 needHumanReview=true。",
    "不要为了更像客家话而无依据改写，普通话文本与客家话文本必须语义一致。",
  ];
  if (lexiconText) {
    promptLines.push("客家话词表上下文：", lexiconText);
  }
  promptLines.push("输入信息：", JSON.stringify(input, null, 2));
  return {
    ruleVersion: RULE_VERSION,
    systemPrompt: "你是客家话识别转换质检助手。只能输出 JSON，不能输出额外文本。",
    userPrompt: promptLines.join("\n"),
  };
}

module.exports = {
  RULE_VERSION,
  DEFAULT_LISTEN_TEMPLATE,
  DEFAULT_COMPARE_TEMPLATE,
  DEFAULT_OMNI_SINGLE_TEMPLATE,
  DEFAULT_RECOGNITION_CONVERT_LISTEN_TEMPLATE,
  DEFAULT_RECOGNITION_CONVERT_COMPARE_TEMPLATE,
  buildComparePrompt,
  buildListenPrompt,
  buildOmniSinglePrompt,
  buildRecognitionConvertListenPrompt,
  buildRecognitionConvertComparePrompt,
};

