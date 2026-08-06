(function () {
  const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
  const ZIP_CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
  const ZIP_LOCAL_FILE_HEADER = 0x04034b50;

  function toUint8Array(value) {
    if (value instanceof Uint8Array) {
      return value;
    }
    if (Object.prototype.toString.call(value) === "[object ArrayBuffer]") {
      return new Uint8Array(value);
    }
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    throw new Error("Excel 文件数据不可用。");
  }

  function decodeUtf8(bytes) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  function readUint16(view, offset) {
    if (offset < 0 || offset + 2 > view.byteLength) {
      throw new Error("Excel 压缩包已损坏。");
    }
    return view.getUint16(offset, true);
  }

  function readUint32(view, offset) {
    if (offset < 0 || offset + 4 > view.byteLength) {
      throw new Error("Excel 压缩包已损坏。");
    }
    return view.getUint32(offset, true);
  }

  function findEndOfCentralDirectory(bytes, view) {
    const minimumOffset = Math.max(0, bytes.length - 65557);
    for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
      if (readUint32(view, offset) === ZIP_END_OF_CENTRAL_DIRECTORY) {
        return offset;
      }
    }
    throw new Error("不是有效的 .xlsx 工作簿。");
  }

  function listZipEntries(arrayBuffer) {
    const bytes = toUint8Array(arrayBuffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const endOffset = findEndOfCentralDirectory(bytes, view);
    const entryCount = readUint16(view, endOffset + 10);
    const centralDirectorySize = readUint32(view, endOffset + 12);
    const centralDirectoryOffset = readUint32(view, endOffset + 16);
    if (entryCount === 0xffff || centralDirectoryOffset === 0xffffffff || centralDirectorySize === 0xffffffff) {
      throw new Error("暂不支持 ZIP64 格式的 Excel 文件。");
    }
    if (centralDirectoryOffset + centralDirectorySize > bytes.length) {
      throw new Error("Excel 压缩包已损坏。");
    }
    const entries = new Map();
    let offset = centralDirectoryOffset;
    for (let index = 0; index < entryCount; index += 1) {
      if (readUint32(view, offset) !== ZIP_CENTRAL_DIRECTORY_ENTRY) {
        throw new Error("Excel 压缩包目录无效。");
      }
      const compressionMethod = readUint16(view, offset + 10);
      const compressedSize = readUint32(view, offset + 20);
      const uncompressedSize = readUint32(view, offset + 24);
      const fileNameLength = readUint16(view, offset + 28);
      const extraLength = readUint16(view, offset + 30);
      const commentLength = readUint16(view, offset + 32);
      const localHeaderOffset = readUint32(view, offset + 42);
      const nameStart = offset + 46;
      const nameEnd = nameStart + fileNameLength;
      if (nameEnd > bytes.length) {
        throw new Error("Excel 压缩包目录无效。");
      }
      const name = decodeUtf8(bytes.slice(nameStart, nameEnd));
      entries.set(name, {
        compressionMethod: compressionMethod,
        compressedSize: compressedSize,
        uncompressedSize: uncompressedSize,
        localHeaderOffset: localHeaderOffset,
      });
      offset = nameEnd + extraLength + commentLength;
    }
    return { bytes: bytes, view: view, entries: entries };
  }

  async function decompressDeflateRaw(bytes, options) {
    const config = options && typeof options === "object" ? options : {};
    if (typeof config.inflateRaw === "function") {
      return toUint8Array(await config.inflateRaw(bytes));
    }
    const Stream = config.DecompressionStream || globalThis.DecompressionStream;
    if (typeof Stream !== "function" || typeof Blob !== "function" || typeof Response !== "function") {
      throw new Error("当前浏览器不支持读取压缩的 .xlsx 文件。");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new Stream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZipEntry(archive, name, options) {
    const entry = archive.entries.get(name);
    if (!entry) {
      return null;
    }
    const headerOffset = entry.localHeaderOffset;
    if (readUint32(archive.view, headerOffset) !== ZIP_LOCAL_FILE_HEADER) {
      throw new Error("Excel 压缩包已损坏。");
    }
    const fileNameLength = readUint16(archive.view, headerOffset + 26);
    const extraLength = readUint16(archive.view, headerOffset + 28);
    const dataStart = headerOffset + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataStart < 0 || dataEnd > archive.bytes.length) {
      throw new Error("Excel 压缩包已损坏。");
    }
    const compressed = archive.bytes.slice(dataStart, dataEnd);
    if (entry.compressionMethod === 0) {
      return compressed;
    }
    if (entry.compressionMethod === 8) {
      return decompressDeflateRaw(compressed, options);
    }
    throw new Error("Excel 文件使用了不支持的压缩方式。");
  }

  function normalizeEntryPath(target) {
    const raw = String(target || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const source = raw.startsWith("xl/") ? raw : "xl/" + raw;
    const parts = [];
    source.split("/").forEach(function (part) {
      if (!part || part === ".") {
        return;
      }
      if (part === "..") {
        parts.pop();
        return;
      }
      parts.push(part);
    });
    return parts.join("/");
  }

  function parseXml(xmlText, options) {
    const config = options && typeof options === "object" ? options : {};
    const Parser = config.DOMParser || globalThis.DOMParser;
    if (typeof Parser !== "function") {
      throw new Error("当前浏览器无法读取 Excel XML 数据。");
    }
    const document = new Parser().parseFromString(xmlText, "application/xml");
    if (document && typeof document.getElementsByTagName === "function") {
      const parserErrors = document.getElementsByTagName("parsererror");
      if (parserErrors && parserErrors.length) {
        throw new Error("Excel XML 数据无效。");
      }
    }
    return document;
  }

  function getElements(root, tagName) {
    return root && typeof root.getElementsByTagName === "function"
      ? Array.from(root.getElementsByTagName(tagName))
      : [];
  }

  function getFirstElement(root, tagName) {
    return getElements(root, tagName)[0] || null;
  }

  function getCellColumn(cell) {
    const reference = String(cell && typeof cell.getAttribute === "function" ? cell.getAttribute("r") || "" : "");
    const match = reference.match(/^([A-Z]+)\d+$/i);
    return match ? match[1].toUpperCase() : "";
  }

  function readCellText(cell, sharedStrings) {
    const type = String(cell && typeof cell.getAttribute === "function" ? cell.getAttribute("t") || "" : "");
    if (type === "inlineStr") {
      const inlineText = getFirstElement(cell, "is");
      return String(inlineText && inlineText.textContent ? inlineText.textContent : "");
    }
    const valueNode = getFirstElement(cell, "v");
    const rawValue = String(valueNode && valueNode.textContent ? valueNode.textContent : "");
    if (type === "s") {
      const index = Number(rawValue);
      return Number.isInteger(index) && index >= 0 ? String(sharedStrings[index] || "") : "";
    }
    return type === "e" ? "" : rawValue;
  }

  function resolveTermsApi(options) {
    const config = options && typeof options === "object" ? options : {};
    const api = config.forbiddenTerms || globalThis.ASREdgePulseForbiddenTerms || {};
    if (typeof api.collectTermCandidates !== "function" || typeof api.normalizeTerms !== "function") {
      throw new Error("禁用词模块不可用。");
    }
    return api;
  }

  async function parseXlsxTerms(arrayBuffer, options) {
    const archive = listZipEntries(arrayBuffer);
    const workbookBytes = await readZipEntry(archive, "xl/workbook.xml", options);
    const relationshipBytes = await readZipEntry(archive, "xl/_rels/workbook.xml.rels", options);
    if (!workbookBytes || !relationshipBytes) {
      throw new Error("Excel 工作簿缺少必要结构。");
    }
    const workbook = parseXml(decodeUtf8(workbookBytes), options);
    const relationships = parseXml(decodeUtf8(relationshipBytes), options);
    const firstSheet = getFirstElement(workbook, "sheet");
    const relationId =
      firstSheet && typeof firstSheet.getAttribute === "function"
        ? firstSheet.getAttribute("r:id") || firstSheet.getAttribute("id")
        : "";
    const relationship = getElements(relationships, "Relationship").find(function (item) {
      return item && typeof item.getAttribute === "function" && item.getAttribute("Id") === relationId;
    });
    const target = relationship && typeof relationship.getAttribute === "function" ? relationship.getAttribute("Target") : "";
    if (!target) {
      throw new Error("Excel 工作簿未找到首个工作表。");
    }
    const sheetPath = normalizeEntryPath(target);
    const sheetBytes = await readZipEntry(archive, sheetPath, options);
    if (!sheetBytes) {
      throw new Error("Excel 工作簿未找到首个工作表。");
    }
    const sharedStringsBytes = await readZipEntry(archive, "xl/sharedStrings.xml", options);
    const sharedStrings = sharedStringsBytes
      ? getElements(parseXml(decodeUtf8(sharedStringsBytes), options), "si").map(function (item) {
          return String(item && item.textContent ? item.textContent : "");
        })
      : [];
    const worksheet = parseXml(decodeUtf8(sheetBytes), options);
    const cells = getElements(worksheet, "c")
      .map(function (cell) {
        return { column: getCellColumn(cell), value: readCellText(cell, sharedStrings) };
      })
      .filter(function (cell) {
        return cell.column && String(cell.value || "").trim();
      });
    const firstCell = cells[0] || null;
    if (!firstCell) {
      throw new Error("Excel 工作簿未包含有效禁用词。");
    }
    const sourceColumn = firstCell.column;
    const values = cells
      .filter(function (cell) {
        return cell.column === sourceColumn;
      })
      .map(function (cell) {
        return cell.value;
      });
    const forbiddenTerms = resolveTermsApi(options);
    const rawTerms = forbiddenTerms.collectTermCandidates(values);
    const terms = forbiddenTerms.normalizeTerms(values);
    if (!terms.length) {
      throw new Error("Excel 工作簿未包含有效禁用词。");
    }
    return {
      sourceColumn: sourceColumn,
      rawTermCount: rawTerms.length,
      terms: terms,
    };
  }

  globalThis.ASREdgePulseForbiddenTermsXlsx = {
    parseXlsxTerms: parseXlsxTerms,
  };
})();
