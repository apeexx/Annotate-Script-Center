(function () {
  const TARGET_FIELDS = ["same_font", "image_b_texts_removed", "other_changes"];
  const IMAGE_FIELDS = ["image_a", "image_b", "image_b_removed"];
  const ITEM_INFO_PATH = "/api/v2/item/get-item-info";

  const IMAGE_KEY_CANDIDATES = {
    image_a: ["image_a", "imagea", "image_a_url", "imageaurl"],
    image_b: ["image_b", "imageb", "image_b_url", "imageburl"],
    image_b_removed: [
      "image_b_removed",
      "imagebremoved",
      "image_b_removed_url",
      "imagebremovedurl",
      "image_b_remove",
    ],
  };

  const TEXT_KEY_CANDIDATES = {
    imageATexts: ["image_a_texts", "imageatexts", "image_a_text", "imageatext"],
    imageBTexts: ["image_b_texts", "imagebtexts", "image_b_text", "imagebtext"],
    textPositions: ["text_positions", "textpositions", "positions", "bbox", "boxes"],
  };

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeLower(value) {
    return normalizeText(value).toLowerCase();
  }

  function isVisible(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    const style = window.getComputedStyle(node);
    if (!style || style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isItemsPage() {
    const pathname = String(location.pathname || "");
    return pathname === "/items" || pathname.indexOf("/items") >= 0;
  }

  function isViewMode() {
    const params = new URLSearchParams(location.search || "");
    return params.get("viewMode") === "true";
  }

  function findTitleNodeExact(text) {
    const target = normalizeLower(text);
    if (!target) {
      return null;
    }
    const nodes = document.querySelectorAll(".l-title-text,div,span,label,strong,p");
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (!isVisible(node)) {
        continue;
      }
      if (normalizeLower(node.textContent || "") === target) {
        return node;
      }
    }
    return null;
  }

  function findFieldContainer(fieldName) {
    const titleNode = findTitleNodeExact(fieldName);
    if (!titleNode) {
      return null;
    }
    return titleNode.closest(".l-item") || titleNode.parentElement || null;
  }

  function extractOptionText(node) {
    if (!(node instanceof Element)) {
      return "";
    }
    if (node instanceof HTMLInputElement) {
      const labelNode = node.closest("label");
      return normalizeText(labelNode ? labelNode.textContent : node.value || "");
    }
    return normalizeText(node.textContent || node.getAttribute("aria-label") || "");
  }

  function findSelectedOptionText(container) {
    if (!(container instanceof Element)) {
      return "";
    }
    const checkedInput = container.querySelector("input[type='radio']:checked,input[type='checkbox']:checked");
    if (checkedInput) {
      const text = extractOptionText(checkedInput);
      if (text) {
        return text;
      }
    }

    const checkedRole = container.querySelector("[role='radio'][aria-checked='true'],[role='checkbox'][aria-checked='true']");
    if (checkedRole) {
      const text = extractOptionText(checkedRole);
      if (text) {
        return text;
      }
    }

    const marked = container.querySelector(
      ".checked,.selected,.is-checked,.active,.ant-radio-wrapper-checked,.el-radio.is-checked,[data-selected='true'],[data-checked='true']"
    );
    if (marked) {
      const text = extractOptionText(marked);
      if (text) {
        return text;
      }
    }
    return "";
  }

  function collectTextInputValue(container) {
    if (!(container instanceof Element)) {
      return "";
    }
    const inputs = container.querySelectorAll(
      "textarea,input[type='text'],[contenteditable='true'],[contenteditable=''],[role='textbox']"
    );
    for (let index = 0; index < inputs.length; index += 1) {
      const node = inputs[index];
      if (!isVisible(node)) {
        continue;
      }
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
        const value = normalizeText(node.value || "");
        if (value) {
          return value.slice(0, 2000);
        }
        continue;
      }
      const text = normalizeText(node.textContent || "");
      if (text) {
        return text.slice(0, 2000);
      }
    }
    return "";
  }

  function collectFieldValue(fieldName) {
    const container = findFieldContainer(fieldName);
    if (!container) {
      return {
        exists: false,
        selectedOption: "",
        textValue: "",
      };
    }
    return {
      exists: true,
      selectedOption: findSelectedOptionText(container),
      textValue: collectTextInputValue(container),
    };
  }

  function collectCurrentPageValues() {
    const sameFont = collectFieldValue("same_font");
    const removed = collectFieldValue("image_b_texts_removed");
    const other = collectFieldValue("other_changes");
    return {
      same_font: sameFont.selectedOption,
      image_b_texts_removed: removed.textValue || removed.selectedOption,
      other_changes: other.textValue || other.selectedOption,
      same_font_exists: sameFont.exists,
      image_b_texts_removed_exists: removed.exists,
      other_changes_exists: other.exists,
    };
  }

  function collectTargetRemovalTextHints(currentPageValues) {
    const hints = [];
    const rawValue = normalizeText(currentPageValues?.image_b_texts_removed || "");
    const lowered = normalizeLower(rawValue);
    if (
      rawValue &&
      lowered !== "true" &&
      lowered !== "null" &&
      lowered !== "specify" &&
      lowered !== "not_applicable"
    ) {
      rawValue.split(/\r?\n/).forEach(function (line) {
        const text = normalizeText(line);
        if (!text) {
          return;
        }
        hints.push(text.slice(0, 240));
      });
    }
    return hints.slice(0, 12);
  }

  function sanitizeQueryValue(value) {
    const text = normalizeText(value);
    if (!text) {
      return "";
    }
    return text.slice(0, 120);
  }

  function collectRouteContext() {
    const params = new URLSearchParams(location.search || "");
    return {
      taskId: sanitizeQueryValue(params.get("taskId")),
      itemId: sanitizeQueryValue(params.get("itemId")),
      nodeId: sanitizeQueryValue(params.get("nodeId")),
      viewMode: sanitizeQueryValue(params.get("viewMode")),
      path: String(location.pathname || ""),
    };
  }

  function hasSameFontField() {
    return Boolean(findFieldContainer("same_font"));
  }

  function safeJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  function collectObjectPaths(target, basePath, result, depth) {
    if (depth > 8 || target === null || target === undefined) {
      return;
    }
    if (Array.isArray(target)) {
      target.forEach(function (item, index) {
        collectObjectPaths(item, basePath.concat(String(index)), result, depth + 1);
      });
      return;
    }
    if (typeof target !== "object") {
      return;
    }

    Object.keys(target).forEach(function (key) {
      const value = target[key];
      const path = basePath.concat(key);
      const normalizedKey = String(key || "").toLowerCase();
      result.push({
        key: normalizedKey,
        path: path,
        value: value,
      });
      collectObjectPaths(value, path, result, depth + 1);
    });
  }

  function findCandidatesByKeys(root, candidates) {
    const list = [];
    collectObjectPaths(root, [], list, 0);
    const lowerCandidates = Array.isArray(candidates)
      ? candidates.map(function (item) {
          return String(item || "").toLowerCase();
        })
      : [];

    return list
      .filter(function (entry) {
        return lowerCandidates.indexOf(entry.key) >= 0;
      })
      .map(function (entry) {
        return {
          path: entry.path.join("."),
          value: entry.value,
        };
      });
  }

  function pickFirstNonEmptyString(candidates) {
    for (let index = 0; index < candidates.length; index += 1) {
      const value = candidates[index] && candidates[index].value;
      if (typeof value === "string" && normalizeText(value)) {
        return {
          path: candidates[index].path,
          value: value,
        };
      }
      if (value && typeof value === "object") {
        const nested = [value.url, value.src, value.path, value.link, value.value]
          .filter(function (item) {
            return typeof item === "string" && normalizeText(item);
          })
          .map(function (item) {
            return normalizeText(item);
          });
        if (nested.length > 0) {
          return {
            path: candidates[index].path,
            value: nested[0],
          };
        }
      }
    }
    return null;
  }

  function pickFirstUsefulValue(candidates) {
    for (let index = 0; index < candidates.length; index += 1) {
      const value = candidates[index] && candidates[index].value;
      if (value === null || value === undefined) {
        continue;
      }
      if (typeof value === "string" && normalizeText(value).length === 0) {
        continue;
      }
      return {
        path: candidates[index].path,
        value: value,
      };
    }
    return null;
  }

  function guessMimeFromSource(source) {
    const text = String(source || "").trim();
    if (!text) {
      return "image/unknown";
    }
    if (text.indexOf("data:image/") === 0) {
      const matched = text.match(/^data:(image\/[^;]+);/i);
      return matched ? matched[1].toLowerCase() : "image/unknown";
    }
    const lower = text.toLowerCase();
    if (lower.indexOf(".png") >= 0) {
      return "image/png";
    }
    if (lower.indexOf(".jpg") >= 0 || lower.indexOf(".jpeg") >= 0) {
      return "image/jpeg";
    }
    if (lower.indexOf(".webp") >= 0) {
      return "image/webp";
    }
    if (lower.indexOf(".gif") >= 0) {
      return "image/gif";
    }
    return "image/unknown";
  }

  function estimateDataUrlBytes(dataUrl) {
    const text = String(dataUrl || "");
    const marker = text.indexOf(",");
    if (marker < 0) {
      return null;
    }
    const base64 = text.slice(marker + 1).replace(/\s+/g, "");
    if (!base64) {
      return 0;
    }
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    const bytes = Math.floor((base64.length * 3) / 4) - padding;
    return bytes > 0 ? bytes : 0;
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(reader.error || new Error("blob-read-failed"));
      };
      reader.readAsDataURL(blob);
    });
  }

  async function tryConvertUrlToDataUrl(url) {
    const source = String(url || "").trim();
    if (!source) {
      return {
        dataUrl: "",
        sourceKind: "unknown",
        bytes: null,
      };
    }
    if (source.indexOf("data:image/") === 0) {
      return {
        dataUrl: source,
        sourceKind: "dataUrl",
        bytes: estimateDataUrlBytes(source),
      };
    }
    try {
      const response = await fetch(source, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("fetch-image-failed");
      }
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      return {
        dataUrl: dataUrl,
        sourceKind: "dataUrl",
        bytes: Number(blob.size) || estimateDataUrlBytes(dataUrl),
      };
    } catch (error) {
      return {
        dataUrl: "",
        sourceKind: "url",
        bytes: null,
      };
    }
  }

  function findImageByContentTitle(fieldName) {
    const target = normalizeLower(fieldName);
    const titleNodes = document.querySelectorAll(".content-title span,.content-title,.content-wrap .content-title");
    for (let index = 0; index < titleNodes.length; index += 1) {
      const node = titleNodes[index];
      if (!isVisible(node)) {
        continue;
      }
      if (normalizeLower(node.textContent || "") !== target) {
        continue;
      }
      const wrap = node.closest(".content-wrap.grid-item,.content-wrap,.grid-item") || node.parentElement;
      if (!(wrap instanceof Element)) {
        continue;
      }
      const imageInViewer = Array.from(wrap.querySelectorAll(".content-image-view img,img"))
        .filter(function (img) {
          return img instanceof HTMLImageElement;
        })
        .sort(function (a, b) {
          const aVisible = isVisible(a) ? 1 : 0;
          const bVisible = isVisible(b) ? 1 : 0;
          return bVisible - aVisible;
        });
      if (imageInViewer.length > 0) {
        return imageInViewer[0];
      }
    }
    return null;
  }

  function collectVisibleImages() {
    return Array.from(document.querySelectorAll("img")).filter(function (img) {
      return img instanceof HTMLImageElement && isVisible(img);
    });
  }

  async function buildImageRecord(fieldName, imageUrl, imageNode) {
    const sourceUrl = String(imageUrl || "").trim();
    const converted = await tryConvertUrlToDataUrl(sourceUrl);
    const widthFromNode = imageNode instanceof HTMLImageElement ? Number(imageNode.naturalWidth || imageNode.width || 0) : 0;
    const heightFromNode = imageNode instanceof HTMLImageElement ? Number(imageNode.naturalHeight || imageNode.height || 0) : 0;
    return {
      fieldName: fieldName,
      dataUrl: converted.dataUrl,
      imageUrl: converted.dataUrl ? "" : sourceUrl,
      mime: guessMimeFromSource(converted.dataUrl || sourceUrl),
      width: widthFromNode > 0 ? widthFromNode : "unknown",
      height: heightFromNode > 0 ? heightFromNode : "unknown",
      bytes: converted.bytes !== null && converted.bytes !== undefined ? converted.bytes : "unknown",
      sourceKind: converted.sourceKind,
    };
  }

  async function collectItemInfoPayload(routeContext) {
    const taskId = routeContext.taskId;
    const itemId = routeContext.itemId;
    const nodeId = routeContext.nodeId;
    if (!itemId || !nodeId) {
      return {
        ok: false,
        reason: "missing-itemid-nodeid",
        warnings: ["URL 缺少 itemId 或 nodeId，跳过 get-item-info 请求。"],
      };
    }

    const requestBody = {
      nodeId: nodeId,
      itemId: itemId,
    };
    if (taskId) {
      requestBody.taskId = taskId;
    }

    try {
      const response = await fetch(ITEM_INFO_PATH, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/plain, */*",
        },
        body: JSON.stringify(requestBody),
      });
      const text = await response.text();
      const json = safeJsonParse(text);
      if (!response.ok || !json || typeof json !== "object") {
        return {
          ok: false,
          reason: "request-failed",
          warnings: ["get-item-info 请求失败，已回退 DOM 采集。"],
        };
      }
      return {
        ok: true,
        status: response.status,
        body: json,
        warnings: [],
      };
    } catch (error) {
      return {
        ok: false,
        reason: "network-error",
        warnings: ["get-item-info 网络异常，已回退 DOM 采集。"],
      };
    }
  }

  function extractTask21ContextFromItemInfo(payload) {
    const root = payload && typeof payload === "object" ? payload : {};
    const imageMatches = {};
    IMAGE_FIELDS.forEach(function (fieldName) {
      const candidates = findCandidatesByKeys(root, IMAGE_KEY_CANDIDATES[fieldName]);
      imageMatches[fieldName] = pickFirstNonEmptyString(candidates);
    });

    const imageATexts = pickFirstUsefulValue(
      findCandidatesByKeys(root, TEXT_KEY_CANDIDATES.imageATexts)
    );
    const imageBTexts = pickFirstUsefulValue(
      findCandidatesByKeys(root, TEXT_KEY_CANDIDATES.imageBTexts)
    );
    const textPositions = pickFirstUsefulValue(
      findCandidatesByKeys(root, TEXT_KEY_CANDIDATES.textPositions)
    );

    return {
      imageMatches: imageMatches,
      imageATexts: imageATexts,
      imageBTexts: imageBTexts,
      textPositions: textPositions,
    };
  }

  async function collectImages(routeContext, itemInfoExtract, warnings) {
    const results = [];

    for (let index = 0; index < IMAGE_FIELDS.length; index += 1) {
      const fieldName = IMAGE_FIELDS[index];
      let imageNode = findImageByContentTitle(fieldName);
      let imageUrl = "";

      const matched = itemInfoExtract && itemInfoExtract.imageMatches ? itemInfoExtract.imageMatches[fieldName] : null;
      if (matched && typeof matched.value === "string") {
        imageUrl = matched.value;
      }

      if (!imageUrl && imageNode instanceof HTMLImageElement) {
        imageUrl = String(imageNode.currentSrc || imageNode.src || "").trim();
      }

      if (!imageNode) {
        const visibleImages = collectVisibleImages();
        imageNode = visibleImages[index] || null;
        if (!imageUrl && imageNode instanceof HTMLImageElement) {
          imageUrl = String(imageNode.currentSrc || imageNode.src || "").trim();
        }
      }

      if (!imageUrl) {
        warnings.push("未稳定获取 " + fieldName + " 图片地址。");
      }

      const record = await buildImageRecord(fieldName, imageUrl, imageNode);
      results.push(record);
    }

    return results;
  }

  function collectWarnings(context, routeContext) {
    const warnings = [];
    if (!context.imageATexts) {
      warnings.push("未读取到 image_a_texts，已按空文本发送。");
    }
    if (!context.imageBTexts) {
      warnings.push("未读取到 image_b_texts，已按空文本发送。");
    }
    if (!routeContext.itemId || !routeContext.nodeId) {
      warnings.push("URL 缺少 itemId/nodeId，get-item-info 可能不可用。");
    }
    return warnings;
  }

  async function collectTask21Payload() {
    const route = collectRouteContext();
    const currentPageValues = collectCurrentPageValues();

    const itemInfoResponse = await collectItemInfoPayload(route);
    const itemInfoExtract = itemInfoResponse.ok
      ? extractTask21ContextFromItemInfo(itemInfoResponse.body)
      : null;

    const warnings = collectWarnings(
      {
        imageATexts: itemInfoExtract?.imageATexts?.value || "",
        imageBTexts: itemInfoExtract?.imageBTexts?.value || "",
      },
      route
    );
    (itemInfoResponse.warnings || []).forEach(function (message) {
      warnings.push(message);
    });

    const images = await collectImages(route, itemInfoExtract, warnings);

    const context = {
      imageATexts: normalizeText(itemInfoExtract?.imageATexts?.value || ""),
      imageBTexts: normalizeText(itemInfoExtract?.imageBTexts?.value || ""),
      textPositions: itemInfoExtract?.textPositions?.value || {},
      targetRemovalTextHints: collectTargetRemovalTextHints(currentPageValues),
      currentValues: {
        same_font: currentPageValues.same_font || "",
        image_b_texts_removed: currentPageValues.image_b_texts_removed || "",
        other_changes: currentPageValues.other_changes || "",
        same_font_exists: currentPageValues.same_font_exists === true,
        image_b_texts_removed_exists: currentPageValues.image_b_texts_removed_exists === true,
        other_changes_exists: currentPageValues.other_changes_exists === true,
      },
      route: route,
    };

    const imageStats = images.map(function (item) {
      return {
        fieldName: item.fieldName,
        mime: item.mime || "unknown",
        width: item.width || "unknown",
        height: item.height || "unknown",
        bytes: item.bytes || "unknown",
        sourceKind: item.sourceKind || "unknown",
      };
    });

    const itemInfoShape = itemInfoResponse.ok
      ? {
          status: Number(itemInfoResponse.status || 0),
          code: Number(itemInfoResponse.body?.code || 0),
          hasData: !!itemInfoResponse.body?.data,
          dataKeys: itemInfoResponse.body?.data && typeof itemInfoResponse.body.data === "object"
            ? Object.keys(itemInfoResponse.body.data).slice(0, 40)
            : [],
          imagePaths: IMAGE_FIELDS.reduce(function (acc, fieldName) {
            const match = itemInfoExtract?.imageMatches?.[fieldName];
            acc[fieldName] = match ? match.path : "";
            return acc;
          }, {}),
          textPaths: {
            imageATexts: itemInfoExtract?.imageATexts?.path || "",
            imageBTexts: itemInfoExtract?.imageBTexts?.path || "",
            textPositions: itemInfoExtract?.textPositions?.path || "",
          },
        }
      : {
          ok: false,
          reason: itemInfoResponse.reason || "unknown",
        };

    return {
      ok: true,
      page: {
        isItemsPage: isItemsPage(),
        hasSameFontField: hasSameFontField(),
        isViewMode: isViewMode(),
      },
      context: context,
      images: images,
      imageStats: imageStats,
      itemInfoShape: itemInfoShape,
      warnings: warnings,
    };
  }

  globalThis.__ASCEdgeAbakaAiTask21DataCollector = {
    collectTask21Payload: collectTask21Payload,
    collectCurrentPageValues: collectCurrentPageValues,
    hasSameFontField: hasSameFontField,
    isItemsPage: isItemsPage,
    isViewMode: isViewMode,
    TARGET_FIELDS: TARGET_FIELDS.slice(),
    IMAGE_FIELDS: IMAGE_FIELDS.slice(),
    ITEM_INFO_PATH: ITEM_INFO_PATH,
  };
})();
