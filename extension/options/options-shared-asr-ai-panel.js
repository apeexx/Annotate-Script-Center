"use strict";

(function initOptionsSharedAsrAiPanel(globalObject) {
  const DATA_BAKER_SCRIPT_ID = "dataBakerRoundOneQuality";
  const DATA_BAKER_CVPC_SCRIPT_ID = "dataBakerCvpcLiuzhouAssistant";
  const AISHELL_SCRIPT_ID = "aishellTechMinnanAssistant";
  const MAGIC_DATA_ANNOTATOR_SCRIPT_ID = "magicDataAnnotatorAiReview";
  const MAGIC_DATA_MINNAN_SCRIPT_ID = "magicDataMinnanAssistant";
  const MAGIC_DATA_HANGZHOU_SCRIPT_ID = "magicDataHangzhouAssistant";

  function isMagicDataScript(scriptId) {
    return (
      scriptId === MAGIC_DATA_ANNOTATOR_SCRIPT_ID ||
      scriptId === MAGIC_DATA_MINNAN_SCRIPT_ID ||
      scriptId === MAGIC_DATA_HANGZHOU_SCRIPT_ID
    );
  }

  function buildSharedAsrAiPanelSpec(scriptId) {
    if (scriptId === DATA_BAKER_SCRIPT_ID) {
      return {
        scriptId,
        prefix: "data-baker-ai",
        showPipelineMode: true,
        showRecognitionStrategy: false,
        showAutofillConcurrency: true,
        enableFieldLabel: "启用 AI 推荐文本",
        enableFieldHelp: "关闭后不显示 AI 推荐工具卡",
        modelLabel: "比较模型",
        concurrencyInputId: "data-baker-qualified-autofill-concurrency",
        concurrencyHelpId: "data-baker-qualified-autofill-concurrency-help",
        modelFieldOrder: [
          "enabled",
          "pipelineMode",
          "listenModel",
          "listenModelNote",
          "singleModel",
          "compareModel",
          "autofillConcurrency",
          "timeout",
          "thinking",
        ],
      };
    }

    if (scriptId === AISHELL_SCRIPT_ID) {
      return {
        scriptId,
        prefix: "aishell-tech-ai",
        useStandaloneLayout: true,
        showPipelineMode: false,
        showRecognitionStrategy: false,
        showAutofillConcurrency: true,
        enableFieldLabel: "启用 AI 推荐文本",
        enableFieldHelp: "关闭后不显示当前条推荐与批量保存面板",
        modelLabel: "比较模型",
        concurrencyInputId: "aishell-tech-qualified-autofill-concurrency",
        concurrencyHelpId: "aishell-tech-qualified-autofill-concurrency-help",
        modelFieldOrder: [
          "enabled",
          "autofillConcurrency",
          "timeout",
          "thinking",
        ],
      };
    }

    if (scriptId === DATA_BAKER_CVPC_SCRIPT_ID) {
      return {
        scriptId,
        prefix: "data-baker-cvpc-ai",
        useStandaloneLayout: true,
        showPipelineMode: false,
        showRecognitionStrategy: false,
        showAutofillConcurrency: false,
        enableFieldLabel: "启用 AI 推荐文本",
        enableFieldHelp: "关闭后不显示当前段 AI 推荐结果",
        modelLabel: "文本修正模型",
        concurrencyInputId: "",
        concurrencyHelpId: "",
        modelFieldOrder: [
          "enabled",
          "timeout",
          "thinking",
        ],
      };
    }

    if (isMagicDataScript(scriptId)) {
      return {
        scriptId,
        prefix: "magic-data-ai",
        showPipelineMode: true,
        showRecognitionStrategy: true,
        showAutofillConcurrency: false,
        enableFieldLabel: "启用 AI 质检助手",
        enableFieldHelp: "关闭后不显示 AI 质检建议",
        modelLabel: "比较模型",
        concurrencyInputId: "",
        concurrencyHelpId: "",
        modelFieldOrder: [
          "enabled",
          "pipelineMode",
          "recognitionStrategy",
          "listenModel",
          "listenModelNote",
          "singleModel",
          "compareModel",
          "timeout",
          "thinking",
          "showHeardText",
          "showEstimatedIncome",
        ],
      };
    }

    return {
      scriptId: String(scriptId || ""),
      prefix: "",
      showPipelineMode: false,
      showRecognitionStrategy: false,
      showAutofillConcurrency: false,
      enableFieldLabel: "",
      enableFieldHelp: "",
      modelLabel: "比较模型",
      concurrencyInputId: "",
      concurrencyHelpId: "",
      modelFieldOrder: [],
    };
  }

  function renderSharedAsrAutofillConcurrencyField(scriptId) {
    const spec = buildSharedAsrAiPanelSpec(scriptId);
    if (!spec.showAutofillConcurrency || !spec.concurrencyInputId) {
      return "";
    }

    return [
      '<label class="asr-ai-field">',
      "<span>AI 连续填入并发数量</span>",
      '<input id="' + spec.concurrencyInputId + '" type="number" min="1" max="50" step="1" />',
      '<span class="asr-ai-help" id="' + spec.concurrencyHelpId + '"></span>',
      "</label>",
    ].join("");
  }

  function buildSharedAsrAutofillConcurrencyHelp(scriptId, rule) {
    const spec = buildSharedAsrAiPanelSpec(scriptId);
    const currentRule = rule && typeof rule === "object" ? rule : {};
    const modelLabel = currentRule.modelType === "fun_asr" ? "Fun-ASR" : "Omni";
    const defaultValue = Number.isFinite(Number(currentRule.defaultValue))
      ? Math.round(Number(currentRule.defaultValue))
      : 5;
    const min = Number.isFinite(Number(currentRule.min)) ? Math.round(Number(currentRule.min)) : 1;
    const max = Number.isFinite(Number(currentRule.max)) ? Math.round(Number(currentRule.max)) : 25;

    if (spec.scriptId === DATA_BAKER_SCRIPT_ID) {
      return (
        "当前为 " +
        modelLabel +
        " 并发规则：默认 " +
        String(defaultValue) +
        "，范围 " +
        String(min) +
        "~" +
        String(max) +
        "。前端并发表示同时发起到统一后端的 AI 推荐请求数量；后端上游仍按各 provider 自身策略处理。"
      );
    }

    if (spec.scriptId === AISHELL_SCRIPT_ID) {
      return (
        "当前为 " +
        modelLabel +
        " 并发规则：默认 " +
        String(defaultValue) +
        "，范围 " +
        String(min) +
        "~" +
        String(max) +
        "。AI 请求可并发预取，但页面填入与保存仍按当前分包逐条串行执行。"
      );
    }

    return (
      modelLabel +
      " 默认 " +
      String(defaultValue) +
      "，范围 " +
      String(min) +
      "~" +
      String(max)
    );
  }

  const api = {
    buildSharedAsrAiPanelSpec,
    buildSharedAsrAutofillConcurrencyHelp,
    renderSharedAsrAutofillConcurrencyField,
  };

  globalObject.ASREdgeOptionsSharedAsrAiPanel = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
