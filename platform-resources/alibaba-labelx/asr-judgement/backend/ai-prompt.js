"use strict";

const fs = require("fs");
const path = require("path");

const RULE_VERSION = "asr-judgement-rules-20260422";
const AI_RESOURCE_DIR = path.join(__dirname, "ai");
const RULES_PATH = path.join(AI_RESOURCE_DIR, "rules-v2.ai.md");
const LISTEN_TEMPLATE_PATH = path.join(AI_RESOURCE_DIR, "listen-prompt-template.md");
const COMPARE_TEMPLATE_PATH = path.join(AI_RESOURCE_DIR, "compare-prompt-template.md");

const FALLBACK_RULES_TEXT = [
  "# 阿里 LabelX ASR 快判 AI 规则（asr-judgement-rules-20260422）",
  "",
  "1. 快判任务是比较 asrText1/asrText2 哪个更优，不是生成转写稿。",
  "2. 必须先按 P0/P1/P2 分层判断两条候选。",
  "3. 一条有 P0/P1、另一条仅 P2 或无错时，必须选另一条。",
  "4. 两条都有 P0/P1 且影响理解时，才允许 both_bad。",
  "5. uncertain_or_similar 只能用于两条都合格且无明显优劣。",
  "6. 实意词/专有名词/动作词优先级高于标点与格式。",
  "7. heardText 仅辅助，不可直接替代候选答案。",
  "8. 专有名词与行业词需结合 Web Search 消歧。",
  "9. 只输出 JSON，不输出 Markdown。",
].join("\n");

const FALLBACK_LISTEN_TEMPLATE = [
  "你是 ASR 快判听音模型。",
  "",
  "请只根据音频输出 JSON，字段必须包含：",
  "- heardText: string",
  "- confidence: 0~1",
  "- isValidAudio: boolean",
  "- invalidReasons: string[]",
  "- uncertainParts: string[]",
  "- audioNotes: string（可选，20字以内）",
  "",
  "若音频无效、不可访问、无语音或严重噪音，请 isValidAudio=false，并给出 invalidReasons。",
  "不要输出 JSON 之外内容。",
].join("\n");

const FALLBACK_COMPARE_TEMPLATE = [
  "你是 ASR 快判比较模型。",
  "",
  "请以 asrText1/asrText2 为主判断对象，结合 heardText、上文和 Web Search 辅助判断哪个更优。",
  "输出 JSON 字段：",
  "- answer: first_better|second_better|both_bad|uncertain_or_similar|other_dialect_or_language",
  "- confidence: 0~1",
  "- reasonSummary: 30字以内",
  "- riskLevel: low|medium|high",
  "- needManualSearch: boolean",
  "- shouldWarnBeforeApply: boolean",
  "- contextUsed: boolean",
  "- evidence: { heardText, asrText1Match, asrText2Match, contextHint }",
  "",
  "注意：",
  "1) 这是候选比较任务，不是听音转写任务。",
  "2) heardText 仅辅助，不能直接替代候选答案。",
  "3) 上文和 Web Search 仅用于消歧，不能覆盖音频与候选文本。",
  "4) 必须先做 P0/P1/P2 分层，不允许跳过。",
  "5) both_bad 只能在两条都明显不合格时使用。",
  "6) uncertain_or_similar 应少用，仅用于两条都合格且无明显优劣。",
  "7) 实意词/专有名词/动作词优先级高于标点格式。",
  "8) 共同核心词漏字或错字且影响语义时，必须 both_bad。",
  "9) 重复词要比较重复次数接近度，明显多转/漏转时选更接近者。",
  "不要输出 JSON 之外内容。",
].join("\n");

const cache = {
  rulesText: null,
  listenTemplateText: null,
  compareTemplateText: null,
};

function readUtf8FileOrFallback(filePath, fallbackText) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const trimmed = String(text || "").trim();
    return trimmed || fallbackText;
  } catch (error) {
    return fallbackText;
  }
}

function loadRulesText() {
  if (typeof cache.rulesText === "string") {
    return cache.rulesText;
  }
  cache.rulesText = readUtf8FileOrFallback(RULES_PATH, FALLBACK_RULES_TEXT);
  return cache.rulesText;
}

function loadListenTemplateText() {
  if (typeof cache.listenTemplateText === "string") {
    return cache.listenTemplateText;
  }
  cache.listenTemplateText = readUtf8FileOrFallback(
    LISTEN_TEMPLATE_PATH,
    FALLBACK_LISTEN_TEMPLATE
  );
  return cache.listenTemplateText;
}

function loadCompareTemplateText() {
  if (typeof cache.compareTemplateText === "string") {
    return cache.compareTemplateText;
  }
  cache.compareTemplateText = readUtf8FileOrFallback(
    COMPARE_TEMPLATE_PATH,
    FALLBACK_COMPARE_TEMPLATE
  );
  return cache.compareTemplateText;
}

function resolveTemplateText(overrideText, fallbackText) {
  const text = String(overrideText || "").trim();
  return text ? text.slice(0, 8000) : fallbackText;
}

function buildSafetyAppendix() {
  return [
    "后端安全边界（不可忽略）：",
    "1) 只输出 JSON，不输出 Markdown 或解释段落。",
    "2) answer 仅允许：first_better|second_better|both_bad|uncertain_or_similar|other_dialect_or_language。",
    "3) 这是人工参考建议，不允许暗示自动采用/保存/提交/领取/流转。",
    "4) 不输出 API Key、token、cookie、authorization、完整 URL。",
  ].join("\n");
}

function buildListenPrompt(request) {
  const template = resolveTemplateText(
    request?.aiOptions?.listenPrompt,
    loadListenTemplateText()
  );
  const inputJson = {
    projectId: String(request?.projectId || ""),
    subTaskId: String(request?.subTaskId || ""),
    itemId: String(request?.itemId || ""),
    itemIndex: Number(request?.itemIndex || 0),
    audioUrlAvailable: Boolean(request?.audioUrl),
  };

  const userPrompt = [
    "ruleVersion: " + RULE_VERSION,
    "",
    "规则：",
    loadRulesText(),
    "",
    template,
    "",
    buildSafetyAppendix(),
    "",
    "输入摘要：",
    JSON.stringify(inputJson, null, 2),
  ].join("\n");

  return {
    systemPrompt:
      "你是 Alibaba LabelX ASR 快判听音助手。只输出 JSON，不要输出 JSON 以外文本。",
    userPrompt,
    ruleVersion: RULE_VERSION,
  };
}

function buildComparePrompt(request, listen) {
  const template = resolveTemplateText(
    request?.aiOptions?.comparePrompt,
    loadCompareTemplateText()
  );
  const includeContext = request?.includeContext === true && request?.contextAvailable === true;
  const inputJson = {
    asrText1: String(request?.asrText1 || ""),
    asrText2: String(request?.asrText2 || ""),
    heardText: String(listen?.heardText || ""),
    listenConfidence: Number(listen?.confidence || 0),
    isValidAudio: listen?.isValidAudio !== false,
    invalidReasons: Array.isArray(listen?.invalidReasons) ? listen.invalidReasons : [],
    includeContext: includeContext,
    contextText: includeContext ? String(request?.contextText || "") : "",
    webSearchEnabled: request?.webSearchEnabled === true,
  };

  const userPrompt = [
    "ruleVersion: " + RULE_VERSION,
    "",
    "规则：",
    loadRulesText(),
    "",
    template,
    "",
    buildSafetyAppendix(),
    "",
    "输入：",
    JSON.stringify(inputJson, null, 2),
  ].join("\n");

  return {
    systemPrompt:
      "你是 Alibaba LabelX ASR 快判比较助手。只输出 JSON，不要输出 JSON 以外文本。",
    userPrompt,
    ruleVersion: RULE_VERSION,
  };
}

module.exports = {
  AI_RESOURCE_DIR,
  RULES_PATH,
  LISTEN_TEMPLATE_PATH,
  COMPARE_TEMPLATE_PATH,
  RULE_VERSION,
  buildListenPrompt,
  buildComparePrompt,
  loadListenTemplateText,
  loadCompareTemplateText,
  loadRulesText,
};

