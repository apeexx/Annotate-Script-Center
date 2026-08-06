(function () {
  const PANEL_ATTR = "data-asr-edge-pulse-translation-panel";
  const RULE_TEXT = [
    "【物品名称和动作按照视频内的实际情况写，不要照抄模板】",
    "x手扶着架子，x手在桌面上翻面x色的颜料罐",
    "x手扶着架子，x手拿起桌面上的x色的颜料罐放到 上/下层 架子上（两个或三个相同颜色的颜料罐需要消歧）",
    "（超过10s分开切：",
    "x手扶着架子，x手拿起桌面上x色的颜料罐",
  ].join("\n");

  function findTranslationGroup(root) {
    const labels = Array.from(root && root.querySelectorAll ? root.querySelectorAll("span") : []);
    for (const label of labels) {
      if (String(label.textContent || "").trim() !== "中文翻译") {
        continue;
      }
      let node = label.parentElement;
      while (node) {
        if (typeof node.querySelector === "function" && node.querySelector("textarea")) {
          return node;
        }
        node = node.parentElement;
      }
    }
    return null;
  }

  function hasMountedPanel(group) {
    return Boolean(group && typeof group.querySelector === "function" && group.querySelector("[" + PANEL_ATTR + "]"));
  }

  function createHighlightParts(text, matches) {
    const value = String(text || "");
    const sourceMatches = Array.isArray(matches) ? matches : [];
    const validMatches = sourceMatches
      .filter(function (match) {
        return (
          match &&
          Number.isInteger(match.start) &&
          Number.isInteger(match.end) &&
          match.start >= 0 &&
          match.end > match.start &&
          match.end <= value.length
        );
      })
      .sort(function (left, right) {
        return left.start - right.start || right.end - left.end;
      });
    const parts = [];
    let cursor = 0;
    validMatches.forEach(function (match) {
      if (match.start < cursor) {
        return;
      }
      if (match.start > cursor) {
        parts.push({ type: "text", text: value.slice(cursor, match.start) });
      }
      parts.push({ type: "match", text: value.slice(match.start, match.end), term: match.term || "" });
      cursor = match.end;
    });
    if (cursor < value.length || !parts.length) {
      parts.push({ type: "text", text: value.slice(cursor) });
    }
    return parts;
  }

  function renderHighlightParts(container, text, matches) {
    const doc = container.ownerDocument;
    container.replaceChildren();
    createHighlightParts(text, matches).forEach(function (part) {
      if (part.type === "match") {
        const mark = doc.createElement("span");
        mark.textContent = part.text;
        mark.style.color = "#d4380d";
        mark.style.fontWeight = "700";
        mark.setAttribute("data-asr-edge-pulse-forbidden", "true");
        container.appendChild(mark);
        return;
      }
      container.appendChild(doc.createTextNode(part.text));
    });
  }

  function createPanel(group, textarea, getMatcher) {
    const doc = group.ownerDocument;
    const panel = doc.createElement("section");
    panel.setAttribute(PANEL_ATTR, "true");
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.gap = "6px";
    panel.style.marginTop = "8px";

    const actionRow = doc.createElement("div");
    actionRow.style.display = "flex";
    actionRow.style.alignItems = "center";
    actionRow.style.gap = "8px";
    const checkButton = doc.createElement("button");
    checkButton.type = "button";
    checkButton.textContent = "检查禁用词";
    checkButton.style.cursor = "pointer";
    checkButton.style.border = "1px solid var(--xdof-silver, #d9d9d9)";
    checkButton.style.borderRadius = "4px";
    checkButton.style.padding = "3px 9px";
    checkButton.style.background = "var(--xdof-white, #fff)";
    checkButton.style.color = "var(--xdof-black, #1f1f1f)";
    const status = doc.createElement("span");
    status.style.fontSize = "12px";
    status.style.color = "var(--xdof-slate, #5b6472)";
    actionRow.append(checkButton, status);

    const mirror = doc.createElement("div");
    mirror.setAttribute("data-asr-edge-pulse-forbidden-mirror", "true");
    mirror.setAttribute("aria-live", "polite");
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordBreak = "break-word";
    mirror.style.border = "1px solid var(--xdof-silver, #d9d9d9)";
    mirror.style.borderRadius = "4px";
    mirror.style.padding = "8px 11px";
    mirror.style.background = "var(--xdof-mist, #fafafa)";
    mirror.style.color = "var(--xdof-black, #1f1f1f)";
    mirror.style.fontSize = "14px";
    mirror.style.fontWeight = "500";
    mirror.style.lineHeight = "1.5";

    const details = doc.createElement("details");
    details.style.borderTop = "1px solid var(--xdof-silver, #d9d9d9)";
    details.style.paddingTop = "6px";
    const summary = doc.createElement("summary");
    summary.textContent = "标注规则";
    summary.style.cursor = "pointer";
    summary.style.fontSize = "12px";
    summary.style.fontWeight = "600";
    const rules = doc.createElement("div");
    rules.textContent = RULE_TEXT;
    rules.style.whiteSpace = "pre-wrap";
    rules.style.marginTop = "6px";
    rules.style.fontSize = "12px";
    rules.style.lineHeight = "1.6";
    rules.style.color = "var(--xdof-slate, #5b6472)";
    details.append(summary, rules);
    panel.append(actionRow, mirror, details);
    textarea.insertAdjacentElement("afterend", panel);

    function renderUnverified(message) {
      renderHighlightParts(mirror, textarea.value, []);
      status.textContent = message;
    }

    function handleInput() {
      renderUnverified("内容已变更，请重新检查。");
    }

    async function handleCheck() {
      const value = String(textarea.value || "");
      if (!value) {
        renderHighlightParts(mirror, value, []);
        status.textContent = "当前文本为空。";
        return;
      }
      checkButton.disabled = true;
      status.textContent = "正在检查…";
      try {
        const matcher = await getMatcher();
        if (!matcher || typeof matcher.find !== "function") {
          throw new Error("禁用词表不可用。");
        }
        const matches = matcher.find(value);
        renderHighlightParts(mirror, value, matches);
        status.textContent = matches.length ? "发现 " + matches.length + " 处禁用词，已标红。" : "未发现禁用词。";
      } catch (error) {
        renderHighlightParts(mirror, value, []);
        status.textContent = "禁用词表加载失败，无法检查。";
      } finally {
        checkButton.disabled = false;
      }
    }

    textarea.addEventListener("input", handleInput);
    checkButton.addEventListener("click", handleCheck);
    renderUnverified("点击“检查禁用词”开始核查。");
    return {
      node: panel,
      destroy: function () {
        textarea.removeEventListener("input", handleInput);
        checkButton.removeEventListener("click", handleCheck);
        panel.remove();
      },
    };
  }

  function mount(root, getMatcher) {
    const group = findTranslationGroup(root);
    const textarea = group && group.querySelector("textarea");
    if (!group || !textarea) {
      return null;
    }
    if (hasMountedPanel(group)) {
      return { node: group.querySelector("[" + PANEL_ATTR + "]"), destroy: function () {} };
    }
    return createPanel(group, textarea, getMatcher);
  }

  function removeAll(root) {
    Array.from(root && root.querySelectorAll ? root.querySelectorAll("[" + PANEL_ATTR + "]") : []).forEach(
      function (node) {
        node.remove();
      }
    );
  }

  globalThis.ASREdgePulseUiPanel = {
    PANEL_ATTR: PANEL_ATTR,
    RULE_TEXT: RULE_TEXT,
    findTranslationGroup: findTranslationGroup,
    hasMountedPanel: hasMountedPanel,
    createHighlightParts: createHighlightParts,
    mount: mount,
    removeAll: removeAll,
  };
})();
