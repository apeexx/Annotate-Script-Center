(function () {
  function clampNonNegativeInteger(value) {
    const numeric = Math.floor(Number(value));
    if (!Number.isFinite(numeric) || numeric < 0) {
      return 0;
    }
    return numeric;
  }

  function formatPercent(completed, total) {
    if (total <= 0) {
      return "0%";
    }
    const ratio = Math.max(0, Math.min(1, completed / total));
    return String(Math.round(ratio * 100)) + "%";
  }

  function createNode(tagName, style) {
    const node = document.createElement(tagName);
    Object.assign(node.style, style || {});
    return node;
  }

  function createProgressIndicator(options) {
    const config = options && typeof options === "object" ? options : {};
    const id = String(config.id || "asr-edge-progress-indicator");
    const title = String(config.title || "上传进度");
    const mountTarget = document.body || (config.mount && config.mount.nodeType === 1 ? config.mount : null);
    if (!mountTarget) {
      return {
        update: function () {},
        complete: function () {},
        fail: function () {},
        destroy: function () {},
      };
    }

    const frame = createNode("div", {
      position: "fixed",
      top: "10px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      width: "min(720px, calc(100vw - 48px))",
      minWidth: "420px",
      maxWidth: "720px",
      boxSizing: "border-box",
      marginInline: "auto",
      overflow: "visible",
      pointerEvents: "none",
    });
    frame.id = id;

    const root = createNode("div", {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      width: "100%",
      padding: "12px 16px",
      border: "1px solid #bfdbfe",
      borderRadius: "10px",
      background: "#eff6ff",
      color: "#0958d9",
      fontSize: "13px",
      lineHeight: "1.45",
      boxSizing: "border-box",
      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.18)",
      whiteSpace: "normal",
      overflow: "visible",
      pointerEvents: "auto",
    });

    const headerNode = createNode("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
    });

    const titleNode = createNode("span", {
      fontWeight: "700",
      flex: "0 0 auto",
      color: "inherit",
    });
    titleNode.textContent = title;

    const phaseNode = createNode("span", {
      fontSize: "12px",
      fontWeight: "600",
      color: "inherit",
      opacity: "0.92",
      textAlign: "right",
      minWidth: "0",
      flex: "1 1 auto",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    });
    phaseNode.textContent = "初始化";
    headerNode.appendChild(titleNode);
    headerNode.appendChild(phaseNode);

    const barWrap = createNode("div", {
      width: "100%",
      height: "8px",
      borderRadius: "999px",
      background: "rgba(9, 88, 217, 0.16)",
      overflow: "hidden",
    });
    const bar = createNode("div", {
      display: "block",
      width: "0%",
      height: "100%",
      borderRadius: "999px",
      background: "#1677ff",
      transition: "width 120ms linear",
    });
    barWrap.appendChild(bar);

    const textNode = createNode("div", {
      minWidth: "0",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      wordBreak: "break-word",
      color: "inherit",
    });

    root.appendChild(headerNode);
    root.appendChild(barWrap);
    root.appendChild(textNode);
    frame.appendChild(root);

    const old = document.getElementById(id);
    if (old && old.parentNode) {
      old.parentNode.removeChild(old);
    }
    mountTarget.appendChild(frame);

    const state = {
      phase: "初始化",
      total: 0,
      completed: 0,
      concurrency: 0,
      success: 0,
      failed: 0,
      message: "",
      status: "running",
    };

    function render() {
      const total = clampNonNegativeInteger(state.total);
      const completed = clampNonNegativeInteger(state.completed);
      const success = clampNonNegativeInteger(state.success);
      const failed = clampNonNegativeInteger(state.failed);
      const concurrency = clampNonNegativeInteger(state.concurrency);
      const percent = formatPercent(completed, total);
      const percentWidth = total > 0 ? percent : "0%";

      bar.style.width = percentWidth;

      let text = String(state.phase || "处理中");
      text += "：" + String(completed) + "/" + String(total);
      text += "（" + percent + "）";
      if (concurrency > 0) {
        text += "，并发 " + String(concurrency);
      }
      text += "，成功 " + String(success) + "，失败 " + String(failed);
      if (state.message) {
        text += "，" + String(state.message);
      }
      textNode.textContent = text;
      phaseNode.textContent = String(state.phase || "处理中");

      if (state.status === "failed") {
        root.style.borderColor = "#fecaca";
        root.style.background = "#fef2f2";
        root.style.color = "#b91c1c";
        bar.style.background = "#dc2626";
        return;
      }
      if (state.status === "completed") {
        root.style.borderColor = "#bbf7d0";
        root.style.background = "#f0fdf4";
        root.style.color = "#047857";
        bar.style.background = "#059669";
        return;
      }
      root.style.borderColor = "#bfdbfe";
      root.style.background = "#eff6ff";
      root.style.color = "#0958d9";
      bar.style.background = "#1677ff";
    }

    function update(nextState) {
      const patch = nextState && typeof nextState === "object" ? nextState : {};
      if (patch.phase !== undefined) {
        state.phase = String(patch.phase || "").trim() || state.phase;
      }
      if (patch.total !== undefined) {
        state.total = clampNonNegativeInteger(patch.total);
      }
      if (patch.completed !== undefined) {
        state.completed = clampNonNegativeInteger(patch.completed);
      }
      if (patch.concurrency !== undefined) {
        state.concurrency = clampNonNegativeInteger(patch.concurrency);
      }
      if (patch.success !== undefined) {
        state.success = clampNonNegativeInteger(patch.success);
      }
      if (patch.failed !== undefined) {
        state.failed = clampNonNegativeInteger(patch.failed);
      }
      if (patch.message !== undefined) {
        state.message = String(patch.message || "");
      }
      state.status = "running";
      render();
    }

    function complete(message) {
      state.status = "completed";
      state.message = message ? String(message) : state.message;
      if (state.total > 0 && state.completed < state.total) {
        state.completed = state.total;
      }
      render();
    }

    function fail(message) {
      state.status = "failed";
      state.message = message ? String(message) : state.message;
      render();
    }

    function destroy() {
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
    }

    render();

    return {
      update: update,
      complete: complete,
      fail: fail,
      destroy: destroy,
    };
  }

  globalThis.ASREdgeProgressIndicator = {
    createProgressIndicator: createProgressIndicator,
  };
})();
