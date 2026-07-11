(function () {
  const ROOT_ATTR = "data-asr-edge-transcription-ai-suggestion";
  const STYLE_ID = "asr-edge-transcription-ai-suggestion-style";
  const aiCostDisplay = globalThis.ASREdgeAiCostDisplay || {};
  const DECISION_LABELS = {
    candidate_a: "A 更优",
    candidate_b: "B 更优",
    merged: "融合修正",
    uncertain: "不确定",
    invalid_audio: "音频无效",
  };
  const buildCostRows =
    typeof aiCostDisplay.buildCostRows === "function"
      ? aiCostDisplay.buildCostRows
      : function () {
          return [];
        };

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "[" + ROOT_ATTR + "] {",
      "  margin-top: 8px;",
      "  border: 1px solid #bfdbfe;",
      "  border-radius: 8px;",
      "  background: #f8fbff;",
      "  color: #0f172a;",
      "  padding: 10px;",
      "  font-size: 12px;",
      "  line-height: 1.5;",
      "  box-sizing: border-box;",
      "}",
      "[" + ROOT_ATTR + "][data-status='error'] {",
      "  border-color: #fecaca;",
      "  background: #fff7f7;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-head {",
      "  display: flex;",
      "  justify-content: space-between;",
      "  align-items: center;",
      "  gap: 8px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-title {",
      "  font-weight: 700;",
      "  color: #1d4ed8;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-state {",
      "  font-weight: 700;",
      "  color: #475569;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-grid {",
      "  margin-top: 8px;",
      "  display: grid;",
      "  grid-template-columns: 92px minmax(0, 1fr);",
      "  gap: 4px 8px;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-label {",
      "  color: #475569;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-value {",
      "  word-break: break-word;",
      "  white-space: pre-wrap;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-actions {",
      "  margin-top: 10px;",
      "  display: flex;",
      "  flex-wrap: wrap;",
      "  gap: 8px;",
      "}",
      "[" + ROOT_ATTR + "] button {",
      "  min-height: 28px;",
      "  border-radius: 6px;",
      "  border: 1px solid #cbd5e1;",
      "  background: #fff;",
      "  color: #0f172a;",
      "  font-size: 12px;",
      "  font-weight: 700;",
      "  padding: 0 10px;",
      "  cursor: pointer;",
      "}",
      "[" + ROOT_ATTR + "] button[data-action='suggest'] {",
      "  border-color: #1d4ed8;",
      "  background: #1d4ed8;",
      "  color: #fff;",
      "}",
      "[" + ROOT_ATTR + "] button:disabled {",
      "  opacity: 0.55;",
      "  cursor: not-allowed;",
      "}",
      "[" + ROOT_ATTR + "] .asr-edge-ai-foot {",
      "  margin-top: 8px;",
      "  color: #64748b;",
      "}",
    ].join("\n");
    (document.head || document.documentElement).appendChild(style);
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function createKey(payload) {
    const taskItemId = normalizeText(payload?.taskItemId || "");
    const itemIndex = Number(payload?.itemIndex || 0);
    return taskItemId + "#" + String(itemIndex);
  }

  function createResult(ok, message, extra) {
    return Object.assign(
      {
        ok: ok === true,
        message: String(message || ""),
      },
      extra || {}
    );
  }

  function copyText(text) {
    const value = String(text || "");
    if (!value) {
      return Promise.resolve(false);
    }
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(value).then(function () {
        return true;
      });
    }
    return Promise.resolve(false);
  }

  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    const cacheByKey = new Map();
    let currentItem = null;
    let currentKey = "";
    let root = null;
    let closedKey = "";

    function shouldShow() {
      return typeof options.shouldShow === "function" ? options.shouldShow() === true : false;
    }

    function setStatus(nextStatus, optionsExtra) {
      const state = cacheByKey.get(currentKey) || {};
      const next = Object.assign({}, state, {
        status: nextStatus,
      });
      if (optionsExtra && typeof optionsExtra === "object") {
        Object.assign(next, optionsExtra);
      }
      cacheByKey.set(currentKey, next);
      render();
    }

    function getCurrentSnapshot() {
      if (typeof options.collectCurrentPayload !== "function") {
        return { ok: false, message: "采集模块未初始化。" };
      }
      return options.collectCurrentPayload();
    }

    function removeRoot() {
      if (root && root.parentNode) {
        root.parentNode.removeChild(root);
      }
      root = null;
    }

    function ensureCurrentBinding() {
      const snapshot = getCurrentSnapshot();
      if (!snapshot.ok) {
        currentItem = null;
        currentKey = "";
        removeRoot();
        return snapshot;
      }

      currentItem = snapshot.item;
      currentKey = createKey(snapshot.payload);
      if (!cacheByKey.has(currentKey)) {
        cacheByKey.set(currentKey, {
          status: "idle",
          message: "未分析",
          payload: snapshot.payload,
          result: null,
          requestId: "",
          busy: false,
        });
      } else {
        const old = cacheByKey.get(currentKey);
        cacheByKey.set(currentKey, Object.assign({}, old, { payload: snapshot.payload }));
      }

      return snapshot;
    }

    function buildStatusText(statusState) {
      const status = statusState?.status || "idle";
      if (status === "running") {
        return "分析中";
      }
      if (status === "success") {
        return "成功";
      }
      if (status === "error") {
        return "失败";
      }
      return "未分析";
    }

    function createRow(label, value) {
      const labelNode = document.createElement("span");
      labelNode.className = "asr-edge-ai-label";
      labelNode.textContent = label;
      const valueNode = document.createElement("span");
      valueNode.className = "asr-edge-ai-value";
      valueNode.textContent = value || "-";
      return [labelNode, valueNode];
    }

    function ensureRoot() {
      if (!currentItem || !(currentItem instanceof HTMLElement)) {
        removeRoot();
        return null;
      }
      ensureStyle();

      if (root && root.isConnected && root.parentNode === currentItem) {
        return root;
      }

      removeRoot();
      const panel = document.createElement("div");
      panel.setAttribute(ROOT_ATTR, "true");
      currentItem.appendChild(panel);
      root = panel;
      return panel;
    }

    function render() {
      if (!shouldShow()) {
        removeRoot();
        return;
      }
      if (!currentKey) {
        return;
      }
      if (closedKey && closedKey === currentKey) {
        removeRoot();
        return;
      }

      const statusState = cacheByKey.get(currentKey);
      if (!statusState) {
        return;
      }
      const panel = ensureRoot();
      if (!panel) {
        return;
      }

      panel.setAttribute("data-status", statusState.status === "error" ? "error" : "normal");
      const result = statusState.result || null;
      const requestId = String(statusState.requestId || result?.requestId || "");
      const statusText = buildStatusText(statusState);

      panel.innerHTML = "";

      const head = document.createElement("div");
      head.className = "asr-edge-ai-head";
      const title = document.createElement("span");
      title.className = "asr-edge-ai-title";
      title.textContent = "AI 推荐（仅供参考）";
      const stateNode = document.createElement("span");
      stateNode.className = "asr-edge-ai-state";
      stateNode.textContent = "状态：" + statusText;
      head.appendChild(title);
      head.appendChild(stateNode);
      panel.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "asr-edge-ai-grid";
      const riskText = Array.isArray(result?.riskFlags) && result.riskFlags.length > 0
        ? result.riskFlags.join("、")
        : "-";
      const decisionText = DECISION_LABELS[result?.decision] || "-";
      const confidence = Number(result?.confidence);
      const confidenceText = Number.isFinite(confidence) ? (confidence * 100).toFixed(1) + "%" : "-";

      const detailRows = [
        createRow("推荐文本", result?.recommendedText || "-"),
        createRow("判断", decisionText),
        createRow("置信度", confidenceText),
        createRow("简短原因", result?.reasonSummary || statusState.message || "-"),
        createRow("风险提示", riskText),
      ];
      buildCostRows({
        cost: result?.cost,
        stageDefinitions: [
          {
            key: "recommend",
            label: "预估人民币",
            fallbackToTotal: true,
          },
        ],
      }).forEach(function (row) {
        detailRows.push(createRow(row[0], row[1]));
      });
      detailRows.forEach(function (rowNodes) {
        grid.appendChild(rowNodes[0]);
        grid.appendChild(rowNodes[1]);
      });
      panel.appendChild(grid);

      const actions = document.createElement("div");
      actions.className = "asr-edge-ai-actions";

      const suggestButton = document.createElement("button");
      suggestButton.type = "button";
      suggestButton.textContent = "AI 推荐";
      suggestButton.setAttribute("data-action", "suggest");
      suggestButton.disabled = statusState.busy === true;
      suggestButton.addEventListener("click", function () {
        void requestCurrentSuggestion("panel");
      });
      actions.appendChild(suggestButton);

      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.textContent = "填入推荐文本";
      applyButton.setAttribute("data-action", "apply");
      const canApply = Boolean(result?.recommendedText) && statusState.busy !== true;
      applyButton.disabled = !canApply;
      applyButton.addEventListener("click", function () {
        void applyCurrentSuggestion();
      });
      actions.appendChild(applyButton);

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.textContent = "复制推荐";
      copyButton.setAttribute("data-action", "copy");
      copyButton.disabled = !Boolean(result?.recommendedText);
      copyButton.addEventListener("click", function () {
        void copyCurrentSuggestion();
      });
      actions.appendChild(copyButton);

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.textContent = "关闭";
      closeButton.setAttribute("data-action", "close");
      closeButton.addEventListener("click", function () {
        closeCurrentPanel();
      });
      actions.appendChild(closeButton);

      panel.appendChild(actions);

      const foot = document.createElement("div");
      foot.className = "asr-edge-ai-foot";
      foot.textContent = [
        requestId ? "requestId: " + requestId : "requestId: -",
        "仅填入当前题，不自动保存/提交/流转",
      ].join(" | ");
      panel.appendChild(foot);
    }

    async function requestCurrentSuggestion(trigger) {
      const snapshot = ensureCurrentBinding();
      if (!snapshot.ok) {
        return createResult(false, snapshot.message || "未定位到当前题。");
      }
      if (!currentKey) {
        return createResult(false, "当前题标识缺失。");
      }
      closedKey = "";

      const state = cacheByKey.get(currentKey) || {};
      if (state.busy === true) {
        return createResult(false, "AI 推荐进行中，请稍候。");
      }

      setStatus("running", {
        busy: true,
        message: "分析中...",
      });

      try {
        if (typeof options.requestCurrentSuggestion !== "function") {
          throw new Error("AI 请求模块未初始化。");
        }
        const response = await options.requestCurrentSuggestion(snapshot.payload, {
          trigger: trigger || "manual",
        });
        const data = response?.data || null;
        if (!data) {
          throw new Error("AI 返回为空。", "empty-ai-response");
        }

        setStatus("success", {
          busy: false,
          message: "分析完成。",
          result: data,
          requestId: String(data.requestId || ""),
        });
        return createResult(true, "AI 推荐完成。", { data: data });
      } catch (error) {
        setStatus("error", {
          busy: false,
          message: error?.message || "AI 推荐失败。",
        });
        return createResult(false, error?.message || "AI 推荐失败。");
      }
    }

    async function applyCurrentSuggestion() {
      const state = currentKey ? cacheByKey.get(currentKey) : null;
      const recommendedText = String(state?.result?.recommendedText || "");
      if (!recommendedText) {
        return createResult(false, "当前没有可填入的推荐文本。");
      }
      if (typeof options.applySuggestionText !== "function") {
        return createResult(false, "填入动作未初始化。");
      }

      const actionResult = options.applySuggestionText(recommendedText);
      render();
      if (actionResult?.ok === true) {
        return createResult(true, actionResult.message || "已填入推荐文本。");
      }
      return createResult(false, actionResult?.message || "填入推荐文本失败。");
    }

    async function copyCurrentSuggestion() {
      const state = currentKey ? cacheByKey.get(currentKey) : null;
      const recommendedText = String(state?.result?.recommendedText || "");
      if (!recommendedText) {
        return createResult(false, "当前没有可复制的推荐文本。");
      }

      const copied = await copyText(recommendedText);
      if (!copied) {
        return createResult(false, "当前环境不支持复制。", { copied: false });
      }
      return createResult(true, "已复制推荐文本。", { copied: true });
    }

    function closeCurrentPanel() {
      if (!currentKey) {
        return;
      }
      closedKey = currentKey;
      removeRoot();
    }

    function syncCurrentItem() {
      ensureCurrentBinding();
      render();
    }

    function getStateSummary() {
      if (!currentKey) {
        return "AI 推荐：未定位当前题";
      }
      const state = cacheByKey.get(currentKey);
      if (!state) {
        return "AI 推荐：未分析";
      }
      if (state.busy === true || state.status === "running") {
        return "AI 推荐：分析中";
      }
      if (state.status === "success") {
        return "AI 推荐：已生成";
      }
      if (state.status === "error") {
        return "AI 推荐：失败";
      }
      return "AI 推荐：未分析";
    }

    function clearAll() {
      cacheByKey.clear();
      currentItem = null;
      currentKey = "";
      closedKey = "";
      removeRoot();
    }

    return {
      syncCurrentItem,
      requestCurrentSuggestion,
      applyCurrentSuggestion,
      copyCurrentSuggestion,
      closeCurrentPanel,
      getStateSummary,
      clearAll,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxTranscriptionAiSuggestionPanel = {
    createRuntime,
  };
})();
