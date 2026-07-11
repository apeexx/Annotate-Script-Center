(function () {
  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    let toolbarRoot = null;
    let mountTimer = null;
    let observer = null;
    const actionButtons = new Map();
    const statusNodes = {
      enabled: null,
      item: null,
      audio: null,
      action: null,
    };

    function shouldShow() {
      return typeof options.shouldShowToolbar === "function" && options.shouldShowToolbar() === true;
    }

    function styleButton(button) {
      Object.assign(button.style, {
        minHeight: "26px",
        padding: "0 8px",
        border: "1px solid #d6e4ff",
        borderRadius: "6px",
        background: "#ffffff",
        color: "#0958d9",
        fontSize: "12px",
        lineHeight: "24px",
        fontWeight: "600",
        cursor: "pointer",
        whiteSpace: "nowrap",
      });
    }

    function styleStat(node) {
      Object.assign(node.style, {
        minHeight: "26px",
        display: "inline-flex",
        alignItems: "center",
        padding: "0 8px",
        border: "1px solid #bbf7d0",
        borderRadius: "6px",
        background: "#f0fdf4",
        color: "#166534",
        fontSize: "12px",
        lineHeight: "24px",
        fontWeight: "700",
        whiteSpace: "nowrap",
      });
    }

    function resolveMountPoint() {
      const toolbox = document.querySelector(".mark-toolbox");
      if (toolbox instanceof HTMLElement) {
        const breadcrumb = toolbox.querySelector(".mark-toolbox-breadcrumb-wrapper");
        if (breadcrumb instanceof HTMLElement) {
          return {
            host: toolbox,
            before: breadcrumb.nextSibling || null,
          };
        }
        return {
          host: toolbox,
          before: toolbox.firstChild || null,
        };
      }

      const firstItem = document.querySelector(".labelRender-item");
      if (firstItem instanceof HTMLElement && firstItem.parentElement) {
        return {
          host: firstItem.parentElement,
          before: firstItem,
        };
      }

      return null;
    }

    function removeOrphans() {
      const allNodes = Array.from(document.querySelectorAll("[data-asr-edge-transcription-toolbar='true']"));
      allNodes.forEach(function (node) {
        if (node !== toolbarRoot && node.parentNode) {
          node.parentNode.removeChild(node);
        }
      });
    }

    function createButton(action) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.shortLabel || action.label;
      button.title = action.label || action.shortLabel || action.key;
      button.setAttribute("data-asr-edge-transcription-action", action.key);
      styleButton(button);
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof options.onAction === "function") {
          void options.onAction(action.key, "toolbar");
        }
      });
      actionButtons.set(action.key, button);
      return button;
    }

    function createGroup(group) {
      const wrap = document.createElement("div");
      Object.assign(wrap.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        flexWrap: "wrap",
      });

      const title = document.createElement("span");
      title.textContent = group.label || "分组";
      Object.assign(title.style, {
        color: "#475569",
        fontSize: "12px",
        fontWeight: "700",
        marginRight: "2px",
        whiteSpace: "nowrap",
      });
      wrap.appendChild(title);

      const actions = Array.isArray(group.actions) ? group.actions : [];
      actions.forEach(function (action) {
        wrap.appendChild(createButton(action));
      });
      return wrap;
    }

    function createStatusNode(key) {
      const node = document.createElement("span");
      node.setAttribute("data-asr-edge-transcription-stat", key);
      styleStat(node);
      return node;
    }

    function createStatusGroup() {
      const group = document.createElement("div");
      Object.assign(group.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        flexWrap: "wrap",
      });

      const title = document.createElement("span");
      title.textContent = "状态";
      Object.assign(title.style, {
        color: "#475569",
        fontSize: "12px",
        fontWeight: "700",
        marginRight: "2px",
        whiteSpace: "nowrap",
      });
      group.appendChild(title);

      statusNodes.enabled = createStatusNode("enabled");
      statusNodes.item = createStatusNode("item");
      statusNodes.audio = createStatusNode("audio");
      statusNodes.action = createStatusNode("action");

      group.appendChild(statusNodes.enabled);
      group.appendChild(statusNodes.item);
      group.appendChild(statusNodes.audio);
      group.appendChild(statusNodes.action);
      return group;
    }

    function createToolbarRoot() {
      const root = document.createElement("div");
      root.setAttribute("data-asr-edge-transcription-toolbar", "true");
      Object.assign(root.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
        margin: "4px 12px",
        padding: "6px 8px",
        border: "1px solid #dbeafe",
        borderRadius: "8px",
        background: "rgba(248, 250, 252, 0.94)",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
      });

      const groups = typeof options.getActionGroups === "function" ? options.getActionGroups() : [];
      groups.forEach(function (group) {
        root.appendChild(createGroup(group));
      });
      root.appendChild(createStatusGroup());
      return root;
    }

    function removeToolbar() {
      if (toolbarRoot && toolbarRoot.parentNode) {
        toolbarRoot.parentNode.removeChild(toolbarRoot);
      }
      toolbarRoot = null;
      actionButtons.clear();
      Object.keys(statusNodes).forEach(function (key) {
        statusNodes[key] = null;
      });
    }

    function update() {
      if (!toolbarRoot || !toolbarRoot.isConnected) {
        return;
      }
      const state = typeof options.getStatus === "function" ? options.getStatus() : null;
      const safeState = state && typeof state === "object" ? state : {};

      if (statusNodes.enabled) {
        statusNodes.enabled.textContent = safeState.enabledText || "ASR 转写工具栏已启用";
      }
      if (statusNodes.item) {
        statusNodes.item.textContent = safeState.itemText || "当前题：未定位";
      }
      if (statusNodes.audio) {
        statusNodes.audio.textContent = safeState.audioText || "音频：--";
      }
      if (statusNodes.action) {
        statusNodes.action.textContent = safeState.lastActionText || "最近操作：--";
      }
    }

    function ensureToolbar() {
      if (!shouldShow()) {
        removeToolbar();
        return;
      }

      removeOrphans();
      const mountPoint = resolveMountPoint();
      if (!mountPoint || !(mountPoint.host instanceof HTMLElement)) {
        return;
      }

      if (!toolbarRoot) {
        toolbarRoot = createToolbarRoot();
      }

      const expectedParent = mountPoint.host;
      const alreadyMounted =
        toolbarRoot.isConnected &&
        toolbarRoot.parentNode === expectedParent &&
        (!mountPoint.before || toolbarRoot.nextSibling === mountPoint.before || toolbarRoot === mountPoint.before);

      if (!alreadyMounted) {
        if (toolbarRoot.parentNode) {
          toolbarRoot.parentNode.removeChild(toolbarRoot);
        }
        expectedParent.insertBefore(toolbarRoot, mountPoint.before || null);
      }

      update();
    }

    function scheduleEnsure(delay) {
      if (mountTimer) {
        window.clearTimeout(mountTimer);
      }
      mountTimer = window.setTimeout(function () {
        mountTimer = null;
        ensureToolbar();
      }, typeof delay === "number" ? delay : 80);
    }

    function start() {
      scheduleEnsure(0);
      if (observer) {
        return;
      }
      observer = new MutationObserver(function () {
        scheduleEnsure(100);
      });
      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    function stop() {
      if (mountTimer) {
        window.clearTimeout(mountTimer);
        mountTimer = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      removeToolbar();
    }

    return {
      start: start,
      stop: stop,
      update: update,
      scheduleEnsure: scheduleEnsure,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxTranscriptionToolbar = {
    createRuntime: createRuntime,
  };
})();
