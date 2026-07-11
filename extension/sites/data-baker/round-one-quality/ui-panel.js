(function () {
  const ROOT_ATTR = "data-asr-edge-databaker-ai-panel";
  const STYLE_ID = "asr-edge-databaker-ai-panel-style";
  const TOP_BUTTON_ATTR = "data-asr-edge-databaker-qualified-autofill-button";
  const lexiconDisplay =
    globalThis.ASREdgeLexiconDisplay ||
    (typeof module !== "undefined" && module.exports
      ? require("../../../shared/lexicon-display.js")
      : {});
  const aiCostDisplay =
    globalThis.ASREdgeAiCostDisplay ||
    (typeof module !== "undefined" && module.exports
      ? require("../../../shared/ai-cost-display.js")
      : {});
  const aiBatchSummary =
    globalThis.ASREdgeAiBatchSummary ||
    (typeof module !== "undefined" && module.exports
      ? require("../../../shared/ai-batch-summary.js")
      : {});
  const formatLexiconStatusAndMode =
    typeof lexiconDisplay.formatLexiconStatusAndMode === "function"
      ? lexiconDisplay.formatLexiconStatusAndMode
      : function () {
          return "";
        };
  const buildCostRows =
    typeof aiCostDisplay.buildCostRows === "function"
      ? aiCostDisplay.buildCostRows
      : function () {
          return [];
        };
  const buildBatchSummaryRows =
    typeof aiBatchSummary.buildBatchSummaryRows === "function"
      ? aiBatchSummary.buildBatchSummaryRows
      : function () {
          return [];
        };
  let mountedLogPrinted = false;
  let fallbackLogPrinted = false;
  let panelMountedLogPrinted = false;
  let mountTargetDebugPrinted = false;

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function ensureChineseSentencePunctuation(text) {
    const value = String(text || "").trim();
    if (!value) {
      return "";
    }
    const last = value[value.length - 1];
    if ("。！？；…".indexOf(last) >= 0) {
      return value;
    }
    if (last === ".") {
      return value.slice(0, -1) + "。";
    }
    if (last === "?") {
      return value.slice(0, -1) + "？";
    }
    if (last === "!") {
      return value.slice(0, -1) + "！";
    }
    if (last === ";") {
      return value.slice(0, -1) + "；";
    }
    return value + "。";
  }

  function removeTextSpaces(text) {
    return String(text || "").replace(/[\s\u3000]+/g, "");
  }

  function buildResultRows(data) {
    const source = data && typeof data === "object" ? data : {};
    const model = source.model && typeof source.model === "object" ? source.model : {};
    const lexicon = source.lexicon && typeof source.lexicon === "object" ? source.lexicon : {};
    const timing = source.timing && typeof source.timing === "object" ? source.timing : null;
    const cost = source.cost && typeof source.cost === "object" ? source.cost : {};
    const rewriteChanges = Array.isArray(lexicon.rewriteChanges) ? lexicon.rewriteChanges : [];
    const rows = [
      ["页面候选文本", source.pageText || ""],
      ["AI 听音文本", source.heardText || ""],
      ["AI 推荐文本", source.recommendedText || ""],
      ["相对页面变更", source.isChanged ? "是" : "否"],
      [
        "置信度",
        "听音 " +
          (Number(source.listenConfidence || 0) * 100).toFixed(1) +
          "% / 对比 " +
          (Number(source.compareConfidence || 0) * 100).toFixed(1) +
          "%",
      ],
      [
        "模型",
        source.pipelineMode === "omni_single" || !String(model.compare || "").trim()
          ? String(model.listen || "qwen3.5-omni-flash")
          : String(model.listen || "fun-asr") + " + " + String(model.compare || "qwen3.5-plus"),
      ],
    ];
    if (source.pipelineMode === "fun_asr_compare") {
      rows.push(["模式", "Fun-ASR + 比较模型"]);
    } else if (source.pipelineMode === "omni_single") {
      rows.push(["模式", "Omni 单模型"]);
    }
    if (timing) {
      rows.push([
        "耗时",
        "听音 " +
          formatDurationSeconds(timing.listenDurationMs) +
          " / 对比 " +
          formatDurationSeconds(timing.compareDurationMs) +
          " / 总计 " +
          formatDurationSeconds(timing.totalDurationMs),
      ]);
    }
    rows.push.apply(
      rows,
      source.pipelineMode === "omni_single"
        ? buildCostRows({
            cost: cost,
            stageDefinitions: [
              {
                key: "single",
                label: "预估人民币",
                fallbackToTotal: true,
              },
            ],
          })
        : buildCostRows({
            cost: cost,
            stageDefinitions: [
              {
                key: "listen",
                label: "听音预估人民币",
              },
              {
                key: "compare",
                label: "对比预估人民币",
              },
            ],
            totalLabel: "总预估人民币",
          })
    );
    rows.push(["决策", source.decision || ""]);
    if (source.runtime && typeof source.runtime === "object") {
      const runtime = source.runtime;
      const queue = runtime.queue && typeof runtime.queue === "object" ? runtime.queue : {};
      const cache = runtime.cache && typeof runtime.cache === "object" ? runtime.cache : {};
      rows.push([
        "运行时",
        (cache.hit === true ? "命中缓存" : "实时分析") +
          " / 排队等待 " +
          formatDurationSeconds(queue.totalQueueWaitMs || 0) +
          " / 重试 " +
          String(Number(queue.totalRetryCount) || 0) +
          " 次",
      ]);
    }
    const lexiconSummary = formatLexiconStatusAndMode(lexicon, {
      scriptType: "default",
    });
    if (lexiconSummary) {
      rows.push(["词表状态与模式", lexiconSummary]);
    }
    if (lexicon.rewriteChanged === true) {
      rows.push(["词表替换", "已替换 " + String(rewriteChanges.length || 0) + " 处"]);
    }
    rows.push(["requestId", source.requestId || ""]);
    return rows;
  }

  function phaseToText(phase) {
    const text = String(phase || "").toLowerCase();
    if (text === "fetching") {
      return "获取列表";
    }
    if (text === "analysis") {
      return "AI排队/并发分析";
    }
    if (text === "fill") {
      return "填入中";
    }
    if (text === "retry") {
      return "重试填入";
    }
    if (text === "stopped") {
      return "已停止";
    }
    if (text === "completed") {
      return "已完成";
    }
    return "空闲";
  }

  function formatElapsedMs(value) {
    const totalMs = Number(value);
    if (!Number.isFinite(totalMs) || totalMs < 0) {
      return "-";
    }
    const totalSeconds = Math.floor(totalMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return (
        String(hours) +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
      );
    }
    return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }

  function buildBatchFloatingRows(state) {
    const source = state && typeof state === "object" ? state : {};
    const duplicateSkippedCount = Number(source.duplicateSkippedCount) || 0;
    return [
      { label: "阶段", value: phaseToText(String(source.phase || "idle")) },
      { label: "批次ID", value: String(source.batchRunId || "").trim().slice(-8) || "-" },
      { label: "执行耗时", value: formatElapsedMs(source.elapsedMs) },
      { label: "当前AI链路", value: String(source.aiPipelineDisplayName || "-") },
      { label: "当前AI模型", value: String(source.aiModelDisplayName || "-") },
      { label: "并发规则", value: String(source.concurrencyRuleText || "按当前配置归一") },
      { label: "前端并发", value: Number(source.frontConcurrency) || 0 },
      { label: "发送间隔(ms)", value: Number(source.requestStaggerMs) || 0 },
      { label: "总合格数", value: Number(source.totalCount) || 0 },
      { label: "唯一任务数", value: Number(source.uniqueTaskCount) || 0 },
      { label: "重复跳过", value: duplicateSkippedCount },
      { label: "已发起AI请求", value: Number(source.launchedCount) || 0 },
      { label: "前端活跃AI请求", value: Number(source.activeAiCount) || 0 },
      { label: "AI已返回", value: Number(source.completedAiCount) || 0 },
      { label: "AI成功", value: Number(source.analysisSuccessCount) || 0 },
      { label: "AI失败", value: Number(source.analysisFailCount) || 0 },
      { label: "待填队列", value: Number(source.queueCount) || 0 },
      { label: "正在填入序号", value: Number(source.fillStartedCount) || 0 },
      { label: "填入成功", value: Number(source.fillSuccessCount) || 0 },
      { label: "填入失败", value: Number(source.fillFailCount) || 0 },
      { label: "跳过", value: Number(source.fillSkipCount) || 0 },
    ].concat(
      buildBatchSummaryRows(source).map(function (item) {
        return {
          label: item[0],
          value: item[1],
        };
      })
    );
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "[" + ROOT_ATTR + "] {",
      "  box-sizing: border-box;",
      "  margin: 12px 20px;",
      "  padding: 10px 12px;",
      "  border: 1px solid #bfdbfe;",
      "  border-radius: 6px;",
      "  background: #f8fbff;",
      "  color: #1f2937;",
      "  font-size: 12px;",
      "  line-height: 1.55;",
      "}",
      "[" + ROOT_ATTR + "] * { box-sizing: border-box; }",
      "[" + ROOT_ATTR + "] .asr-edge-db-head {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: space-between;",
      "  gap: 8px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-title {",
      "  color: #1d4ed8;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-actions,",
      "[" + ROOT_ATTR + "] .asr-edge-db-result-actions {",
      "  display: flex;",
      "  align-items: center;",
      "  flex-wrap: wrap;",
      "  gap: 8px;",
      "}",
      "[" + ROOT_ATTR + "] button {",
      "  min-height: 26px;",
      "  padding: 0 10px;",
      "  border: 1px solid #cbd5e1;",
      "  border-radius: 6px;",
      "  background: #ffffff;",
      "  color: #1f2937;",
      "  cursor: pointer;",
      "  font-size: 12px;",
      "}",
      "[" + ROOT_ATTR + "] button[data-primary='true'] {",
      "  border-color: #1d4ed8;",
      "  background: #1d4ed8;",
      "  color: #ffffff;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] button:disabled {",
      "  cursor: not-allowed;",
      "  opacity: 0.6;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-status {",
      "  margin-top: 8px;",
      "  color: #64748b;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-status[data-tone='error'] { color: #b91c1c; }",
      "[" + ROOT_ATTR + "] .asr-edge-db-status[data-tone='success'] { color: #047857; }",
      "[" + ROOT_ATTR + "] .asr-edge-db-result {",
      "  margin-top: 10px;",
      "  border-top: 1px solid #dbeafe;",
      "  padding-top: 8px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-grid {",
      "  display: grid;",
      "  grid-template-columns: 112px minmax(0, 1fr);",
      "  gap: 5px 8px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-label {",
      "  color: #475569;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-value {",
      "  min-width: 0;",
      "  white-space: pre-wrap;",
      "  overflow-wrap: anywhere;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-review {",
      "  margin: 8px 0;",
      "  color: #b45309;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-lexicon-list {",
      "  margin: 6px 0 8px 120px;",
      "  color: #0f766e;",
      "  overflow-wrap: anywhere;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-db-foot {",
      "  margin-top: 8px;",
      "  color: #64748b;",
      "}",
      ".asr-edge-db-batch-floating {",
      "  position: fixed;",
      "  top: 14px;",
      "  right: 14px;",
      "  width: 380px;",
      "  max-width: calc(100vw - 28px);",
      "  max-height: calc(100vh - 28px);",
      "  overflow: auto;",
      "  padding: 10px 12px;",
      "  border: 1px solid #a7f3d0;",
      "  border-radius: 8px;",
      "  background: #f0fdf4;",
      "  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);",
      "  z-index: 2147483000;",
      "  font-size: 12px;",
      "  line-height: 1.5;",
      "  color: #064e3b;",
      "}",
      ".asr-edge-db-batch-floating[data-phase='stopped'],",
      ".asr-edge-db-batch-floating[data-phase='error'] {",
      "  border-color: #fecaca;",
      "  background: #fef2f2;",
      "  color: #7f1d1d;",
      "}",
      ".asr-edge-db-batch-floating-head {",
      "  display: flex;",
      "  justify-content: space-between;",
      "  align-items: center;",
      "  gap: 8px;",
      "  margin-bottom: 8px;",
      "}",
      ".asr-edge-db-batch-floating-title {",
      "  font-weight: 700;",
      "  font-size: 13px;",
      "}",
      ".asr-edge-db-batch-floating-head-actions {",
      "  display: flex;",
      "  gap: 6px;",
      "}",
      ".asr-edge-db-batch-floating-head-actions button {",
      "  min-height: 24px;",
      "  padding: 0 8px;",
      "  border-radius: 4px;",
      "  font-size: 12px;",
      "}",
      ".asr-edge-db-batch-floating-grid {",
      "  display: grid;",
      "  grid-template-columns: 132px minmax(0, 1fr);",
      "  gap: 4px 6px;",
      "}",
      ".asr-edge-db-batch-floating-label {",
      "  color: #065f46;",
      "  font-weight: 700;",
      "}",
      ".asr-edge-db-batch-floating[data-phase='stopped'] .asr-edge-db-batch-floating-label,",
      ".asr-edge-db-batch-floating[data-phase='error'] .asr-edge-db-batch-floating-label {",
      "  color: #991b1b;",
      "}",
      ".asr-edge-db-batch-floating-current {",
      "  margin-top: 8px;",
      "  font-weight: 700;",
      "}",
      ".asr-edge-db-batch-floating-failures {",
      "  margin-top: 8px;",
      "  border-top: 1px dashed rgba(15, 23, 42, 0.2);",
      "  padding-top: 8px;",
      "}",
      ".asr-edge-db-batch-floating-failures ul {",
      "  margin: 4px 0 0 16px;",
      "  padding: 0;",
      "}",
      ".asr-edge-db-batch-floating-failures li {",
      "  margin: 0 0 6px;",
      "}",
      ".asr-edge-db-batch-failure-item {",
      "  display: flex;",
      "  flex-wrap: wrap;",
      "  gap: 6px;",
      "  align-items: center;",
      "}",
      ".asr-edge-db-batch-failure-text {",
      "  min-width: 0;",
      "  flex: 1 1 220px;",
      "  overflow-wrap: anywhere;",
      "}",
      ".asr-edge-db-batch-failure-debug {",
      "  color: #b91c1c;",
      "  border-color: #ef4444;",
      "}",
      ".asr-edge-db-debug-modal {",
      "  position: fixed;",
      "  inset: 0;",
      "  z-index: 2147483600;",
      "  background: rgba(15, 23, 42, 0.45);",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  padding: 16px;",
      "}",
      ".asr-edge-db-debug-modal-card {",
      "  width: min(820px, 100%);",
      "  max-height: min(80vh, 900px);",
      "  display: flex;",
      "  flex-direction: column;",
      "  gap: 10px;",
      "  background: #fff;",
      "  border-radius: 8px;",
      "  padding: 12px;",
      "  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.24);",
      "}",
      ".asr-edge-db-debug-modal-head {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: space-between;",
      "  gap: 12px;",
      "}",
      ".asr-edge-db-debug-modal-title {",
      "  color: #0f172a;",
      "  font-size: 14px;",
      "  font-weight: 700;",
      "}",
      ".asr-edge-db-debug-modal-actions {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: flex-end;",
      "  gap: 8px;",
      "  flex-wrap: wrap;",
      "}",
      ".asr-edge-db-debug-modal textarea {",
      "  width: 100%;",
      "  min-height: 360px;",
      "  max-height: calc(80vh - 120px);",
      "  resize: vertical;",
      "  padding: 10px 12px;",
      "  border: 1px solid #cbd5e1;",
      "  border-radius: 6px;",
      "  background: #f8fafc;",
      "  color: #0f172a;",
      "  font-family: Consolas, 'Courier New', monospace;",
      "  font-size: 12px;",
      "  line-height: 1.55;",
      "  white-space: pre;",
      "  overflow: auto;",
      "}",
      ".asr-edge-db-batch-floating-foot-actions {",
      "  margin-top: 8px;",
      "  display: flex;",
      "  gap: 8px;",
      "  flex-wrap: wrap;",
      "}",
      "." + "asr-edge-db-qualified-autofill-filter {",
      "  min-height: 26px;",
      "  padding: 0 10px;",
      "  margin-left: 10px;",
      "  height: 28px;",
      "  border-radius: 4px;",
      "  font-size: 12px;",
      "  font-weight: 600;",
      "  cursor: pointer;",
      "  white-space: nowrap;",
      "}",
      "." + "asr-edge-db-qualified-autofill-filter:disabled {",
      "  opacity: 0.6;",
      "  cursor: not-allowed;",
      "}",
    ].join("\n");
    (document.head || document.documentElement).appendChild(style);
  }

  function createButton(text, attrs) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    Object.keys(attrs || {}).forEach(function (key) {
      button.setAttribute(key, attrs[key]);
    });
    return button;
  }

  function createRuntime(options) {
    const deps = options && typeof options === "object" ? options : {};
    let root = null;
    let resultNode = null;
    let statusNode = null;
    let recommendButtonNode = null;
    let autoFillQualifiedButtonNode = null;
    let currentResult = null;
    let currentItemKey = "";
    let batchAutofillRunning = false;
    let batchAutofillStopping = false;
    let batchAutofillPhase = "idle";
    let batchFloatingRoot = null;
    let batchFloatingGrid = null;
    let batchFloatingCurrentNode = null;
    let batchFloatingFailuresNode = null;
    let batchFloatingRetryButton = null;
    let panelFallbackQualifiedButtonNode = null;
    let batchFloatingCloseTimer = null;
    let batchFloatingSuppressUntil = 0;
    let batchFailureRetryHandler =
      typeof deps.onRetryFailedQualifiedFillItems === "function"
        ? deps.onRetryFailedQualifiedFillItems
        : null;
    let loadFailureDebugJsonHandler =
      typeof deps.onLoadFailureDebugJson === "function" ? deps.onLoadFailureDebugJson : null;
    let debugModalNode = null;

    function isVisibleNode(node) {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      if (!node.isConnected || !document.documentElement.contains(node)) {
        return false;
      }
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      return node.getClientRects().length > 0;
    }

    function findVisibleNode(selector) {
      return Array.from(document.querySelectorAll(selector)).find(isVisibleNode) || null;
    }

    function findVisibleNodeByText(selector, keyword) {
      return Array.from(document.querySelectorAll(selector)).find(function (node) {
        return isVisibleNode(node) && normalizeText(node.textContent || "").indexOf(keyword) >= 0;
      }) || null;
    }

    function findMountTargetFromSentenceText() {
      const labeledTextBox = findVisibleNodeByText(".waver-page .text-box", "本句话文本");
      if (labeledTextBox) {
        return labeledTextBox;
      }

      const textarea = findVisibleNode(".waver-page .text-box textarea, .waver-page textarea");
      const textareaContainer = textarea?.closest(".text-box, .el-form-item, .el-textarea");
      if (textareaContainer instanceof HTMLElement && isVisibleNode(textareaContainer)) {
        return textareaContainer;
      }
      if (textarea instanceof HTMLElement && isVisibleNode(textarea)) {
        return textarea;
      }

      return findVisibleNodeByText(
        ".waver-page .text-box, .waver-page .el-form-item, .waver-page [class*='text']",
        "本句话文本"
      );
    }

    function findMountTarget() {
      const sentenceTextTarget = findMountTargetFromSentenceText();
      if (sentenceTextTarget) {
        return sentenceTextTarget;
      }

      const iframeBox = findVisibleNode(".waver-page #iframeBox, .waver-page iframe#myIframe");
      const rightContent = iframeBox?.closest(".right, .waver-page");
      if (rightContent instanceof HTMLElement && isVisibleNode(rightContent)) {
        return rightContent;
      }

      const selectors = [
        ".waver-page .el-textarea",
        ".waver-page",
        ".right",
        ".app-main .waver-page",
        ".main-container .waver-page",
        ".app-main .right",
        ".main-container .right",
      ];
      for (const selector of selectors) {
        const node = findVisibleNode(selector);
        if (node) {
          return node;
        }
      }
      return null;
    }

    function findFilterScreenMountTarget() {
      const filterNodes = Array.from(document.querySelectorAll(".filter-screen")).filter(isVisibleNode);
      return filterNodes.find(function (node) {
        const text = normalizeText(node.textContent || "");
        if (text.indexOf("全选") < 0) {
          return false;
        }
        const buttons = Array.from(node.querySelectorAll("button"));
        return buttons.some(function (button) {
          return normalizeText(button.textContent || "").indexOf("批量判定") >= 0;
        });
      }) || null;
    }

    function setStatus(message, tone) {
      if (!statusNode) {
        return;
      }
      statusNode.textContent = String(message || "");
      statusNode.setAttribute("data-tone", String(tone || "info"));
    }

    function clearBatchFloatingCloseTimer() {
      if (batchFloatingCloseTimer) {
        window.clearTimeout(batchFloatingCloseTimer);
        batchFloatingCloseTimer = null;
      }
    }

    function hideBatchFloatingPanel(options) {
      const runtimeOptions = options && typeof options === "object" ? options : {};
      clearBatchFloatingCloseTimer();
      if (runtimeOptions.suppressMs) {
        batchFloatingSuppressUntil = Date.now() + Math.max(0, Number(runtimeOptions.suppressMs) || 0);
      } else if (runtimeOptions.clearSuppress === true) {
        batchFloatingSuppressUntil = 0;
      }
      if (batchFloatingRoot) {
        batchFloatingRoot.remove();
      }
      batchFloatingRoot = null;
      batchFloatingGrid = null;
      batchFloatingCurrentNode = null;
      batchFloatingFailuresNode = null;
      batchFloatingRetryButton = null;
    }

    function createFloatingRow(label, value) {
      const labelNode = document.createElement("div");
      labelNode.className = "asr-edge-db-batch-floating-label";
      labelNode.textContent = label;
      const valueNode = document.createElement("div");
      valueNode.textContent = String(value ?? "-");
      return { labelNode, valueNode };
    }

    function ensureBatchFloatingPanel() {
      if (Date.now() < batchFloatingSuppressUntil) {
        return null;
      }
      if (batchFloatingRoot && document.documentElement.contains(batchFloatingRoot)) {
        return batchFloatingRoot;
      }
      clearBatchFloatingCloseTimer();
      batchFloatingRoot = document.createElement("div");
      batchFloatingRoot.className = "asr-edge-db-batch-floating";

      const head = document.createElement("div");
      head.className = "asr-edge-db-batch-floating-head";
      const title = document.createElement("div");
      title.className = "asr-edge-db-batch-floating-title";
      title.textContent = "AI连续填入合格项";
      const headActions = document.createElement("div");
      headActions.className = "asr-edge-db-batch-floating-head-actions";

      const stopButton = createButton("停止", {});
      stopButton.addEventListener("click", function () {
        if (typeof deps.onStopAutoFillQualifiedItemsBatch === "function") {
          Promise.resolve(deps.onStopAutoFillQualifiedItemsBatch()).catch(function () {
            // Ignore; error already handled by runtime status.
          });
        }
      });
      const closeButton = createButton("关闭", {});
      closeButton.addEventListener("click", function () {
        hideBatchFloatingPanel({ suppressMs: 5000 });
      });
      headActions.appendChild(stopButton);
      headActions.appendChild(closeButton);
      head.appendChild(title);
      head.appendChild(headActions);

      batchFloatingGrid = document.createElement("div");
      batchFloatingGrid.className = "asr-edge-db-batch-floating-grid";

      batchFloatingCurrentNode = document.createElement("div");
      batchFloatingCurrentNode.className = "asr-edge-db-batch-floating-current";

      batchFloatingFailuresNode = document.createElement("div");
      batchFloatingFailuresNode.className = "asr-edge-db-batch-floating-failures";

      const footActions = document.createElement("div");
      footActions.className = "asr-edge-db-batch-floating-foot-actions";
      batchFloatingRetryButton = createButton("重新填写失败内容", {});
      batchFloatingRetryButton.style.display = "none";
      batchFloatingRetryButton.addEventListener("click", function () {
        if (typeof batchFailureRetryHandler !== "function") {
          setStatus("重试处理器未就绪。", "error");
          return;
        }
        Promise.resolve(batchFailureRetryHandler()).catch(function (error) {
          setStatus(error?.message || String(error), "error");
        });
      });
      footActions.appendChild(batchFloatingRetryButton);

      batchFloatingRoot.appendChild(head);
      batchFloatingRoot.appendChild(batchFloatingGrid);
      batchFloatingRoot.appendChild(batchFloatingCurrentNode);
      batchFloatingRoot.appendChild(batchFloatingFailuresNode);
      batchFloatingRoot.appendChild(footActions);

      (document.body || document.documentElement).appendChild(batchFloatingRoot);
      return batchFloatingRoot;
    }

    function showBatchFloatingPanel() {
      ensureBatchFloatingPanel();
    }

    function renderBatchFailures(failures) {
      if (!batchFloatingFailuresNode) {
        return;
      }
      const list = Array.isArray(failures) ? failures : [];
      if (list.length <= 0) {
        batchFloatingFailuresNode.textContent = "失败列表：无";
        if (batchFloatingRetryButton) {
          batchFloatingRetryButton.style.display = "none";
          batchFloatingRetryButton.disabled = true;
        }
        return;
      }
      batchFloatingFailuresNode.textContent = "";
      const title = document.createElement("div");
      title.textContent = "失败列表（最多显示 10 条）：";
      batchFloatingFailuresNode.appendChild(title);
      const ul = document.createElement("ul");
      list.slice(0, 10).forEach(function (failure) {
        const li = document.createElement("li");
        const wrap = document.createElement("div");
        wrap.className = "asr-edge-db-batch-failure-item";
        const text = document.createElement("div");
        text.className = "asr-edge-db-batch-failure-text";
        const displayName = String(failure?.displayName || "未命名条目");
        const type = String(failure?.type || "unknown");
        const message = String(failure?.errorMessage || "");
        text.textContent = displayName + " | " + type + (message ? " | " + message : "");
        wrap.appendChild(text);
        if (
          (failure?.hasRawAiDebug === true || String(failure?.debugId || "").trim() || failure?.hasDebugRawJson === true) &&
          typeof loadFailureDebugJsonHandler === "function"
        ) {
          const debugButton = createButton("查看原始AI返回", {});
          debugButton.className = "asr-edge-db-batch-failure-debug";
          debugButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            showFailureDebugJson(failure).catch(function (error) {
              setStatus(error?.message || String(error), "error");
            });
          });
          wrap.appendChild(debugButton);
        }
        li.appendChild(wrap);
        ul.appendChild(li);
      });
      batchFloatingFailuresNode.appendChild(ul);
      if (list.length > 10) {
        const more = document.createElement("div");
        more.textContent = "还有 " + String(list.length - 10) + " 条失败未展示。";
        batchFloatingFailuresNode.appendChild(more);
      }
      const retryableCount = list.filter(function (item) {
        return item?.type === "fill_failed" && item?.retryable === true && item?.result?.recommendation;
      }).length;
      if (batchFloatingRetryButton) {
        batchFloatingRetryButton.style.display = retryableCount > 0 ? "" : "none";
        batchFloatingRetryButton.disabled = retryableCount <= 0 || batchAutofillRunning;
      }
    }

    function updateBatchFloatingProgress(progress) {
      const panel = ensureBatchFloatingPanel();
      if (!panel || !batchFloatingGrid || !batchFloatingCurrentNode) {
        return;
      }
      clearBatchFloatingCloseTimer();
      const state = progress && typeof progress === "object" ? progress : {};
      const phase = String(state.phase || "idle");
      panel.setAttribute("data-phase", phase);
      const duplicateSkippedCount = Number(state.duplicateSkippedCount) || 0;
      const rows = buildBatchFloatingRows(state).map(function (item) {
        return createFloatingRow(item.label, item.value);
      });
      batchFloatingGrid.textContent = "";
      rows.forEach(function (row) {
        batchFloatingGrid.appendChild(row.labelNode);
        batchFloatingGrid.appendChild(row.valueNode);
      });
      const duplicateHint = duplicateSkippedCount > 0 ? " | 已跳过重复任务 " + String(duplicateSkippedCount) + " 条。" : "";
      batchFloatingCurrentNode.textContent =
        "当前处理：" + String(state.currentDisplayName || "-") + duplicateHint;

      renderBatchFailures(state.failures);
      if (batchFloatingRetryButton && batchAutofillRunning) {
        batchFloatingRetryButton.disabled = true;
      }
    }

    function finishBatchFloatingProgress(summary) {
      updateBatchFloatingProgress(summary);
      const state = summary && typeof summary === "object" ? summary : {};
      const phase = String(state.phase || "completed");
      if (batchFloatingRoot) {
        batchFloatingRoot.setAttribute("data-phase", phase);
      }
      const autoHideMs = Math.max(0, Number(state.autoHideMs) || 0);
      if (autoHideMs > 0) {
        clearBatchFloatingCloseTimer();
        batchFloatingCloseTimer = window.setTimeout(function () {
          hideBatchFloatingPanel({ clearSuppress: true });
        }, autoHideMs);
      }
    }

    function clearResult() {
      currentResult = null;
      if (resultNode) {
        resultNode.remove();
        resultNode = null;
      }
    }

    function createRow(grid, label, value) {
      const labelNode = document.createElement("div");
      labelNode.className = "asr-edge-db-label";
      labelNode.textContent = label;
      const valueNode = document.createElement("div");
      valueNode.className = "asr-edge-db-value";
      valueNode.textContent = String(value === undefined || value === null || value === "" ? "-" : value);
      grid.appendChild(labelNode);
      grid.appendChild(valueNode);
    }

    function formatDurationSeconds(value) {
      const ms = Number(value);
      if (!Number.isFinite(ms) || ms < 0) {
        return "-";
      }
      return (ms / 1000).toFixed(1) + " 秒";
    }

    async function copyText(text) {
      const value = String(text || "");
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }

      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) {
        throw new Error("clipboard-unavailable");
      }
      return true;
    }

    function hideDebugModal() {
      if (debugModalNode) {
        debugModalNode.remove();
        debugModalNode = null;
      }
    }

    function showDebugModal(text) {
      hideDebugModal();
      const modal = document.createElement("div");
      modal.className = "asr-edge-db-debug-modal";
      const card = document.createElement("div");
      card.className = "asr-edge-db-debug-modal-card";
      const head = document.createElement("div");
      head.className = "asr-edge-db-debug-modal-head";
      const title = document.createElement("div");
      title.className = "asr-edge-db-debug-modal-title";
      title.textContent = "原始 AI 返回";
      const textarea = document.createElement("textarea");
      textarea.value = String(text || "");
      textarea.readOnly = true;
      const actions = document.createElement("div");
      actions.className = "asr-edge-db-debug-modal-actions";
      const copyButton = createButton("复制", { "data-primary": "true" });
      const closeButton = createButton("关闭", {});
      copyButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        copyText(String(textarea.value || ""))
          .then(function () {
            setStatus("原始AI返回已复制。", "success");
          })
          .catch(function () {
            setStatus("剪贴板不可用，请手动复制原始AI返回。", "info");
            textarea.focus();
            textarea.select();
          });
      });
      closeButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        hideDebugModal();
      });
      actions.appendChild(copyButton);
      actions.appendChild(closeButton);
      head.appendChild(title);
      card.appendChild(head);
      card.appendChild(textarea);
      card.appendChild(actions);
      modal.appendChild(card);
      modal.addEventListener("click", function (event) {
        if (event.target === modal) {
          hideDebugModal();
        }
      });
      card.addEventListener("click", function (event) {
        event.stopPropagation();
      });
      (document.body || document.documentElement).appendChild(modal);
      debugModalNode = modal;
      textarea.focus();
      textarea.select();
    }

    async function showFailureDebugJson(failure) {
      if (typeof loadFailureDebugJsonHandler !== "function") {
        throw new Error("当前失败项没有可查看的原始 AI 返回。");
      }
      const debugPayload = await loadFailureDebugJsonHandler(failure);
      const debugText = JSON.stringify(debugPayload || {}, null, 2);
      showDebugModal(debugText);
    }

    function renderResult(result) {
      clearResult();
      const data = Object.assign({}, result || {});
      data.heardText = removeTextSpaces(data.heardText || "");
      data.recommendedText = ensureChineseSentencePunctuation(
        removeTextSpaces(data.recommendedText || "")
      );
      currentResult = data || null;
      const lexicon = data.lexicon && typeof data.lexicon === "object" ? data.lexicon : {};
      const rewriteChanges = Array.isArray(lexicon.rewriteChanges) ? lexicon.rewriteChanges : [];
      const resultWrap = document.createElement("div");
      resultWrap.className = "asr-edge-db-result";

      const grid = document.createElement("div");
      grid.className = "asr-edge-db-grid";
      buildResultRows(data).forEach(function (row) {
        createRow(grid, row[0], row[1]);
      });
      resultWrap.appendChild(grid);

      if (lexicon.rewriteChanged === true && rewriteChanges.length > 0) {
        const lexiconList = document.createElement("div");
        lexiconList.className = "asr-edge-db-lexicon-list";
        lexiconList.textContent = rewriteChanges
          .slice(0, 8)
          .map(function (change) {
            return String(change.from || "") + " → " + String(change.to || "");
          })
          .filter(function (text) {
            return text.trim() !== "→";
          })
          .join("；");
        resultWrap.appendChild(lexiconList);
      }

      const review = document.createElement("div");
      review.className = "asr-edge-db-review";
      review.textContent = data.needHumanReview
        ? "复核提示：请人工复听确认后再复制或填入。"
        : "复核提示：仍需人工确认，不会自动保存或提交。";
      resultWrap.appendChild(review);

      const actions = document.createElement("div");
      actions.className = "asr-edge-db-result-actions";
      const copyButton = createButton("复制推荐文本", { "data-primary": "true" });
      const fillButton = createButton("填入推荐文本");
      const ignoreButton = createButton("忽略");
      fillButton.disabled = typeof deps.canFillPageText === "function" && !deps.canFillPageText();

      copyButton.addEventListener("click", function () {
        copyText(removeTextSpaces(data.recommendedText || ""))
          .then(function () {
            setStatus("推荐文本已复制。", "success");
          })
          .catch(function (error) {
            setStatus("复制失败：" + (error?.message || String(error)), "error");
          });
      });
      fillButton.addEventListener("click", function () {
        if (typeof deps.fillPageText !== "function") {
          setStatus("无法安全定位可编辑文本框，已保留复制入口。", "error");
          return;
        }
        const fillResult = deps.fillPageText(removeTextSpaces(data.recommendedText || ""));
        setStatus(fillResult?.message || "已填入推荐文本。", fillResult?.ok === false ? "error" : "success");
      });
      ignoreButton.addEventListener("click", function () {
        clearResult();
        setStatus("已忽略本次推荐。", "info");
      });

      actions.appendChild(copyButton);
      actions.appendChild(fillButton);
      actions.appendChild(ignoreButton);
      resultWrap.appendChild(actions);

      const foot = document.createElement("div");
      foot.className = "asr-edge-db-foot";
      foot.textContent =
        "当前仅处理当前页质检合格数据；可连续处理与手动停止，不会自动保存、提交或流转。";
      resultWrap.appendChild(foot);

      root.appendChild(resultWrap);
      resultNode = resultWrap;
    }

    async function handleRecommendClick(button) {
      if (typeof deps.onRecommend !== "function") {
        setStatus("AI 推荐运行时未就绪。", "error");
        return;
      }

      const triggerButton = button || recommendButtonNode;
      if (triggerButton) {
        triggerButton.disabled = true;
      }
      setStatus("正在生成 AI 推荐文本，统一后端可能正在 AI 排队或限流重试...", "info");
      clearResult();
      try {
        const payload = await deps.onRecommend();
        renderResult(payload);
        setStatus("AI 推荐文本已生成，请人工复核。", "success");
      } catch (error) {
        setStatus(error?.message || String(error), "error");
      } finally {
        if (triggerButton) {
          triggerButton.disabled = false;
        }
      }
    }

    function updateQualifiedAutofillButtonState() {
      [autoFillQualifiedButtonNode, panelFallbackQualifiedButtonNode].forEach(function (button) {
        if (!button) {
          return;
        }
        if (batchAutofillRunning) {
          if (batchAutofillStopping === true) {
            button.textContent = "停止中...";
            button.disabled = true;
            return;
          }
          button.textContent =
            batchAutofillPhase === "analysis" ? "停止AI分析" : "停止AI填入";
          button.disabled = false;
          return;
        }
        button.textContent = "AI连续填入合格项";
        button.disabled = false;
      });
    }

    async function handleAutoFillQualifiedClick() {
      const startFn =
        typeof deps.onAutoFillQualifiedItemsBatch === "function"
          ? deps.onAutoFillQualifiedItemsBatch
          : typeof deps.onAutoFillQualifiedItem === "function"
            ? deps.onAutoFillQualifiedItem
            : null;
      const stopFn =
        typeof deps.onStopAutoFillQualifiedItemsBatch === "function"
          ? deps.onStopAutoFillQualifiedItemsBatch
          : null;
      if (!startFn) {
        setStatus("AI连续填入合格项运行时未就绪。", "error");
        return;
      }

      if (batchAutofillRunning) {
        if (!stopFn) {
          setStatus("停止功能未就绪。", "error");
          return;
        }
        batchAutofillStopping = true;
        updateQualifiedAutofillButtonState();
        try {
          await stopFn();
        } catch (error) {
          setStatus(error?.message || String(error), "error");
        }
        return;
      }

      try {
        await startFn();
      } catch (error) {
        setStatus(error?.message || String(error), "error");
      }
    }

    function ensureTopQualifiedButton() {
      const existingButtons = Array.from(
        document.querySelectorAll("[" + TOP_BUTTON_ATTR + "='true']")
      );
      if (existingButtons.length > 1) {
        existingButtons.slice(1).forEach(function (button) {
          button.remove();
        });
      }
      const mountTarget = findFilterScreenMountTarget();
      const existing = existingButtons[0];
      if (existing && mountTarget && !mountTarget.contains(existing)) {
        existing.remove();
      }
      if (existing && mountTarget && mountTarget.contains(existing)) {
        autoFillQualifiedButtonNode = existing;
        if (panelFallbackQualifiedButtonNode && panelFallbackQualifiedButtonNode.isConnected) {
          panelFallbackQualifiedButtonNode.remove();
        }
        panelFallbackQualifiedButtonNode = null;
        return existing;
      }
      if (!mountTarget || !(mountTarget instanceof HTMLElement)) {
        return null;
      }
      const topButton = document.createElement("button");
      topButton.type = "button";
      topButton.className =
        "el-button el-button--success el-button--mini asr-edge-db-qualified-autofill-filter";
      topButton.setAttribute(TOP_BUTTON_ATTR, "true");
      topButton.textContent = "AI连续填入合格项";
      topButton.title = "刷新当前页列表，只连续处理质检合格数据，AI 推荐并填入，不自动保存提交。";
      topButton.addEventListener("click", function () {
        handleAutoFillQualifiedClick();
      });
      const batchButton = Array.from(mountTarget.querySelectorAll("button")).find(function (button) {
        return normalizeText(button.textContent || "").indexOf("批量判定") >= 0;
      });
      if (batchButton && batchButton.parentNode) {
        batchButton.insertAdjacentElement("afterend", topButton);
      } else {
        mountTarget.appendChild(topButton);
      }
      if (!mountedLogPrinted && typeof console !== "undefined" && typeof console.info === "function") {
        console.info(
          "[DataBaker][round-one-quality] qualified autofill button mounted in filter-screen."
        );
        mountedLogPrinted = true;
      }
      autoFillQualifiedButtonNode = topButton;
      if (panelFallbackQualifiedButtonNode && panelFallbackQualifiedButtonNode.isConnected) {
        panelFallbackQualifiedButtonNode.remove();
      }
      panelFallbackQualifiedButtonNode = null;
      updateQualifiedAutofillButtonState();
      return topButton;
    }

    function ensurePanelFallbackQualifiedButton(headActionsNode) {
      if (!(headActionsNode instanceof HTMLElement)) {
        return null;
      }
      if (ensureTopQualifiedButton()) {
        return autoFillQualifiedButtonNode;
      }
      if (
        panelFallbackQualifiedButtonNode &&
        document.documentElement.contains(panelFallbackQualifiedButtonNode)
      ) {
        updateQualifiedAutofillButtonState();
        return panelFallbackQualifiedButtonNode;
      }
      if (
        !fallbackLogPrinted &&
        typeof console !== "undefined" &&
        typeof console.debug === "function"
      ) {
        console.debug(
          "[DataBaker][round-one-quality] filter-screen mount target not ready, fallback to AI panel."
        );
        fallbackLogPrinted = true;
      }
      const fallbackButton = createButton("AI连续填入合格项");
      fallbackButton.title =
        "刷新当前页列表，只连续处理质检合格数据，AI 推荐并填入，不自动保存提交。";
      fallbackButton.addEventListener("click", function () {
        handleAutoFillQualifiedClick();
      });
      headActionsNode.appendChild(fallbackButton);
      panelFallbackQualifiedButtonNode = fallbackButton;
      updateQualifiedAutofillButtonState();
      return fallbackButton;
    }

    async function requestAiRecommend() {
      if (!ensureMounted()) {
        return { ok: false, message: "AI 推荐工具卡未就绪。" };
      }
      await handleRecommendClick(recommendButtonNode);
      return { ok: true };
    }

    async function copyHeardText() {
      const text = removeTextSpaces(currentResult?.heardText || "");
      if (!text) {
        setStatus("暂无 AI 听音文本。", "error");
        return { ok: false };
      }
      await copyText(text);
      setStatus("AI 听音文本已复制。", "success");
      return { ok: true };
    }

    async function copyRecommendedText() {
      const text = removeTextSpaces(currentResult?.recommendedText || "");
      if (!text) {
        setStatus("暂无 AI 推荐文本。", "error");
        return { ok: false };
      }
      await copyText(text);
      setStatus("AI 推荐文本已复制。", "success");
      return { ok: true };
    }

    function fillRecommendedText() {
      const text = removeTextSpaces(currentResult?.recommendedText || "");
      if (!text) {
        setStatus("暂无 AI 推荐文本。", "error");
        return { ok: false };
      }
      if (typeof deps.fillPageText !== "function") {
        setStatus("无法安全定位可编辑文本框，已保留复制入口。", "error");
        return { ok: false };
      }
      const fillResult = deps.fillPageText(text);
      setStatus(fillResult?.message || "已填入推荐文本。", fillResult?.ok === false ? "error" : "success");
      return fillResult || { ok: true };
    }

    function ignoreAiResult() {
      if (!currentResult) {
        setStatus("暂无 AI 推荐结果。", "error");
        return { ok: false };
      }
      clearResult();
      setStatus("已忽略本次推荐。", "info");
      return { ok: true };
    }

    function ensureMounted() {
      if (root && document.documentElement.contains(root)) {
        if (
          !autoFillQualifiedButtonNode ||
          !document.documentElement.contains(autoFillQualifiedButtonNode)
        ) {
          ensureTopQualifiedButton();
        }
        return root;
      }

      ensureStyle();
      ensureTopQualifiedButton();
      const mountTarget = findMountTarget();
      if (!mountTarget) {
        if (
          !mountTargetDebugPrinted &&
          typeof console !== "undefined" &&
          typeof console.debug === "function"
        ) {
          console.debug(
            "[DataBaker][round-one-quality] AI panel mount target not ready, will retry."
          );
          mountTargetDebugPrinted = true;
        }
        return null;
      }
      mountTargetDebugPrinted = false;

      root = document.createElement("div");
      root.setAttribute(ROOT_ATTR, "true");

      const head = document.createElement("div");
      head.className = "asr-edge-db-head";
      const title = document.createElement("div");
      title.className = "asr-edge-db-title";
      title.textContent = "闽南语助手推荐文本";
      const actions = document.createElement("div");
      actions.className = "asr-edge-db-actions";
      const recommendButton = createButton("AI 推荐文本", { "data-primary": "true" });
      recommendButtonNode = recommendButton;
      recommendButton.addEventListener("click", function () {
        handleRecommendClick(recommendButton);
      });
      actions.appendChild(recommendButton);
      head.appendChild(title);
      head.appendChild(actions);
      root.appendChild(head);

      statusNode = document.createElement("div");
      statusNode.className = "asr-edge-db-status";
      statusNode.textContent = "请选择左侧当前句子后手动触发。";
      root.appendChild(statusNode);

      if (mountTarget.classList.contains("text-box")) {
        mountTarget.insertAdjacentElement("afterend", root);
      } else if (
        mountTarget.matches(".el-textarea, textarea") &&
        mountTarget.parentElement instanceof HTMLElement
      ) {
        mountTarget.parentElement.insertAdjacentElement("afterend", root);
      } else {
        mountTarget.insertBefore(root, mountTarget.firstElementChild || null);
      }
      if (!panelMountedLogPrinted && typeof console !== "undefined" && typeof console.info === "function") {
        console.info("[DataBaker][round-one-quality] AI recommend panel mounted");
        panelMountedLogPrinted = true;
      }
      ensurePanelFallbackQualifiedButton(actions);
      return root;
    }

    function updateCurrentItemKey(itemKey) {
      const key = String(itemKey || "");
      if (key && currentItemKey && key !== currentItemKey) {
        clearResult();
        setStatus("当前题已变化，请重新点击 AI 推荐文本。", "info");
      }
      currentItemKey = key;
    }

    function getCurrentResult() {
      return currentResult;
    }

    function remove() {
      const topButton = document.querySelector("[" + TOP_BUTTON_ATTR + "='true']");
      if (topButton && topButton instanceof HTMLElement) {
        topButton.remove();
      }
      hideBatchFloatingPanel({ clearSuppress: true });
      if (root) {
        root.remove();
      }
      root = null;
      resultNode = null;
      statusNode = null;
      recommendButtonNode = null;
      autoFillQualifiedButtonNode = null;
      if (panelFallbackQualifiedButtonNode && panelFallbackQualifiedButtonNode.isConnected) {
        panelFallbackQualifiedButtonNode.remove();
      }
      panelFallbackQualifiedButtonNode = null;
      currentResult = null;
      currentItemKey = "";
      batchAutofillRunning = false;
      batchAutofillStopping = false;
      batchAutofillPhase = "idle";
      batchFailureRetryHandler =
        typeof deps.onRetryFailedQualifiedFillItems === "function"
          ? deps.onRetryFailedQualifiedFillItems
          : null;
      loadFailureDebugJsonHandler =
        typeof deps.onLoadFailureDebugJson === "function" ? deps.onLoadFailureDebugJson : null;
    }

    function setBatchAutofillRunning(isRunning) {
      batchAutofillRunning = isRunning === true;
      if (!batchAutofillRunning) {
        batchAutofillStopping = false;
        batchAutofillPhase = "idle";
      }
      updateQualifiedAutofillButtonState();
      if (batchFloatingRetryButton) {
        batchFloatingRetryButton.disabled = batchAutofillRunning;
      }
    }

    function setBatchAutofillStopping(isStopping) {
      batchAutofillStopping = isStopping === true;
      updateQualifiedAutofillButtonState();
    }

    function setBatchAutofillPhase(phase) {
      const next = String(phase || "").trim().toLowerCase();
      if (next === "analysis" || next === "fill" || next === "fetching" || next === "retry") {
        batchAutofillPhase = next;
      } else {
        batchAutofillPhase = "idle";
      }
      updateQualifiedAutofillButtonState();
    }

    function setBatchFailureRetryHandler(handler) {
      batchFailureRetryHandler = typeof handler === "function" ? handler : null;
      if (batchFloatingRetryButton && !batchFailureRetryHandler) {
        batchFloatingRetryButton.style.display = "none";
      }
    }

    function setLoadFailureDebugJsonHandler(handler) {
      loadFailureDebugJsonHandler = typeof handler === "function" ? handler : null;
    }

    return {
      clearResult,
      copyHeardText,
      copyRecommendedText,
      ensureMounted,
      finishBatchFloatingProgress,
      fillRecommendedText,
      getCurrentResult,
      hideBatchFloatingPanel,
      ignoreAiResult,
      remove,
      renderResult,
      requestAiRecommend,
      setBatchFailureRetryHandler,
      setLoadFailureDebugJsonHandler,
      setBatchAutofillPhase,
      setBatchAutofillRunning,
      setBatchAutofillStopping,
      setStatus,
      showBatchFloatingPanel,
      updateBatchFloatingProgress,
      updateCurrentItemKey,
    };
  }

  const api = {
    createRuntime,
    ensureChineseSentencePunctuation,
    removeTextSpaces,
    normalizeText,
  };

  api.__test__ = {
    buildResultRows,
    buildBatchFloatingRows,
  };

  globalThis.__ASREdgeDataBakerRoundOneUiPanel = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
