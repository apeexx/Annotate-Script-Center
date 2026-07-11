(function () {
  if (globalThis.__ASREdgeAishellTechCnEnShortDramaUiPanelInstalled === true) {
    return;
  }
  globalThis.__ASREdgeAishellTechCnEnShortDramaUiPanelInstalled = true;

  const ROOT_ATTR = "data-aishell-cn-en-short-drama-media-panel";
  const STYLE_ID = "aishell-cn-en-short-drama-media-panel-style";

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function buildMediaRows(viewModel) {
    const model = viewModel && typeof viewModel === "object" ? viewModel : {};
    return [
      ["题目", normalizeText(model.title)],
      ["模板", normalizeText(model.template)],
      ["总时长", normalizeText(model.durationText)],
      ["分段数", normalizeText(model.segmentCount)],
      ["视频", model.hasVideo === true ? normalizeText(model.videoUrl) : "暂无视频"],
      ["音频", normalizeText(model.audioUrl)],
    ];
  }

  function ensureStyle(documentLike) {
    const source =
      documentLike && typeof documentLike.createElement === "function" ? documentLike : null;
    if (!source || source.getElementById(STYLE_ID)) {
      return;
    }
    const style = source.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "[" + ROOT_ATTR + "] {",
      "  margin: 0 0 16px;",
      "  border: 1px solid #d8e4ff;",
      "  border-radius: 16px;",
      "  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);",
      "  color: #1f2f52;",
      "  box-shadow: 0 6px 18px rgba(30, 64, 175, 0.08);",
      "  overflow: hidden;",
      "  font-size: 13px;",
      "  line-height: 1.65;",
      "}",
      "[" + ROOT_ATTR + "] * { box-sizing: border-box; }",
      "[" + ROOT_ATTR + "] .asc-media-header {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: space-between;",
      "  gap: 12px;",
      "  padding: 14px 18px;",
      "  border-bottom: 1px solid #e4edff;",
      "  background: linear-gradient(180deg, #f3f7ff 0%, #f9fbff 100%);",
      "}",
      "[" + ROOT_ATTR + "] .asc-media-title {",
      "  font-size: 22px;",
      "  font-weight: 700;",
      "  color: #23408d;",
      "}",
      "[" + ROOT_ATTR + "] .asc-media-toggle {",
      "  border: 1px solid #c7d6ff;",
      "  border-radius: 999px;",
      "  background: #ffffff;",
      "  color: #3159c8;",
      "  cursor: pointer;",
      "  padding: 8px 14px;",
      "  font-size: 12px;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] .asc-media-body { padding: 18px; }",
      "[" + ROOT_ATTR + "] .asc-media-grid {",
      "  display: grid;",
      "  grid-template-columns: 90px minmax(0, 1fr);",
      "  gap: 10px 14px;",
      "  align-items: start;",
      "}",
      "[" + ROOT_ATTR + "] .asc-media-label {",
      "  color: #2e58c0;",
      "  font-weight: 700;",
      "}",
      "[" + ROOT_ATTR + "] .asc-media-value {",
      "  color: #1f2f52;",
      "  white-space: pre-wrap;",
      "  overflow-wrap: anywhere;",
      "}",
      "[" + ROOT_ATTR + "] .asc-media-empty { color: #6b7a99; }",
      "[" + ROOT_ATTR + "] .asc-media-body[data-collapsed='true'] { display: none; }",
    ].join("\n");
    (source.head || source.documentElement).appendChild(style);
  }

  function createPanel(options) {
    const documentLike =
      options?.documentLike && typeof options.documentLike.createElement === "function"
        ? options.documentLike
        : document;
    let rootNode = null;
    let bodyNode = null;
    let toggleButton = null;
    let collapsed = false;

    function ensureRoot() {
      ensureStyle(documentLike);
      if (rootNode && documentLike.documentElement?.contains?.(rootNode)) {
        return rootNode;
      }

      rootNode = documentLike.createElement("section");
      rootNode.setAttribute(ROOT_ATTR, "true");

      const headerNode = documentLike.createElement("div");
      headerNode.className = "asc-media-header";

      const titleNode = documentLike.createElement("div");
      titleNode.className = "asc-media-title";
      titleNode.textContent = "当前媒体信息";
      headerNode.appendChild(titleNode);

      toggleButton = documentLike.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "asc-media-toggle";
      toggleButton.addEventListener("click", function () {
        setCollapsed(!collapsed);
      });
      headerNode.appendChild(toggleButton);
      rootNode.appendChild(headerNode);

      bodyNode = documentLike.createElement("div");
      bodyNode.className = "asc-media-body";
      rootNode.appendChild(bodyNode);

      syncCollapsedState();
      return rootNode;
    }

    function syncCollapsedState() {
      if (bodyNode) {
        bodyNode.setAttribute("data-collapsed", collapsed === true ? "true" : "false");
      }
      if (toggleButton) {
        toggleButton.textContent = collapsed === true ? "展开当前媒体信息" : "折叠当前媒体信息";
      }
    }

    function setCollapsed(nextCollapsed) {
      collapsed = nextCollapsed === true;
      syncCollapsedState();
    }

    function mount(anchor) {
      const target = anchor && typeof anchor.appendChild === "function" ? anchor : null;
      const root = ensureRoot();
      if (!target) {
        return root;
      }
      if (root.parentNode !== target) {
        target.prepend(root);
      }
      return root;
    }

    function render(viewModel) {
      const root = ensureRoot();
      if (!bodyNode) {
        return root;
      }
      bodyNode.textContent = "";

      const gridNode = documentLike.createElement("div");
      gridNode.className = "asc-media-grid";
      buildMediaRows(viewModel).forEach(function (row) {
        const labelNode = documentLike.createElement("div");
        labelNode.className = "asc-media-label";
        labelNode.textContent = row[0];
        gridNode.appendChild(labelNode);

        const valueNode = documentLike.createElement("div");
        valueNode.className = "asc-media-value";
        if (!normalizeText(row[1])) {
          valueNode.classList.add("asc-media-empty");
          valueNode.textContent = "暂无数据";
        } else {
          valueNode.textContent = row[1];
        }
        gridNode.appendChild(valueNode);
      });
      bodyNode.appendChild(gridNode);
      syncCollapsedState();
      return root;
    }

    function remove() {
      rootNode?.remove?.();
      rootNode = null;
      bodyNode = null;
      toggleButton = null;
    }

    return {
      mount: mount,
      remove: remove,
      render: render,
      setCollapsed: setCollapsed,
    };
  }

  const api = {
    createPanel: createPanel,
  };

  api.__test__ = {
    buildMediaRows: buildMediaRows,
  };

  globalThis.__ASREdgeAishellTechCnEnShortDramaUiPanel = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
