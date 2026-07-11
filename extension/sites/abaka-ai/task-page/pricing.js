(function () {
  const SAME_FONT_TIERS = [
    { max: 3, price: 0.1, tier: "<=3" },
    { max: 6, price: 0.25, tier: "4-6" },
    { max: 10, price: 0.45, tier: "7-10" },
    { max: 15, price: 0.6, tier: "11-15" },
    { max: 20, price: 0.8, tier: "16-20 (excel口径15-20)" },
  ];
  const REMOVED_TIERS = [
    { max: 3, price: 0.1, tier: "<=3" },
    { max: 6, price: 0.2, tier: "4-6" },
    { max: 10, price: 0.3, tier: "7-10" },
    { max: 15, price: 0.4, tier: "11-15" },
    { max: 20, price: 0.5, tier: "16-20 (excel口径15-20)" },
  ];
  const OTHER_CHANGES_TIERS = [
    { min: 1, max: 10, price: 0.1, tier: "1-10" },
    { min: 11, max: 20, price: 0.25, tier: "11-20" },
    { min: 21, max: 30, price: 0.4, tier: "21-30" },
    { min: 31, max: 40, price: 0.7, tier: "31-40" },
  ];

  function normalizeText(value) {
    return String(value || "").replace(/\r\n/g, "\n").trim();
  }

  function isBlankValue(value) {
    return normalizeText(value).length === 0;
  }

  function normalizeSameFontValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isSameFontApplicable(value) {
    const text = normalizeSameFontValue(value);
    if (!text) {
      return false;
    }
    return text !== "not_applicable";
  }

  function isLikelyBulletLine(line) {
    return /^(\d+[\).]|[-*•·●]|[a-z][\).]|[ivxlcdm]+\.)\s+/i.test(String(line || "").trim());
  }

  function countInstructionSegments(text) {
    const content = normalizeText(text);
    if (!content) {
      return 0;
    }
    const lines = content.split("\n").map(function (line) {
      return String(line || "").replace(/\s+$/g, "");
    });
    let segments = 0;
    let inBulletList = false;
    let currentIndent = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index];
      const line = raw.trim();
      if (!line) {
        inBulletList = false;
        continue;
      }
      const bullet = isLikelyBulletLine(line);
      if (!bullet) {
        inBulletList = false;
        segments += 1;
        continue;
      }
      const indent = raw.length - raw.trimStart().length;
      if (!inBulletList) {
        segments += 1;
        inBulletList = true;
        currentIndent = indent;
        continue;
      }
      if (indent !== currentIndent) {
        segments += 1;
        currentIndent = indent;
      }
    }
    return segments;
  }

  function resolveTierByCount(count, tiers) {
    const safeCount = Math.max(0, Number(count) || 0);
    if (safeCount <= 0) {
      return {
        value: 0,
        tier: "0",
      };
    }
    for (let index = 0; index < tiers.length; index += 1) {
      const tier = tiers[index];
      if (safeCount <= tier.max && (tier.min === undefined || safeCount >= tier.min)) {
        return {
          value: tier.price,
          tier: tier.tier,
        };
      }
    }
    const last = tiers[tiers.length - 1];
    return {
      value: last ? last.price : 0,
      tier: (last ? last.tier : "overflow") + " (capped)",
    };
  }

  function countRemovedSegments(value) {
    const text = normalizeText(value);
    if (!text) {
      return 0;
    }
    if (/^true$/i.test(text)) {
      return 1;
    }
    return text
      .split("\n")
      .map(function (line) {
        return String(line || "").trim();
      })
      .filter(Boolean).length;
  }

  function countEnglishWords(value) {
    const text = normalizeText(value);
    if (!text) {
      return 0;
    }
    if (/^unsure$/i.test(text)) {
      return 1;
    }
    const tokens = text.match(/[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*/g);
    return tokens ? tokens.length : 0;
  }

  function roundPrice(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 0;
    }
    return Number(number.toFixed(4));
  }

  function estimateTask21Price(input) {
    const source = input && typeof input === "object" ? input : {};
    const sameFontValue = normalizeText(source.sameFontValue || "");
    const removedValue = normalizeText(source.imageBTextsRemovedValue || "");
    const otherChangesValue = normalizeText(source.otherChangesValue || "");

    const sameFontApplicable = isSameFontApplicable(sameFontValue);
    const sameFontSegments =
      countInstructionSegments(source.imageATexts || "") +
      countInstructionSegments(source.imageBTexts || "");
    const sameFontTier = sameFontApplicable
      ? resolveTierByCount(sameFontSegments, SAME_FONT_TIERS)
      : { value: 0, tier: "not_applicable" };

    const removedSegments = countRemovedSegments(removedValue);
    const removedTier = resolveTierByCount(removedSegments, REMOVED_TIERS);

    const otherChangesWords = countEnglishWords(otherChangesValue);
    const otherTier = resolveTierByCount(otherChangesWords, OTHER_CHANGES_TIERS);

    const sameFontPrice = roundPrice(sameFontTier.value);
    const removedPrice = roundPrice(removedTier.value);
    const otherChangesPrice = roundPrice(otherTier.value);
    const totalPrice = roundPrice(sameFontPrice + removedPrice + otherChangesPrice);

    return {
      sameFont: {
        segmentCount: sameFontSegments,
        price: sameFontPrice,
        tier: sameFontTier.tier,
        estimated: true,
      },
      imageBTextsRemoved: {
        segmentCount: removedSegments,
        price: removedPrice,
        tier: removedTier.tier,
        estimated: true,
      },
      otherChanges: {
        wordCount: otherChangesWords,
        price: otherChangesPrice,
        tier: otherTier.tier,
        estimated: true,
      },
      totalPrice: totalPrice,
      notes: {
        source: "雨滴Task21单价.xlsx（代码固化规则）",
        overlapHandling: "15-20 档位按 16-20 实现，文档保留 excel 原口径说明",
        unsureWordCountRule: "other_changes=unsure 按 1 词计费",
      },
    };
  }

  globalThis.__ASCEdgeAbakaAiTask21Pricing = {
    countEnglishWords: countEnglishWords,
    countInstructionSegments: countInstructionSegments,
    countRemovedSegments: countRemovedSegments,
    estimateTask21Price: estimateTask21Price,
  };
})();
