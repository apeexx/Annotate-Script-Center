"use strict";

(function initOptionsSharedSelect(globalObject) {
  const controllers = new WeakMap();
  let activeWrapper = null;
  let layerNode = null;
  let menuNode = null;
  let documentListenersBound = false;
  let activeViewportListenerCleanup = null;

  function isElement(node) {
    return typeof globalObject.HTMLElement !== "undefined" && node instanceof globalObject.HTMLElement;
  }

  function isSelect(node) {
    return typeof globalObject.HTMLSelectElement !== "undefined" && node instanceof globalObject.HTMLSelectElement;
  }

  function isButton(node) {
    return typeof globalObject.HTMLButtonElement !== "undefined" && node instanceof globalObject.HTMLButtonElement;
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function getWindowObject() {
    return globalObject.window && typeof globalObject.window === "object"
      ? globalObject.window
      : globalObject;
  }

  function getComputedStyleObject(node) {
    if (!isElement(node)) {
      return null;
    }
    if (typeof globalObject.getComputedStyle === "function") {
      return globalObject.getComputedStyle(node);
    }
    const windowObject = getWindowObject();
    if (windowObject && typeof windowObject.getComputedStyle === "function") {
      return windowObject.getComputedStyle(node);
    }
    return null;
  }

  function clearChildren(node) {
    if (!isElement(node) || !Array.isArray(node.children)) {
      if (isElement(node) && "innerHTML" in node) {
        node.innerHTML = "";
      }
      return;
    }
    while (node.children.length > 0) {
      node.removeChild(node.children[0]);
    }
  }

  function syncLayerVisibility() {
    const visible = isElement(menuNode) && menuNode.hidden !== true;
    if (!isElement(layerNode)) {
      return;
    }
    layerNode.classList.toggle("hidden", !visible);
    layerNode.hidden = !visible;
    layerNode.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function ensureLayer() {
    const documentNode = globalObject.document;
    if (!documentNode || typeof documentNode.getElementById !== "function") {
      return null;
    }
    const nextLayerNode = documentNode.getElementById("detail-select-layer");
    if (!isElement(nextLayerNode)) {
      return null;
    }
    layerNode = nextLayerNode;
    if (!(isElement(menuNode)) || !layerNode.contains(menuNode)) {
      const nextMenuNode = documentNode.createElement("div");
      nextMenuNode.id = "detail-select-menu";
      nextMenuNode.className = "options-select-menu detail-select-layer-menu";
      nextMenuNode.setAttribute("role", "listbox");
      nextMenuNode.hidden = true;
      nextMenuNode.setAttribute("data-open", "");
      nextMenuNode.setAttribute("data-placement", "");
      layerNode.appendChild(nextMenuNode);
      menuNode = nextMenuNode;
    }
    syncLayerVisibility();
    return layerNode;
  }

  function getController(target) {
    if (isSelect(target)) {
      return controllers.get(target) || null;
    }
    if (!isElement(target)) {
      return null;
    }
    const wrapperNode = target.classList.contains("options-custom-select")
      ? target
      : target.closest(".options-custom-select");
    if (!isElement(wrapperNode)) {
      return null;
    }
    const selectNode = wrapperNode.querySelector("select[data-options-custom-select='true']");
    return isSelect(selectNode) ? controllers.get(selectNode) || null : null;
  }

  function getMenuItems() {
    if (!isElement(menuNode) || typeof menuNode.querySelectorAll !== "function") {
      return [];
    }
    return Array.from(menuNode.querySelectorAll(".options-select-option")).filter(function (node) {
      return isButton(node);
    });
  }

  function getPlaceholder(selectNode) {
    if (!isSelect(selectNode)) {
      return "";
    }
    return normalizeText(selectNode.getAttribute("data-options-placeholder"));
  }

  function clearActiveViewportListeners() {
    if (typeof activeViewportListenerCleanup === "function") {
      activeViewportListenerCleanup();
    }
    activeViewportListenerCleanup = null;
  }

  function isScrollableElement(node) {
    if (!isElement(node)) {
      return false;
    }
    if (node.getAttribute("data-options-scroll-container") === "true") {
      return true;
    }
    const computedStyle = getComputedStyleObject(node);
    const overflowX = String(
      computedStyle?.overflowX || computedStyle?.overflow || ""
    ).toLowerCase();
    const overflowY = String(
      computedStyle?.overflowY || computedStyle?.overflow || ""
    ).toLowerCase();
    const canScrollByStyle =
      /(auto|scroll|overlay)/.test(overflowX) || /(auto|scroll|overlay)/.test(overflowY);
    if (!canScrollByStyle) {
      return false;
    }
    const clientHeight = Number(node.clientHeight || node.offsetHeight || 0);
    const clientWidth = Number(node.clientWidth || node.offsetWidth || 0);
    const scrollHeight = Number(node.scrollHeight || 0);
    const scrollWidth = Number(node.scrollWidth || 0);
    return scrollHeight > clientHeight + 1 || scrollWidth > clientWidth + 1;
  }

  function getScrollContainerNodes(node) {
    const containers = [];
    const seen = new Set();
    let current = isElement(node) ? node.parentElement : null;
    while (isElement(current)) {
      if (isScrollableElement(current) && !seen.has(current)) {
        seen.add(current);
        containers.push(current);
      }
      current = current.parentElement;
    }
    return containers;
  }

  function bindViewportCloseListeners(controller) {
    clearActiveViewportListeners();
    if (!controller || !isElement(controller.wrapper)) {
      return;
    }
    const cleanupTasks = [];
    const addScopedListener = function (target, type, listener) {
      if (!target || typeof target.addEventListener !== "function") {
        return;
      }
      target.addEventListener(type, listener);
      cleanupTasks.push(function () {
        if (typeof target.removeEventListener === "function") {
          target.removeEventListener(type, listener);
        }
      });
    };
    const handleViewportChange = function () {
      if (activeWrapper === controller.wrapper) {
        closeCustomSelect(controller.wrapper);
      }
    };
    const windowObject = getWindowObject();
    addScopedListener(windowObject, "resize", handleViewportChange);
    addScopedListener(windowObject, "scroll", handleViewportChange);
    getScrollContainerNodes(controller.wrapper).forEach(function (node) {
      addScopedListener(node, "scroll", handleViewportChange);
    });
    activeViewportListenerCleanup = function () {
      while (cleanupTasks.length > 0) {
        const cleanup = cleanupTasks.pop();
        if (typeof cleanup === "function") {
          cleanup();
        }
      }
    };
  }

  function closeCustomSelect(target) {
    const controller = getController(target);
    if (!controller) {
      if (isElement(target)) {
        target.setAttribute("data-open", "");
        target.setAttribute("data-highlight-index", "");
      }
      return;
    }
    controller.wrapper.setAttribute("data-open", "");
    controller.wrapper.setAttribute("data-highlight-index", "");
    controller.trigger.setAttribute("aria-expanded", "false");
    if (activeWrapper === controller.wrapper) {
      activeWrapper = null;
      clearActiveViewportListeners();
      if (isElement(menuNode)) {
        menuNode.hidden = true;
        clearChildren(menuNode);
        menuNode.setAttribute("data-open", "");
        menuNode.setAttribute("data-placement", "");
      }
      syncLayerVisibility();
    }
  }

  function resolveExceptWrapper(exceptNode) {
    const controller = getController(exceptNode);
    if (controller) {
      return controller.wrapper;
    }
    if (isElement(exceptNode) && exceptNode.classList.contains("options-custom-select")) {
      return exceptNode;
    }
    return null;
  }

  function closeAllCustomSelects(exceptNode) {
    const documentNode = globalObject.document;
    if (!documentNode || typeof documentNode.querySelectorAll !== "function") {
      return;
    }
    const exceptWrapper = resolveExceptWrapper(exceptNode);
    Array.from(documentNode.querySelectorAll(".options-custom-select[data-open='true']")).forEach(
      function (node) {
        if (!isElement(node) || node === exceptWrapper) {
          return;
        }
        closeCustomSelect(node);
      }
    );
  }

  function closeOpenCustomSelects(exceptNode) {
    const exceptWrapper = resolveExceptWrapper(exceptNode);
    if (isElement(activeWrapper) && activeWrapper !== exceptWrapper) {
      closeCustomSelect(activeWrapper);
    }
    closeAllCustomSelects(exceptWrapper);
  }

  function setHighlight(wrapper, nextIndex) {
    const controller = getController(wrapper);
    const items = getMenuItems();
    if (!controller || items.length <= 0) {
      if (controller) {
        controller.wrapper.setAttribute("data-highlight-index", "");
      }
      return;
    }
    const safeIndex = Math.max(0, Math.min(Number(nextIndex) || 0, items.length - 1));
    controller.wrapper.setAttribute("data-highlight-index", String(safeIndex));
    items.forEach(function (item, index) {
      const highlighted = index === safeIndex;
      item.classList.toggle("is-highlighted", highlighted);
      if (highlighted) {
        item.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function renderMenu(controller) {
    const layer = ensureLayer();
    if (!controller || !isElement(layer) || !isElement(menuNode)) {
      return;
    }
    clearChildren(menuNode);
    let selectedIndex = Math.max(0, controller.selectNode.selectedIndex);
    Array.from(controller.selectNode.options || []).forEach(function (optionNode, index) {
      const itemNode = globalObject.document.createElement("button");
      itemNode.type = "button";
      itemNode.className = "options-select-option";
      itemNode.setAttribute("role", "option");
      itemNode.setAttribute("data-index", String(index));
      itemNode.setAttribute("data-value", String(optionNode.value || ""));
      itemNode.textContent = normalizeText(optionNode.textContent || optionNode.value || "");
      if (optionNode.disabled === true) {
        itemNode.disabled = true;
      }
      const selected = String(optionNode.value || "") === String(controller.selectNode.value || "");
      itemNode.classList.toggle("is-selected", selected);
      itemNode.setAttribute("aria-selected", selected ? "true" : "false");
      if (selected) {
        selectedIndex = index;
      }
      itemNode.addEventListener("mouseenter", function () {
        setHighlight(controller.wrapper, index);
      });
      itemNode.addEventListener("click", function () {
        if (itemNode.disabled) {
          return;
        }
        chooseSelectValue(controller.selectNode, optionNode.value);
      });
      menuNode.appendChild(itemNode);
    });
    setHighlight(controller.wrapper, selectedIndex);
  }

  function positionMenu(target) {
    const controller = getController(target);
    const layer = ensureLayer();
    if (!controller || !isElement(layer) || !isElement(menuNode)) {
      return;
    }
    const viewportPadding = 12;
    const gap = 8;
    const menuMaxHeight = 280;
    const triggerRect = controller.trigger.getBoundingClientRect();
    const windowObject = getWindowObject();
    const viewportWidth = Number(windowObject.innerWidth || 0) || 1280;
    const viewportHeight = Number(windowObject.innerHeight || 0) || 720;
    const measuredWidth = Math.max(Math.round(Number(triggerRect.width) || 0), 180);
    menuNode.style.position = "absolute";
    menuNode.style.width = measuredWidth + "px";
    menuNode.style.minWidth = measuredWidth + "px";
    menuNode.style.left = "0px";
    menuNode.style.top = "0px";
    menuNode.style.maxHeight = menuMaxHeight + "px";
    menuNode.hidden = false;
    menuNode.style.visibility = "hidden";
    const menuHeight = Math.min(Number(menuNode.scrollHeight || menuNode.offsetHeight || 0), menuMaxHeight);
    const spaceBelow = viewportHeight - Number(triggerRect.bottom || 0) - gap - viewportPadding;
    const spaceAbove = Number(triggerRect.top || 0) - gap - viewportPadding;
    const shouldFlipUp =
      spaceBelow < Math.min(menuHeight || menuMaxHeight, 180) && spaceAbove > spaceBelow;
    const availableHeight = shouldFlipUp ? spaceAbove : spaceBelow;
    const safeMaxHeight = Math.max(
      96,
      Math.min(menuMaxHeight, availableHeight > 0 ? availableHeight : menuMaxHeight)
    );
    const maxLeft = Math.max(viewportPadding, viewportWidth - viewportPadding - measuredWidth);
    const left = Math.min(Math.max(viewportPadding, Number(triggerRect.left || 0)), maxLeft);
    let top = shouldFlipUp
      ? Number(triggerRect.top || 0) - gap - Math.min(menuHeight || safeMaxHeight, safeMaxHeight)
      : Number(triggerRect.bottom || 0) + gap;
    top = Math.max(viewportPadding, Math.min(top, viewportHeight - viewportPadding - safeMaxHeight));
    menuNode.style.left = Math.round(left) + "px";
    menuNode.style.top = Math.round(top) + "px";
    menuNode.style.maxHeight = Math.round(safeMaxHeight) + "px";
    menuNode.style.visibility = "";
    menuNode.setAttribute("data-placement", shouldFlipUp ? "top" : "bottom");
    menuNode.setAttribute("data-open", "true");
    syncLayerVisibility();
  }

  function syncCustomSelectState(selectNode) {
    if (!isSelect(selectNode)) {
      return;
    }
    const controller = getController(selectNode);
    if (!controller) {
      return;
    }
    const selectedIndex = selectNode.selectedIndex >= 0 ? selectNode.selectedIndex : 0;
    const selectedOption = selectNode.options[selectedIndex] || null;
    const selectedValue = normalizeText(selectNode.value);
    const placeholder = getPlaceholder(selectNode);
    const usePlaceholder = Boolean(placeholder) && !selectedValue;
    controller.trigger.disabled = selectNode.disabled === true;
    controller.label.textContent =
      (usePlaceholder ? placeholder : normalizeText(selectedOption?.textContent || "")) || "请选择";
    controller.label.classList.toggle("is-placeholder", usePlaceholder);
    if (activeWrapper === controller.wrapper) {
      renderMenu(controller);
      positionMenu(controller.wrapper);
    }
  }

  function openCustomSelect(target) {
    const controller = getController(target);
    if (!controller || controller.trigger.disabled) {
      return;
    }
    closeAllCustomSelects(controller.wrapper);
    controller.wrapper.setAttribute("data-open", "true");
    controller.trigger.setAttribute("aria-expanded", "true");
    activeWrapper = controller.wrapper;
    renderMenu(controller);
    positionMenu(controller.wrapper);
    bindViewportCloseListeners(controller);
  }

  function chooseSelectValue(selectNode, value) {
    if (!isSelect(selectNode)) {
      return;
    }
    const controller = getController(selectNode);
    if (String(selectNode.value || "") === String(value || "")) {
      syncCustomSelectState(selectNode);
      if (controller) {
        closeCustomSelect(controller.wrapper);
      }
      return;
    }
    selectNode.value = String(value || "");
    syncCustomSelectState(selectNode);
    if (typeof globalObject.Event === "function") {
      selectNode.dispatchEvent(new globalObject.Event("change", { bubbles: true }));
    }
    if (controller) {
      closeCustomSelect(controller.wrapper);
      controller.trigger.focus();
    }
  }

  function moveHighlight(target, direction) {
    const controller = getController(target);
    const items = getMenuItems();
    if (!controller || items.length <= 0) {
      return;
    }
    const currentIndex = Math.max(
      0,
      Number(controller.wrapper.getAttribute("data-highlight-index") || 0)
    );
    const nextIndex = currentIndex + (direction < 0 ? -1 : 1);
    const normalizedIndex =
      nextIndex < 0 ? items.length - 1 : nextIndex >= items.length ? 0 : nextIndex;
    setHighlight(controller.wrapper, normalizedIndex);
  }

  function bindGlobalListeners() {
    if (documentListenersBound) {
      return;
    }
    const documentNode = globalObject.document;
    if (documentNode && typeof documentNode.addEventListener === "function") {
      documentNode.addEventListener("click", function (event) {
        const target = isElement(event?.target) ? event.target : null;
        if (
          target &&
          (target.closest(".options-custom-select") || target.closest(".options-select-menu"))
        ) {
          return;
        }
        closeOpenCustomSelects(null);
      });
    }
    documentListenersBound = true;
  }

  function ensureCustomSelect(selectNode) {
    if (!isSelect(selectNode)) {
      return;
    }
    let controller = controllers.get(selectNode) || null;
    if (
      controller &&
      (!(isElement(controller.wrapper)) ||
        !(isButton(controller.trigger)) ||
        !(isElement(controller.label)) ||
        controller.wrapper.isConnected !== true ||
        !controller.wrapper.contains(selectNode))
    ) {
      controllers.delete(selectNode);
      controller = null;
    }
    if (!controller) {
      let wrapperNode = selectNode.closest(".options-custom-select");
      if (!isElement(wrapperNode)) {
        const parentNode = selectNode.parentElement;
        if (!isElement(parentNode)) {
          return;
        }
        wrapperNode = globalObject.document.createElement("div");
        wrapperNode.className = "options-custom-select";
        wrapperNode.setAttribute("data-open", "");
        wrapperNode.setAttribute("data-highlight-index", "");
        parentNode.insertBefore(wrapperNode, selectNode);
        wrapperNode.appendChild(selectNode);
      }
      selectNode.classList.add("options-select-native");
      let triggerNode = wrapperNode.querySelector(".options-select-trigger");
      if (!isButton(triggerNode)) {
        triggerNode = globalObject.document.createElement("button");
        triggerNode.type = "button";
        triggerNode.className = "options-select-trigger";
        triggerNode.setAttribute("aria-haspopup", "listbox");
        triggerNode.setAttribute("aria-expanded", "false");
        const labelNode = globalObject.document.createElement("span");
        labelNode.className = "options-select-trigger-label";
        const iconNode = globalObject.document.createElement("span");
        iconNode.className = "options-select-trigger-icon";
        iconNode.setAttribute("aria-hidden", "true");
        triggerNode.appendChild(labelNode);
        triggerNode.appendChild(iconNode);
        wrapperNode.appendChild(triggerNode);
      }
      const labelNode = triggerNode.querySelector(".options-select-trigger-label");
      if (!isElement(labelNode)) {
        return;
      }
      controller = {
        selectNode: selectNode,
        wrapper: wrapperNode,
        trigger: triggerNode,
        label: labelNode,
      };
      controllers.set(selectNode, controller);
      triggerNode.addEventListener("click", function () {
        const isOpen = wrapperNode.getAttribute("data-open") === "true";
        if (isOpen) {
          closeCustomSelect(wrapperNode);
          return;
        }
        openCustomSelect(wrapperNode);
      });
      triggerNode.addEventListener("keydown", function (event) {
        const key = String(event?.key || "");
        const normalizedKey = normalizeText(key);
        if (normalizedKey === "ArrowDown" || normalizedKey === "Down") {
          event.preventDefault();
          if (wrapperNode.getAttribute("data-open") !== "true") {
            openCustomSelect(wrapperNode);
            return;
          }
          moveHighlight(wrapperNode, 1);
          return;
        }
        if (normalizedKey === "ArrowUp" || normalizedKey === "Up") {
          event.preventDefault();
          if (wrapperNode.getAttribute("data-open") !== "true") {
            openCustomSelect(wrapperNode);
            return;
          }
          moveHighlight(wrapperNode, -1);
          return;
        }
        if (normalizedKey === "Enter" || key === " " || normalizedKey === "Spacebar") {
          event.preventDefault();
          if (wrapperNode.getAttribute("data-open") !== "true") {
            openCustomSelect(wrapperNode);
            return;
          }
          const items = getMenuItems();
          const highlightIndex = Math.max(
            0,
            Number(wrapperNode.getAttribute("data-highlight-index") || 0)
          );
          const itemNode = items[highlightIndex];
          if (isButton(itemNode) && itemNode.disabled !== true) {
            chooseSelectValue(selectNode, itemNode.getAttribute("data-value") || "");
          }
          return;
        }
        if (normalizedKey === "Escape" || normalizedKey === "Esc") {
          event.preventDefault();
          closeCustomSelect(wrapperNode);
        }
      });
      selectNode.addEventListener("change", function () {
        syncCustomSelectState(selectNode);
      });
    }

    syncCustomSelectState(selectNode);
    bindGlobalListeners();
  }

  function syncCustomSelects(scope) {
    const selectNodes = [];
    if (isSelect(scope) && scope.getAttribute("data-options-custom-select") === "true") {
      selectNodes.push(scope);
    } else if (scope && typeof scope.querySelectorAll === "function") {
      Array.from(scope.querySelectorAll("select[data-options-custom-select='true']")).forEach(
        function (node) {
          if (isSelect(node)) {
            selectNodes.push(node);
          }
        }
      );
    }
    selectNodes.forEach(ensureCustomSelect);
    return scope;
  }

  const api = {
    syncCustomSelects: syncCustomSelects,
    syncCustomSelectState: syncCustomSelectState,
    closeAllCustomSelects: closeAllCustomSelects,
  };

  globalObject.ASREdgeOptionsSharedSelect = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
