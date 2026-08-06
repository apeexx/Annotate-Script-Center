(function () {
  function isXlsxFile(file) {
    return Boolean(file && /\.xlsx$/i.test(String(file.name || "").trim()));
  }

  async function createImportDraft(file, options) {
    if (!isXlsxFile(file)) {
      throw new Error("请上传 .xlsx 格式的禁用词表。");
    }
    if (typeof file.arrayBuffer !== "function") {
      throw new Error("无法读取所选的 Excel 文件。");
    }
    const config = options && typeof options === "object" ? options : {};
    const parser =
      config.parseXlsxTerms ||
      (globalThis.ASREdgePulseForbiddenTermsXlsx || {}).parseXlsxTerms;
    if (typeof parser !== "function") {
      throw new Error("Excel 解析模块不可用。");
    }
    const parsed = await parser(await file.arrayBuffer());
    const terms = Array.isArray(parsed && parsed.terms) ? parsed.terms.slice() : [];
    if (!terms.length) {
      throw new Error("Excel 工作簿未包含有效禁用词。");
    }
    return {
      sourceFileName: String(file.name || "").trim(),
      sourceColumn: String((parsed && parsed.sourceColumn) || "").trim(),
      rawTermCount: Number(parsed && parsed.rawTermCount) || terms.length,
      terms: terms,
    };
  }

  globalThis.ASREdgePulseForbiddenTermsImport = {
    isXlsxFile: isXlsxFile,
    createImportDraft: createImportDraft,
  };
})();
