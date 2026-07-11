(function () {
  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function formatEstimatedCostCny(value) {
    if (value === null || value === undefined || value === "") {
      return "";
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "";
    }
    return String(numeric.toFixed(6)).replace(/0+$/, "").replace(/\.$/, "") + " 元";
  }

  function resolveStageEstimatedCostLabel(stageCost, options) {
    const source = stageCost && typeof stageCost === "object" ? stageCost : {};
    const formatted = formatEstimatedCostCny(source.estimatedCostCny);
    if (formatted) {
      return formatted;
    }
    const reason = normalizeText(source.reason);
    if (reason) {
      return reason;
    }
    return normalizeText(options?.fallbackText) || "-";
  }

  function resolveTotalEstimatedCostLabel(cost, stageKeys, options) {
    const source = cost && typeof cost === "object" ? cost : {};
    const formatted = formatEstimatedCostCny(source.totalEstimatedCostCny);
    if (formatted) {
      return formatted;
    }
    const normalizedStageKeys = Array.isArray(stageKeys) ? stageKeys : [];
    const stageReasons = normalizedStageKeys
      .map(function (stageKey) {
        return normalizeText(source?.[stageKey]?.reason);
      })
      .filter(Boolean);
    if (
      stageReasons.some(function (reason) {
        return reason === "没有数据源";
      })
    ) {
      return "没有数据源";
    }
    const note = normalizeText(source.note);
    if (note) {
      return note;
    }
    if (stageReasons.length > 0) {
      return stageReasons[0];
    }
    return normalizeText(options?.fallbackText) || "-";
  }

  function buildCostRows(input) {
    const source = input && typeof input === "object" ? input : {};
    const cost = source.cost && typeof source.cost === "object" ? source.cost : {};
    const stageDefinitions = Array.isArray(source.stageDefinitions) ? source.stageDefinitions : [];
    const rows = [];

    stageDefinitions.forEach(function (stageDefinition) {
      const definition = stageDefinition && typeof stageDefinition === "object" ? stageDefinition : {};
      const label = normalizeText(definition.label);
      if (!label) {
        return;
      }
      const stageKey = normalizeText(definition.key);
      let stageCost =
        stageKey && cost?.[stageKey] && typeof cost[stageKey] === "object" ? cost[stageKey] : null;
      if (
        (!stageCost || typeof stageCost !== "object") &&
        definition.fallbackToTotal === true &&
        stageDefinitions.length === 1
      ) {
        stageCost = {
          estimatedCostCny: cost.totalEstimatedCostCny,
          reason: normalizeText(cost.note),
        };
      }
      rows.push([
        label,
        resolveStageEstimatedCostLabel(stageCost, {
          fallbackText: definition.fallbackText,
        }),
      ]);
    });

    if (normalizeText(source.totalLabel)) {
      rows.push([
        normalizeText(source.totalLabel),
        resolveTotalEstimatedCostLabel(
          cost,
          stageDefinitions.map(function (stageDefinition) {
            return normalizeText(stageDefinition?.key);
          }),
          {
            fallbackText: source.totalFallbackText,
          }
        ),
      ]);
    }

    return rows;
  }

  const api = {
    buildCostRows,
    formatEstimatedCostCny,
    resolveStageEstimatedCostLabel,
    resolveTotalEstimatedCostLabel,
  };

  globalThis.ASREdgeAiCostDisplay = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
