(function () {
  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    let toolbarRoot = null;
    let topDurationRoot = null;
    let toolbarObserver = null;
    let toolbarMountTimer = null;

    function shouldShowToolbar() {
      return typeof options.shouldShowToolbar === "function" ? options.shouldShowToolbar() : false;
    }

    function styleToolbarButton(button) {
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

    function getVisibleText(node) {
      return String(node?.textContent || "").replace(/\s+/g, " ").trim();
    }

    function isVisibleElement(element) {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function findElementByText(text) {
      const nodes = Array.from(document.querySelectorAll("a, button, span, div"));
      return (
        nodes.find(function (node) {
          const nodeText = getVisibleText(node);
          return nodeText === text && isVisibleElement(node);
        }) ||
        nodes.find(function (node) {
          const nodeText = getVisibleText(node);
          return nodeText.indexOf(text) >= 0 && nodeText.length <= text.length + 12 && isVisibleElement(node);
        }) ||
        null
      );
    }

    function resolveTopNavMountPoint() {
      const header = document.querySelector(".header-component-container");
      if (header instanceof HTMLElement) {
        const menu = header.querySelector("ul.ant-v5-menu[role='menu'], .ant-v5-menu[role='menu']");
        if (menu) {
          return {
            host: header,
            after: menu,
          };
        }

        return {
          host: header,
          after: null,
        };
      }

      const chatbotNode = findElementByText("Chatbot");
      if (chatbotNode) {
        let child = chatbotNode;
        let parent = chatbotNode.parentElement;

        while (parent && parent !== document.body) {
          const text = getVisibleText(parent);
          const rect = parent.getBoundingClientRect();
          const looksLikeTopNav =
            rect.top >= -4 &&
            rect.top <= 80 &&
            rect.height >= 32 &&
            rect.height <= 96 &&
            text.indexOf("智能标注") >= 0 &&
            text.indexOf("标注中心") >= 0;

          if (looksLikeTopNav) {
            return {
              host: parent,
              after: child,
            };
          }

          child = parent;
          parent = parent.parentElement;
        }

        const fallbackParent = chatbotNode.parentElement;
        if (fallbackParent) {
          return {
            host: fallbackParent,
            after: chatbotNode,
          };
        }
      }

      const candidates = Array.from(
        document.querySelectorAll("header, [class*='Header'], [class*='header'], [class*='Nav'], [class*='nav']")
      );
      const host = candidates.find(function (candidate) {
        const text = getVisibleText(candidate);
        const rect = candidate.getBoundingClientRect();
        return rect.top <= 80 && text.indexOf("智能标注") >= 0 && text.indexOf("标注中心") >= 0;
      });

      return host ? { host: host, after: null } : null;
    }

    function styleTopDuration(node) {
      Object.assign(node.style, {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "28px",
        minWidth: "520px",
        marginLeft: "12px",
        marginRight: "12px",
        padding: "0 12px",
        border: "1px solid #bbf7d0",
        borderRadius: "6px",
        background: "#f0fdf4",
        color: "#166534",
        fontSize: "13px",
        lineHeight: "26px",
        fontWeight: "700",
        whiteSpace: "nowrap",
        flex: "0 0 auto",
      });
    }

    function removeTopDuration() {
      if (topDurationRoot && topDurationRoot.parentNode) {
        topDurationRoot.parentNode.removeChild(topDurationRoot);
      }
      topDurationRoot = null;
    }

    function ensureTopDuration() {
      if (!shouldShowToolbar()) {
        removeTopDuration();
        return;
      }

      const mountPoint = resolveTopNavMountPoint();
      if (!mountPoint || !mountPoint.host) {
        return;
      }

      if (topDurationRoot && topDurationRoot.isConnected && topDurationRoot.parentNode === mountPoint.host) {
        update();
        return;
      }

      removeTopDuration();
      topDurationRoot = document.createElement("span");
      topDurationRoot.setAttribute("data-asr-edge-judgement-top-duration", "true");
      styleTopDuration(topDurationRoot);

      if (mountPoint.after && mountPoint.after.parentNode === mountPoint.host) {
        mountPoint.host.insertBefore(topDurationRoot, mountPoint.after.nextSibling);
      } else {
        mountPoint.host.appendChild(topDurationRoot);
      }

      update();
    }

    function styleToolbarStat(node) {
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

    function createToolbarStat(key) {
      const node = document.createElement("span");
      node.setAttribute("data-asr-edge-judgement-stat", key);
      styleToolbarStat(node);
      return node;
    }

    function update() {
      if (topDurationRoot && topDurationRoot.isConnected) {
        topDurationRoot.textContent =
          typeof options.getTopSummaryText === "function"
            ? options.getTopSummaryText()
            : options.getDurationSummaryText();
        topDurationRoot.title =
          typeof options.getTopSummaryTitle === "function"
            ? options.getTopSummaryTitle()
            : options.getDurationSummaryTitle();
      }

      if (!toolbarRoot || !toolbarRoot.isConnected) {
        return;
      }

      const pageSizeNode = toolbarRoot.querySelector("[data-asr-edge-judgement-stat='page-size']");
      if (pageSizeNode) {
        pageSizeNode.textContent = options.getPageSizeStatText();
        pageSizeNode.title = options.getPageSizeStatTitle();
      }
    }

    function createToolbarButton(actionKey, label, title) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.title = title || label;
      button.setAttribute("data-asr-edge-judgement-action", actionKey);
      styleToolbarButton(button);
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        options.runActionWithFeedback(actionKey, "toolbar", "toolbar-", "lastToolbarAction");
      });
      return button;
    }

    function createToolbarGroup(label, actions) {
      const group = document.createElement("div");
      Object.assign(group.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        flexWrap: "wrap",
      });

      const title = document.createElement("span");
      title.textContent = label;
      Object.assign(title.style, {
        color: "#475569",
        fontSize: "12px",
        fontWeight: "700",
        marginRight: "2px",
        whiteSpace: "nowrap",
      });
      group.appendChild(title);

      actions.forEach(function (action) {
        group.appendChild(createToolbarButton(action.key, action.shortLabel || action.label, action.label));
      });
      return group;
    }

    function appendExtraToolbarGroups() {
      if (typeof options.getExtraActionGroups !== "function") {
        return;
      }

      const groups = Array.isArray(options.getExtraActionGroups())
        ? options.getExtraActionGroups()
        : [];
      groups.forEach(function (group) {
        if (!group || !Array.isArray(group.actions) || group.actions.length <= 0) {
          return;
        }
        toolbarRoot.appendChild(createToolbarGroup(group.label || "扩展", group.actions));
      });
    }

    function removeToolbar() {
      if (toolbarRoot && toolbarRoot.parentNode) {
        toolbarRoot.parentNode.removeChild(toolbarRoot);
      }
      toolbarRoot = null;
    }

    function ensureToolbar() {
      if (!shouldShowToolbar()) {
        removeToolbar();
        return;
      }

      const toolbox = document.querySelector(".mark-toolbox");
      if (!toolbox) {
        return;
      }

      if (toolbarRoot && toolbarRoot.isConnected && toolbarRoot.parentNode === toolbox) {
        update();
        return;
      }

      const audioActionLabels = options.getAudioActionLabels();
      removeToolbar();
      toolbarRoot = document.createElement("div");
      toolbarRoot.setAttribute("data-asr-edge-judgement-toolbar", "true");
      Object.assign(toolbarRoot.style, {
        display: "flex",
        alignItems: "center",
        flex: "1 1 520px",
        gap: "8px",
        flexWrap: "wrap",
        minWidth: "280px",
        maxWidth: "760px",
        margin: "4px 12px",
        padding: "4px 6px",
        border: "1px solid #dbeafe",
        borderRadius: "8px",
        background: "rgba(248, 250, 252, 0.92)",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
      });

      toolbarRoot.appendChild(createToolbarGroup("判别", options.getChoiceActions()));
      toolbarRoot.appendChild(
        createToolbarGroup("音量", [
          { key: "volumeDown", label: audioActionLabels.volumeDown },
          { key: "volumeUp", label: audioActionLabels.volumeUp },
          { key: "volumeReset", label: audioActionLabels.volumeReset },
        ])
      );
      toolbarRoot.appendChild(
        createToolbarGroup("倍速", [
          { key: "rateDown", label: audioActionLabels.rateDown },
          { key: "rateUp", label: audioActionLabels.rateUp },
          { key: "rateReset", label: audioActionLabels.rateReset },
        ])
      );
      toolbarRoot.appendChild(
        createToolbarGroup("进退", [
          { key: "seekBackward", label: audioActionLabels.seekBackward },
          { key: "seekForward", label: audioActionLabels.seekForward },
        ])
      );
      appendExtraToolbarGroups();
      const breadcrumb = toolbox.querySelector(".mark-toolbox-breadcrumb-wrapper");
      if (breadcrumb && breadcrumb.nextSibling) {
        toolbox.insertBefore(toolbarRoot, breadcrumb.nextSibling);
        update();
        return;
      }

      if (breadcrumb) {
        toolbox.appendChild(toolbarRoot);
        update();
        return;
      }

      toolbox.insertBefore(toolbarRoot, toolbox.firstChild);
      update();
    }

    function scheduleMount() {
      if (toolbarMountTimer) {
        window.clearTimeout(toolbarMountTimer);
      }

      toolbarMountTimer = window.setTimeout(function () {
        toolbarMountTimer = null;
        ensureTopDuration();
        ensureToolbar();
      }, 120);
    }

    function start() {
      scheduleMount();
      if (toolbarObserver) {
        return;
      }

      toolbarObserver = new MutationObserver(function () {
        scheduleMount();
      });
      toolbarObserver.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    function stop() {
      if (toolbarMountTimer) {
        window.clearTimeout(toolbarMountTimer);
        toolbarMountTimer = null;
      }
      if (toolbarObserver) {
        toolbarObserver.disconnect();
        toolbarObserver = null;
      }
      removeToolbar();
      removeTopDuration();
    }

    return {
      start: start,
      stop: stop,
      update: update,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementToolbar = {
    createRuntime: createRuntime,
  };
})();
