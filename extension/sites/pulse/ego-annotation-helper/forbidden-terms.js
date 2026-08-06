(function () {
  const TERMS_RESOURCE_PATH = "sites/pulse/ego-annotation-helper/data/forbidden-terms.json";
  const CUSTOM_TERMS_STORAGE_KEY = "asrEdgePulsePulseForbiddenTermsV1";
  const CUSTOM_TERMS_SCHEMA_VERSION = 1;
  let matcherPromise = null;

  function normalizeTerm(value) {
    return String(value || "")
      .trim()
      .replace(/^[“”‘’"']+|[“”‘’"']+$/g, "");
  }

  function collectTermCandidates(source) {
    const values = Array.isArray(source) ? source : [source];
    return values
      .flatMap(function (value) {
        return String(value || "").split(/[,，、]/);
      })
      .map(normalizeTerm)
      .filter(Boolean);
  }

  function normalizeTerms(source) {
    const seen = new Set();
    return collectTermCandidates(source).filter(function (term) {
      if (seen.has(term)) {
        return false;
      }
      seen.add(term);
      return true;
    });
  }

  function normalizeCustomTermsPayload(source) {
    const payload = source && typeof source === "object" ? source : null;
    const terms = normalizeTerms(payload && payload.terms);
    if (!terms.length) {
      return null;
    }
    return {
      schemaVersion: CUSTOM_TERMS_SCHEMA_VERSION,
      sourceFileName: normalizeTerm(payload && payload.sourceFileName) || "自定义禁用词表.xlsx",
      importedAt: normalizeTerm(payload && payload.importedAt) || new Date().toISOString(),
      terms: terms,
    };
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

  function getStorageArea() {
    const storageArea =
      typeof chrome !== "undefined" && chrome.storage && chrome.storage.local ? chrome.storage.local : null;
    if (!storageArea) {
      throw new Error("扩展本地存储不可用。");
    }
    return storageArea;
  }

  function createStoragePromise(method, payload) {
    let storageArea;
    try {
      storageArea = getStorageArea();
    } catch (error) {
      return Promise.reject(error);
    }
    if (typeof storageArea[method] !== "function") {
      return Promise.reject(new Error("扩展本地存储不可用。"));
    }
    return new Promise(function (resolve, reject) {
      try {
        storageArea[method](payload, function (result) {
          const runtimeError =
            typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime.lastError : null;
          if (runtimeError) {
            reject(new Error(runtimeError.message || "扩展本地存储操作失败。"));
            return;
          }
          resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function loadCustomTerms() {
    const result = await createStoragePromise("get", CUSTOM_TERMS_STORAGE_KEY);
    return normalizeCustomTermsPayload(result && result[CUSTOM_TERMS_STORAGE_KEY]);
  }

  async function saveCustomTerms(source) {
    const payload = normalizeCustomTermsPayload(source);
    if (!payload) {
      throw new Error("禁用词表为空，无法保存。");
    }
    await createStoragePromise("set", { [CUSTOM_TERMS_STORAGE_KEY]: payload });
    invalidateMatcherCache();
    return payload;
  }

  async function clearCustomTerms() {
    await createStoragePromise("remove", CUSTOM_TERMS_STORAGE_KEY);
    invalidateMatcherCache();
  }

  async function loadDefaultTerms() {
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
    return terms;
  }

  function invalidateMatcherCache() {
    matcherPromise = null;
  }

  function isCustomTermsStorageChange(changes, areaName) {
    return (
      areaName === "local" &&
      Boolean(changes && Object.prototype.hasOwnProperty.call(changes, CUSTOM_TERMS_STORAGE_KEY))
    );
  }

  async function loadMatcherFromExtension() {
    if (matcherPromise) {
      return matcherPromise;
    }

    matcherPromise = (async function () {
      const customTerms = await loadCustomTerms();
      if (customTerms) {
        return createMatcher(customTerms.terms);
      }
      return createMatcher(await loadDefaultTerms());
    })();

    try {
      return await matcherPromise;
    } catch (error) {
      invalidateMatcherCache();
      throw error;
    }
  }

  globalThis.ASREdgePulseForbiddenTerms = {
    TERMS_RESOURCE_PATH: TERMS_RESOURCE_PATH,
    CUSTOM_TERMS_STORAGE_KEY: CUSTOM_TERMS_STORAGE_KEY,
    CUSTOM_TERMS_SCHEMA_VERSION: CUSTOM_TERMS_SCHEMA_VERSION,
    collectTermCandidates: collectTermCandidates,
    normalizeTerms: normalizeTerms,
    normalizeCustomTermsPayload: normalizeCustomTermsPayload,
    createMatcher: createMatcher,
    loadCustomTerms: loadCustomTerms,
    saveCustomTerms: saveCustomTerms,
    clearCustomTerms: clearCustomTerms,
    invalidateMatcherCache: invalidateMatcherCache,
    isCustomTermsStorageChange: isCustomTermsStorageChange,
    loadMatcherFromExtension: loadMatcherFromExtension,
  };
})();
