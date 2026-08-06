(function () {
  const TERMS_RESOURCE_PATH = "sites/pulse/ego-annotation-helper/data/forbidden-terms.json";
  let matcherPromise = null;

  function normalizeTerms(source) {
    const seen = new Set();
    return (Array.isArray(source) ? source : [])
      .map(function (term) {
        return String(term || "")
          .trim()
          .replace(/^[“”‘’"']+|[“”‘’"']+$/g, "");
      })
      .filter(function (term) {
        if (!term || seen.has(term)) {
          return false;
        }
        seen.add(term);
        return true;
      });
  }

  function createMatcher(sourceTerms) {
    const terms = normalizeTerms(sourceTerms)
      .map(function (term, index) {
        return { term: term, index: index };
      })
      .sort(function (left, right) {
        return right.term.length - left.term.length || left.index - right.index;
      });

    function find(text) {
      const value = String(text || "");
      const matches = [];
      let cursor = 0;

      while (cursor < value.length) {
        const matched = terms.find(function (item) {
          return value.startsWith(item.term, cursor);
        });
        if (!matched) {
          cursor += 1;
          continue;
        }
        matches.push({
          start: cursor,
          end: cursor + matched.term.length,
          term: matched.term,
        });
        cursor += matched.term.length;
      }
      return matches;
    }

    return {
      terms: terms.map(function (item) {
        return item.term;
      }),
      find: find,
    };
  }

  async function loadMatcherFromExtension() {
    if (matcherPromise) {
      return matcherPromise;
    }

    matcherPromise = (async function () {
      const runtime = typeof chrome !== "undefined" ? chrome.runtime : null;
      if (!runtime || typeof runtime.getURL !== "function") {
        throw new Error("扩展词表资源不可用。");
      }
      const response = await fetch(runtime.getURL(TERMS_RESOURCE_PATH), { cache: "no-store" });
      if (!response.ok) {
        throw new Error("禁用词表加载失败（HTTP " + response.status + "）。");
      }
      const payload = await response.json();
      const terms = normalizeTerms(payload && payload.terms);
      if (!terms.length) {
        throw new Error("禁用词表为空。");
      }
      return createMatcher(terms);
    })();

    try {
      return await matcherPromise;
    } catch (error) {
      matcherPromise = null;
      throw error;
    }
  }

  globalThis.ASREdgePulseForbiddenTerms = {
    TERMS_RESOURCE_PATH: TERMS_RESOURCE_PATH,
    normalizeTerms: normalizeTerms,
    createMatcher: createMatcher,
    loadMatcherFromExtension: loadMatcherFromExtension,
  };
})();
