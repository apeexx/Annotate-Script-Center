"use strict";

(function initOptionsProjectDownloadSupplier(globalObject) {
  const ALL_SUPPLIERS_VALUE = "__all__";

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function buildProjectDownloadSupplierState(dataset) {
    const suppliers = Array.isArray(dataset?.suppliers)
      ? dataset.suppliers
          .map(function (item) {
            return normalizeText(item);
          })
          .filter(Boolean)
      : [];
    const supplierRequired = dataset?.supplierRequired === true;

    return {
      supplierRequired,
      showRow: suppliers.length > 0,
      options: suppliers.length > 0
        ? [{ value: ALL_SUPPLIERS_VALUE, label: "全部" }].concat(
            suppliers.map(function (supplier) {
              return {
                value: supplier,
                label: supplier,
              };
            })
          )
        : [],
    };
  }

  function isAllSuppliersValue(value) {
    return normalizeText(value) === ALL_SUPPLIERS_VALUE;
  }

  function isProjectDownloadSupplierSelectionValid(dataset, value) {
    const state = buildProjectDownloadSupplierState(dataset);
    const normalizedValue = normalizeText(value);
    if (!state.showRow) {
      return true;
    }
    if (isAllSuppliersValue(normalizedValue)) {
      return true;
    }
    if (state.supplierRequired) {
      return Boolean(normalizedValue);
    }
    return true;
  }

  const api = {
    ALL_SUPPLIERS_VALUE,
    buildProjectDownloadSupplierState,
    isAllSuppliersValue,
    isProjectDownloadSupplierSelectionValid,
  };

  globalObject.ASREdgeOptionsProjectDownloadSupplier = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
