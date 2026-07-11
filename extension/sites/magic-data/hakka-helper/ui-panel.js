(function () {
  const ROOT_ATTR = "data-asc-magic-data-ai-panel";
  const STYLE_ATTR = "data-asc-magic-data-ai-panel-style";
  const INCOME_PER_EFFECTIVE_HOUR = 120;

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function formatNumber(value, digits) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits || 2) : "-";
  }

  function toSecondsText(value) {
    const number = Number(value);
    return Number.isFinite(number) ? formatNumber(number, 3) + "s" : "-";
  }

  function calcEstimatedIncome(effectiveTime) {
    const seconds = Number(effectiveTime);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return null;
    }
    return (seconds / 3600) * INCOME_PER_EFFECTIVE_HOUR;
  }

  function createButton(label, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (className) {
      button.className = className;
    }
    return button;
  }

  function ensureStyle() {
    if (document.querySelector("style[" + STYLE_ATTR + "]")) {
      return;
    }
    const style = document.createElement("style");
    style.setAttribute(STYLE_ATTR, "true");
    style.textContent = [
      "[" + ROOT_ATTR + "]{position:fixed;right:24px;bottom:24px;width:460px;max-height:72vh;z-index:2147483647;background:#f8fafc;color:#0f172a;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 16px 42px rgba(2,6,23,.32);font-family:'Microsoft YaHei',sans-serif;overflow:hidden;}",
      "[" + ROOT_ATTR + "] *{box-sizing:border-box;}",
      "[" + ROOT_ATTR + "] .md-head{padding:12px;border-bottom:1px solid #dbe3ef;background:linear-gradient(120deg,#eff6ff,#f8fafc);}",
      "[" + ROOT_ATTR + "] .md-head-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;}",
      "[" + ROOT_ATTR + "] .md-title{font-size:16px;font-weight:700;color:#1d4ed8;}",
      "[" + ROOT_ATTR + "] .md-subtitle{margin-top:4px;font-size:12px;color:#475569;}",
      "[" + ROOT_ATTR + "] .md-head-actions{display:flex;gap:6px;}",
      "[" + ROOT_ATTR + "] .md-body{padding:12px;display:flex;flex-direction:column;gap:10px;overflow:auto;max-height:calc(72vh - 82px);}",
      "[" + ROOT_ATTR + "] .md-block{border:1px solid #dbe3ef;border-radius:10px;padding:8px;background:#ffffff;}",
      "[" + ROOT_ATTR + "] .md-block-title{font-size:12px;font-weight:700;color:#334155;margin-bottom:6px;}",
      "[" + ROOT_ATTR + "] .md-grid{display:grid;grid-template-columns:116px 1fr;gap:5px 8px;font-size:12px;line-height:1.45;}",
      "[" + ROOT_ATTR + "] .md-grid .k{color:#64748b;font-weight:700;}",
      "[" + ROOT_ATTR + "] .md-grid .v{white-space:pre-wrap;overflow-wrap:anywhere;}",
      "[" + ROOT_ATTR + "] .md-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}",
      "[" + ROOT_ATTR + "] button{background:#ffffff;color:#0f172a;border:1px solid #cbd5e1;border-radius:8px;padding:7px 8px;font-size:12px;cursor:pointer;}",
      "[" + ROOT_ATTR + "] button:hover{background:#f1f5f9;}",
      "[" + ROOT_ATTR + "] button:disabled{opacity:.5;cursor:not-allowed;}",
      "[" + ROOT_ATTR + "] .md-primary{background:#1d4ed8;border-color:#1d4ed8;color:#ffffff;font-weight:700;}",
      "[" + ROOT_ATTR + "] .md-message{font-size:12px;padding:8px;border-radius:8px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;white-space:pre-wrap;}",
      "[" + ROOT_ATTR + "] .md-result-empty{font-size:12px;color:#64748b;}",
      "[" + ROOT_ATTR + "] .md-safe{font-size:12px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;padding:8px;border-radius:8px;}",
      "[" + ROOT_ATTR + "] .md-loading::after{content:'...';display:inline-block;animation:mdDots 1.1s infinite;}",
      "[" + ROOT_ATTR + "] .md-shortcuts-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}",
      "[" + ROOT_ATTR + "] .md-shortcuts-body{display:none;margin-top:8px;}",
      "[" + ROOT_ATTR + "] .md-shortcuts-body[data-open='true']{display:block;}",
      "[" + ROOT_ATTR + "] .md-shortcut-row{display:grid;grid-template-columns:112px 1fr auto auto;gap:6px;align-items:center;margin-bottom:6px;}",
      "[" + ROOT_ATTR + "] .md-shortcut-row .md-k{font-size:12px;color:#334155;}",
      "[" + ROOT_ATTR + "] .md-shortcut-row .md-v{font-size:12px;color:#1e293b;overflow-wrap:anywhere;}",
      "[" + ROOT_ATTR + "] .md-shortcuts-foot{display:flex;justify-content:flex-end;gap:6px;margin-top:8px;}",
      "@keyframes mdDots{0%{content:'...';}33%{content:'.';}66%{content:'..';}100%{content:'...';}}",
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function copyText(value) {
    const text = String(value || "");
    if (!text) {
      return Promise.reject(new Error("暂无可复制文本。"));
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error("当前页面不支持剪贴板 API。"));
  }

  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    let root = null;
    let bodyNode = null;
    let messageNode = null;
    let summaryNode = null;
    let platformTextNode = null;
    let resultNode = null;
    let collapsed = false;
    let loading = false;
    let latestResult = null;
    let latestSnapshot = {};
    let latestBackend = null;
    let backendResolving = false;
    let mountedLogged = false;
    let shortcutsRuntime = null;
    let shortcutsUnsubscribe = null;
    let shortcutCaptureActionKey = "";
    let shortcutCaptureHandler = null;

    let shortcutBodyNode = null;
    let shortcutStatusNode = null;
    let shortcutRowsNode = null;

    const buttons = {
      review: null,
      copyDialect: null,
      copyMandarin: null,
      fillDialect: null,
      fillMandarin: null,
      ignore: null,
      refresh: null,
      collapse: null,
      shortcutToggle: null,
    };

    function setMessage(message) {
      if (messageNode) {
        messageNode.textContent = normalizeText(message) || "就绪。";
      }
    }

    function updateActionState() {
      const hasResult = Boolean(latestResult);
      const hasDialect = Boolean(getDialectFillText());
      const hasMandarin = Boolean(getMandarinFillText());
      if (buttons.copyDialect) {
        buttons.copyDialect.disabled = loading || !hasDialect;
      }
      if (buttons.copyMandarin) {
        buttons.copyMandarin.disabled = loading || !hasMandarin;
      }
      if (buttons.fillDialect) {
        buttons.fillDialect.disabled = loading || !hasDialect;
      }
      if (buttons.fillMandarin) {
        buttons.fillMandarin.disabled = loading || !hasMandarin;
      }
      if (buttons.ignore) {
        buttons.ignore.disabled = loading || !hasResult;
      }
      if (buttons.review) {
        buttons.review.disabled = loading;
        buttons.review.classList.toggle("md-loading", loading);
        buttons.review.textContent = loading ? "AI 复核当前条（执行中）" : "AI 复核当前条";
      }
      if (buttons.refresh) {
        buttons.refresh.disabled = loading;
      }
      if (buttons.collapse) {
        buttons.collapse.textContent = collapsed ? "展开" : "折叠";
      }
    }

    function ensureBackendResolved() {
      if (latestBackend || backendResolving || typeof options.resolveBackendConfig !== "function") {
        return;
      }
      backendResolving = true;
      Promise.resolve()
        .then(function () {
          return options.resolveBackendConfig();
        })
        .then(function (config) {
          if (!config) {
            return;
          }
          latestBackend = {
            baseUrl: config.baseUrl || "",
            mode: config.mode || "",
          };
          updateSummary(latestSnapshot || {}, latestBackend);
        })
        .catch(function () {})
        .finally(function () {
          backendResolving = false;
        });
    }

    function updateSummary(snapshot, backend) {
      latestSnapshot = snapshot || latestSnapshot || {};
      if (backend) {
        latestBackend = backend;
      }
      if (!summaryNode) {
        return;
      }
      const estimatedIncome =
        latestResult && Number.isFinite(Number(latestResult.estimatedIncome))
          ? Number(latestResult.estimatedIncome)
          : calcEstimatedIncome(latestSnapshot.effectiveTime);
      const speaker = latestSnapshot.speaker || {};
      const rows = [
        ["当前页面", latestSnapshot.pageType === "asrmark" ? "标注单条页" : latestSnapshot.pageType || "-"],
        ["后端地址", latestBackend?.baseUrl || "-"],
        ["taskItemId", latestSnapshot.taskItemId || "-"],
        ["项目名称", latestSnapshot.projectName || "-"],
        ["音频", latestSnapshot.audioHostname ? "已获取（" + latestSnapshot.audioHostname + "）" : "未获取，请先播放一次"],
        ["音频总时长", toSecondsText(latestSnapshot.audioDuration)],
        ["有效句子时长", toSecondsText(latestSnapshot.effectiveTime)],
        ["预计金额", estimatedIncome === null ? "-" : formatNumber(estimatedIncome, 4) + " 元"],
        ["说话人", [speaker.gender || "", speaker.ageRange || ""].filter(Boolean).join(" / ") || "-"],
      ];
      summaryNode.innerHTML = "";
      rows.forEach(function (row) {
        const key = document.createElement("div");
        key.className = "k";
        key.textContent = row[0];
        const value = document.createElement("div");
        value.className = "v";
        value.textContent = row[1];
        summaryNode.appendChild(key);
        summaryNode.appendChild(value);
      });
    }

    function updatePlatformText(snapshot) {
      if (!platformTextNode) {
        return;
      }
      const rows = [
        ["平台方言行", snapshot?.platformDialectText || "未读取到平台文本"],
        ["平台普通话行", snapshot?.platformMandarinText || "未读取到平台文本"],
      ];
      platformTextNode.innerHTML = "";
      rows.forEach(function (row) {
        const key = document.createElement("div");
        key.className = "k";
        key.textContent = row[0];
        const value = document.createElement("div");
        value.className = "v";
        value.textContent = row[1];
        platformTextNode.appendChild(key);
        platformTextNode.appendChild(value);
      });
    }

    function renderResult(data) {
      latestResult = data || null;
      if (!resultNode) {
        return;
      }
      resultNode.innerHTML = "";
      if (!data) {
        const empty = document.createElement("div");
        empty.className = "md-result-empty";
        empty.textContent = "暂无 AI 结果。";
        resultNode.appendChild(empty);
        updateActionState();
        return;
      }

      const comparison = data.comparison || {};
      const dialectLine = comparison.dialectLine || {};
      const mandarinLine = comparison.mandarinLine || {};
      const listen = data.listen || {};
      const timing = data.timing || {};
      const rows = [
        ["verdict", data.verdict || "-"],
        ["shouldReview", String(Boolean(data.shouldReview))],
        ["AI 听音方言文本", listen.heardDialectText || "-"],
        ["AI 普通话意思", listen.heardMandarinMeaning || "-"],
        ["方言 decision", dialectLine.decision || "-"],
        ["方言 issues", (dialectLine.issues || []).join("；") || "-"],
        ["普通话 decision", mandarinLine.decision || "-"],
        ["普通话 issues", (mandarinLine.issues || []).join("；") || "-"],
        ["ruleIssues", (comparison.ruleIssues || []).join("；") || "-"],
        ["lexiconIssues", (comparison.lexiconIssues || []).join("；") || "-"],
        ["requestId", data.requestId || "-"],
        [
          "timing",
          "listen " +
            String(timing.listenDurationMs || 0) +
            "ms / compare " +
            String(timing.compareDurationMs || 0) +
            "ms / total " +
            String(timing.totalDurationMs || 0) +
            "ms",
        ],
      ];

      const grid = document.createElement("div");
      grid.className = "md-grid";
      rows.forEach(function (row) {
        const key = document.createElement("div");
        key.className = "k";
        key.textContent = row[0];
        const value = document.createElement("div");
        value.className = "v";
        value.textContent = row[1];
        grid.appendChild(key);
        grid.appendChild(value);
      });
      resultNode.appendChild(grid);
      updateActionState();
    }

    function setLoading(nextLoading) {
      loading = nextLoading === true;
      updateActionState();
    }

    function clearResult() {
      latestResult = null;
      renderResult(null);
      updateSummary(latestSnapshot || {}, latestBackend);
    }

    function getDialectFillText() {
      const comparisonText = latestResult?.comparison?.dialectLine?.recommendedText || "";
      return normalizeText(comparisonText || latestResult?.listen?.heardDialectText || "");
    }

    function getMandarinFillText() {
      const comparisonText = latestResult?.comparison?.mandarinLine?.recommendedText || "";
      return normalizeText(comparisonText || latestResult?.listen?.heardMandarinMeaning || "");
    }

    function triggerFillDialect() {
      const text = getDialectFillText();
      if (!text) {
        const message = "暂无可填入的第一行文本。";
        setMessage(message);
        return { ok: false, message: message };
      }
      const result = options.fillDialectLine ? options.fillDialectLine(text) : { ok: false, message: "填入功能未就绪。" };
      setMessage(result?.message || "已填入第一行。");
      return result || { ok: false, message: "填入失败。" };
    }

    function triggerFillMandarin() {
      const text = getMandarinFillText();
      if (!text) {
        const message = "暂无可填入的第二行文本。";
        setMessage(message);
        return { ok: false, message: message };
      }
      const result = options.fillMandarinLine ? options.fillMandarinLine(text) : { ok: false, message: "填入功能未就绪。" };
      setMessage(result?.message || "已填入第二行。");
      return result || { ok: false, message: "填入失败。" };
    }

    async function triggerCopyDialect() {
      const text = getDialectFillText();
      if (!text) {
        const message = "暂无可复制的 AI 方言文本。";
        setMessage(message);
        return { ok: false, message: message };
      }
      await copyText(text);
      setMessage("AI 方言文本已复制。");
      return { ok: true, message: "AI 方言文本已复制。" };
    }

    async function triggerCopyMandarin() {
      const text = getMandarinFillText();
      if (!text) {
        const message = "暂无可复制的 AI 普通话文本。";
        setMessage(message);
        return { ok: false, message: message };
      }
      await copyText(text);
      setMessage("AI 普通话文本已复制。");
      return { ok: true, message: "AI 普通话文本已复制。" };
    }

    async function collectAndRenderSnapshot(preferApi) {
      if (typeof options.collectCurrentItem !== "function") {
        setMessage("采集器未就绪，请刷新页面。");
        return null;
      }
      let snapshot = options.collectCurrentItem() || {};
      if (preferApi && typeof options.refreshCurrentItem === "function") {
        try {
          snapshot = await options.refreshCurrentItem({
            taskItemId: snapshot.taskItemId,
          });
        } catch (error) {
          // keep DOM snapshot fallback
        }
      }
      snapshot.pageType = snapshot.pageType || latestSnapshot.pageType || "asrmark";
      updateSummary(snapshot, latestBackend);
      updatePlatformText(snapshot);
      if (!snapshot.audioUrl) {
        setMessage("未获取到音频 URL，请先播放一次音频后再点刷新采集或 AI 复核。");
      } else {
        setMessage("采集完成，可点击 AI 复核当前条。");
      }
      return snapshot;
    }

    async function triggerReview() {
      if (typeof options.collectCurrentItem !== "function" || typeof options.reviewCurrent !== "function") {
        const message = "运行时未就绪，请刷新页面后重试。";
        setMessage(message);
        return { ok: false, message: message };
      }
      const snapshot = await collectAndRenderSnapshot(true);
      if (!snapshot) {
        return { ok: false, message: "采集失败。" };
      }
      if (!snapshot.audioUrl) {
        return { ok: false, message: "未获取到音频 URL。" };
      }
      if (!snapshot.platformDialectText && !snapshot.platformMandarinText) {
        const message = "未读取到平台两行文本，请先确认当前页面是标注单条页。";
        setMessage(message);
        return { ok: false, message: message };
      }

      setLoading(true);
      setMessage("正在调用 AI 复核后端...");
      try {
        const response = await options.reviewCurrent({
          taskItemId: snapshot.taskItemId,
          samplingRecordId: snapshot.samplingRecordId,
          projectName: snapshot.projectName,
          audioUrl: snapshot.audioUrl,
          audioDuration: snapshot.audioDuration,
          effectiveStartTime: snapshot.effectiveStartTime,
          effectiveEndTime: snapshot.effectiveEndTime,
          effectiveTime: snapshot.effectiveTime,
          platformDialectText: snapshot.platformDialectText,
          platformMandarinText: snapshot.platformMandarinText,
          speaker: snapshot.speaker || {},
          rulesProfile: "hakka",
          clientVersion: options.getClientVersion ? options.getClientVersion() : "0.3.0",
        });
        renderResult(response.data);
        updateSummary(snapshot, response.backend);
        updatePlatformText(snapshot);
        setMessage("AI 复核完成，请人工确认。");
        return { ok: true, message: "AI 复核完成。" };
      } catch (error) {
        const message = normalizeText(error?.message || "AI 复核失败。");
        setMessage(message);
        return { ok: false, message: message };
      } finally {
        setLoading(false);
      }
    }

    function updateShortcutStatus(text) {
      if (shortcutStatusNode) {
        shortcutStatusNode.textContent = text;
      }
    }

    function detachShortcutCapture() {
      if (shortcutCaptureHandler) {
        window.removeEventListener("keydown", shortcutCaptureHandler, true);
      }
      shortcutCaptureActionKey = "";
      shortcutCaptureHandler = null;
    }

    function renderShortcutRows() {
      if (!shortcutRowsNode || !shortcutsRuntime) {
        return;
      }
      const map = shortcutsRuntime.getShortcutMap();
      const actions = shortcutsRuntime.getActionDefinitions();
      shortcutRowsNode.innerHTML = "";
      actions.forEach(function (action) {
        const row = document.createElement("div");
        row.className = "md-shortcut-row";

        const keyCell = document.createElement("div");
        keyCell.className = "md-k";
        keyCell.textContent = action.label;

        const valueCell = document.createElement("div");
        valueCell.className = "md-v";
        valueCell.textContent = shortcutsRuntime.shortcutToDisplayText(map[action.key]);

        const setButton = createButton("设置");
        setButton.addEventListener("click", function () {
          detachShortcutCapture();
          shortcutCaptureActionKey = action.key;
          updateShortcutStatus("请按下“" + action.label + "”的快捷键，Esc 取消。");
          shortcutCaptureHandler = function (event) {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              detachShortcutCapture();
              updateShortcutStatus("已取消快捷键设置。");
              return;
            }
            const nextShortcut = shortcutsRuntime.eventToShortcut(event);
            if (!nextShortcut) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") {
              event.stopImmediatePropagation();
            }
            shortcutsRuntime
              .setShortcut(shortcutCaptureActionKey, nextShortcut)
              .then(function (result) {
                detachShortcutCapture();
                renderShortcutRows();
                if (result.persisted) {
                  updateShortcutStatus("快捷键已保存。");
                } else {
                  updateShortcutStatus("快捷键已设置，但 storage 保存失败（仅当前会话可用）。");
                }
              })
              .catch(function () {
                detachShortcutCapture();
                updateShortcutStatus("快捷键设置失败。");
              });
          };
          window.addEventListener("keydown", shortcutCaptureHandler, true);
        });

        const clearButton = createButton("清空");
        clearButton.addEventListener("click", function () {
          shortcutsRuntime
            .setShortcut(action.key, null)
            .then(function (result) {
              renderShortcutRows();
              if (result.persisted) {
                updateShortcutStatus("已清空该快捷键。");
              } else {
                updateShortcutStatus("已清空该快捷键，但 storage 保存失败（仅当前会话可用）。");
              }
            })
            .catch(function () {
              updateShortcutStatus("清空快捷键失败。");
            });
        });

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        row.appendChild(setButton);
        row.appendChild(clearButton);
        shortcutRowsNode.appendChild(row);
      });
    }

    function bindShortcutsRuntime(runtimeInstance) {
      if (shortcutsUnsubscribe) {
        shortcutsUnsubscribe();
        shortcutsUnsubscribe = null;
      }
      shortcutsRuntime = runtimeInstance || null;
      if (!shortcutsRuntime) {
        updateShortcutStatus("快捷键模块未就绪。");
        return;
      }
      shortcutsUnsubscribe = shortcutsRuntime.subscribe(function (state) {
        renderShortcutRows();
        if (state.persisted === false) {
          updateShortcutStatus("storage 不可用，快捷键仅当前会话生效。");
        }
      });
      renderShortcutRows();
      updateShortcutStatus(shortcutsRuntime.isPersisted() ? "默认未设置，可按需配置。" : "storage 不可用，快捷键仅当前会话生效。");
    }

    function ensureMounted() {
      if (root && document.documentElement && document.documentElement.contains(root)) {
        return root;
      }
      if (!document.documentElement) {
        return null;
      }
      ensureStyle();
      ensureBackendResolved();
      root = document.createElement("section");
      root.setAttribute(ROOT_ATTR, "true");
      root.setAttribute("data-asc-magic-data-ai-panel", "true");

      const head = document.createElement("div");
      head.className = "md-head";
      const headRow = document.createElement("div");
      headRow.className = "md-head-row";
      const titleWrap = document.createElement("div");
      const title = document.createElement("div");
      title.className = "md-title";
      title.textContent = "客家话助手";
      const subtitle = document.createElement("div");
      subtitle.className = "md-subtitle";
      subtitle.textContent = "当前只辅助复核，不自动保存、不自动提交。";
      titleWrap.appendChild(title);
      titleWrap.appendChild(subtitle);
      const headActions = document.createElement("div");
      headActions.className = "md-head-actions";
      buttons.refresh = createButton("刷新采集");
      buttons.refresh.addEventListener("click", function () {
        void collectAndRenderSnapshot(true);
      });
      buttons.collapse = createButton("折叠");
      buttons.collapse.addEventListener("click", function () {
        collapsed = !collapsed;
        if (bodyNode) {
          bodyNode.style.display = collapsed ? "none" : "flex";
        }
        updateActionState();
      });
      headActions.appendChild(buttons.refresh);
      headActions.appendChild(buttons.collapse);
      headRow.appendChild(titleWrap);
      headRow.appendChild(headActions);
      head.appendChild(headRow);
      root.appendChild(head);

      bodyNode = document.createElement("div");
      bodyNode.className = "md-body";
      root.appendChild(bodyNode);

      const summaryBlock = document.createElement("div");
      summaryBlock.className = "md-block";
      const summaryTitle = document.createElement("div");
      summaryTitle.className = "md-block-title";
      summaryTitle.textContent = "当前条摘要";
      summaryNode = document.createElement("div");
      summaryNode.className = "md-grid";
      summaryBlock.appendChild(summaryTitle);
      summaryBlock.appendChild(summaryNode);
      bodyNode.appendChild(summaryBlock);

      const platformBlock = document.createElement("div");
      platformBlock.className = "md-block";
      const platformTitle = document.createElement("div");
      platformTitle.className = "md-block-title";
      platformTitle.textContent = "平台文本";
      platformTextNode = document.createElement("div");
      platformTextNode.className = "md-grid";
      platformBlock.appendChild(platformTitle);
      platformBlock.appendChild(platformTextNode);
      bodyNode.appendChild(platformBlock);

      const actions = document.createElement("div");
      actions.className = "md-actions";
      buttons.review = createButton("AI 复核当前条", "md-primary");
      buttons.review.addEventListener("click", function () {
        void triggerReview();
      });
      buttons.copyDialect = createButton("复制 AI 方言文本");
      buttons.copyDialect.addEventListener("click", function () {
        triggerCopyDialect().catch(function (error) {
          setMessage(error?.message || "复制失败。");
        });
      });
      buttons.copyMandarin = createButton("复制 AI 普通话文本");
      buttons.copyMandarin.addEventListener("click", function () {
        triggerCopyMandarin().catch(function (error) {
          setMessage(error?.message || "复制失败。");
        });
      });
      buttons.fillDialect = createButton("填入第一行");
      buttons.fillDialect.addEventListener("click", function () {
        triggerFillDialect();
      });
      buttons.fillMandarin = createButton("填入第二行");
      buttons.fillMandarin.addEventListener("click", function () {
        triggerFillMandarin();
      });
      buttons.ignore = createButton("忽略结果");
      buttons.ignore.addEventListener("click", function () {
        clearResult();
        setMessage("已忽略当前 AI 结果。");
      });
      actions.appendChild(buttons.review);
      actions.appendChild(buttons.copyDialect);
      actions.appendChild(buttons.copyMandarin);
      actions.appendChild(buttons.fillDialect);
      actions.appendChild(buttons.fillMandarin);
      actions.appendChild(buttons.ignore);
      bodyNode.appendChild(actions);

      const shortcutsBlock = document.createElement("div");
      shortcutsBlock.className = "md-block";
      const shortcutsHead = document.createElement("div");
      shortcutsHead.className = "md-shortcuts-head";
      const shortcutsTitle = document.createElement("div");
      shortcutsTitle.className = "md-block-title";
      shortcutsTitle.textContent = "快捷键设置";
      buttons.shortcutToggle = createButton("快捷键设置");
      buttons.shortcutToggle.addEventListener("click", function () {
        const isOpen = shortcutBodyNode?.getAttribute("data-open") === "true";
        shortcutBodyNode?.setAttribute("data-open", isOpen ? "false" : "true");
        buttons.shortcutToggle.textContent = isOpen ? "快捷键设置" : "收起快捷键";
      });
      shortcutsHead.appendChild(shortcutsTitle);
      shortcutsHead.appendChild(buttons.shortcutToggle);
      shortcutsBlock.appendChild(shortcutsHead);

      shortcutBodyNode = document.createElement("div");
      shortcutBodyNode.className = "md-shortcuts-body";
      shortcutBodyNode.setAttribute("data-open", "false");
      shortcutStatusNode = document.createElement("div");
      shortcutStatusNode.className = "md-message";
      shortcutStatusNode.textContent = "默认未设置，可按需配置。";
      shortcutRowsNode = document.createElement("div");
      const shortcutsFoot = document.createElement("div");
      shortcutsFoot.className = "md-shortcuts-foot";
      const clearAllButton = createButton("清空全部快捷键");
      clearAllButton.addEventListener("click", function () {
        if (!shortcutsRuntime) {
          updateShortcutStatus("快捷键模块未就绪。");
          return;
        }
        shortcutsRuntime
          .clearAllShortcuts()
          .then(function (result) {
            renderShortcutRows();
            if (result.persisted) {
              updateShortcutStatus("已清空全部快捷键。");
            } else {
              updateShortcutStatus("已清空全部快捷键，但 storage 保存失败（仅当前会话可用）。");
            }
          })
          .catch(function () {
            updateShortcutStatus("清空全部快捷键失败。");
          });
      });
      shortcutsFoot.appendChild(clearAllButton);
      shortcutBodyNode.appendChild(shortcutStatusNode);
      shortcutBodyNode.appendChild(shortcutRowsNode);
      shortcutBodyNode.appendChild(shortcutsFoot);
      shortcutsBlock.appendChild(shortcutBodyNode);
      bodyNode.appendChild(shortcutsBlock);

      messageNode = document.createElement("div");
      messageNode.className = "md-message";
      messageNode.textContent = "就绪。";
      bodyNode.appendChild(messageNode);

      const resultBlock = document.createElement("div");
      resultBlock.className = "md-block";
      const resultTitle = document.createElement("div");
      resultTitle.className = "md-block-title";
      resultTitle.textContent = "AI 结果";
      resultNode = document.createElement("div");
      resultBlock.appendChild(resultTitle);
      resultBlock.appendChild(resultNode);
      bodyNode.appendChild(resultBlock);

      const safe = document.createElement("div");
      safe.className = "md-safe";
      safe.textContent = "AI 仅辅助复核，不会自动保存、提交、审核或领取任务。";
      bodyNode.appendChild(safe);

      const mountTarget = document.body || document.documentElement;
      mountTarget.appendChild(root);
      if (!mountedLogged && typeof console !== "undefined" && typeof console.info === "function") {
        mountedLogged = true;
        console.info("[MagicData][AI Review] panel mounted");
      }
      updateSummary(latestSnapshot || {}, latestBackend);
      updatePlatformText(latestSnapshot || {});
      renderResult(latestResult);
      updateActionState();
      bindShortcutsRuntime(shortcutsRuntime);
      return root;
    }

    function showAsrmarkCheckNotice() {
      const panel = ensureMounted();
      if (!panel) {
        return;
      }
      clearResult();
      updateSummary(
        {
          pageType: "asrmarkCheck",
          taskItemId: "",
          projectName: "",
          audioHostname: "",
          audioDuration: null,
          effectiveTime: null,
          platformDialectText: "",
          platformMandarinText: "",
          speaker: {},
        },
        latestBackend
      );
      updatePlatformText({});
      setMessage("审核页暂未接入填入，只支持后续扩展。");
    }

    function refreshPageSnapshot(snapshot, backend) {
      const panel = ensureMounted();
      if (!panel) {
        return;
      }
      ensureBackendResolved();
      updateSummary(snapshot || {}, backend || null);
      updatePlatformText(snapshot || {});
    }

    function setShortcutsRuntime(runtimeInstance) {
      shortcutsRuntime = runtimeInstance || null;
      if (root) {
        bindShortcutsRuntime(shortcutsRuntime);
      }
    }

    function remove() {
      detachShortcutCapture();
      if (shortcutsUnsubscribe) {
        shortcutsUnsubscribe();
        shortcutsUnsubscribe = null;
      }
      if (root) {
        root.remove();
      }
      root = null;
      bodyNode = null;
      messageNode = null;
      summaryNode = null;
      platformTextNode = null;
      resultNode = null;
      shortcutBodyNode = null;
      shortcutStatusNode = null;
      shortcutRowsNode = null;
      latestResult = null;
      latestSnapshot = {};
      latestBackend = null;
      collapsed = false;
      loading = false;
    }

    return {
      clearResult: clearResult,
      ensureMounted: ensureMounted,
      refreshPageSnapshot: refreshPageSnapshot,
      remove: remove,
      setMessage: setMessage,
      setShortcutsRuntime: setShortcutsRuntime,
      showAsrmarkCheckNotice: showAsrmarkCheckNotice,
      triggerCopyDialect: triggerCopyDialect,
      triggerCopyMandarin: triggerCopyMandarin,
      triggerFillDialect: triggerFillDialect,
      triggerFillMandarin: triggerFillMandarin,
      triggerReview: triggerReview,
    };
  }

  globalThis.__ASREdgeMagicDataAnnotatorUiPanel = {
    createRuntime: createRuntime,
  };
})();
