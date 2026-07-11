(function () {
  const protocol = globalThis.__ASREdgeJudgementNetworkProtocol;

  function getFetchMethod(resource, init) {
    if (init && typeof init.method === "string") {
      return init.method.toUpperCase();
    }

    if (resource && typeof Request !== "undefined" && resource instanceof Request) {
      return String(resource.method || "GET").toUpperCase();
    }

    return "GET";
  }

  function getResourceUrl(resource) {
    if (typeof resource === "string" || resource instanceof URL) {
      return String(resource);
    }

    if (resource && typeof Request !== "undefined" && resource instanceof Request) {
      return resource.url;
    }

    return "";
  }

  function maybeRewriteUrl(rawUrl, method, state) {
    const url = protocol.parseUrl(rawUrl);
    const pageSize = protocol.normalizePageSize(state.pageSizeOverride);

    if (
      !state.enabled ||
      !pageSize ||
      String(method || "GET").toUpperCase() !== "GET" ||
      !protocol.isSubtaskDataUrl(url)
    ) {
      return {
        changed: false,
        url: rawUrl,
        absoluteUrl: url ? url.toString() : String(rawUrl || ""),
      };
    }

    url.searchParams.set("pageSize", String(pageSize));
    state.lastRewriteAt = new Date().toISOString();

    return {
      changed: true,
      url: url.toString(),
      absoluteUrl: url.toString(),
      pageSize: pageSize,
    };
  }

  function formatResourceUrl(rawUrl, rewrittenAbsoluteUrl) {
    if (typeof rawUrl !== "string") {
      return rewrittenAbsoluteUrl;
    }

    if (/^[a-z][a-z\d+\-.]*:/i.test(rawUrl)) {
      return rewrittenAbsoluteUrl;
    }

    const absolute = protocol.parseUrl(rawUrl);
    if (!absolute) {
      return rewrittenAbsoluteUrl;
    }

    const rewritten = protocol.parseUrl(rewrittenAbsoluteUrl);
    if (!rewritten) {
      return rewrittenAbsoluteUrl;
    }

    return rewritten.origin === location.origin
      ? rewritten.pathname + rewritten.search + rewritten.hash
      : rewritten.toString();
  }

  function rewriteFetchResource(resource, init, state) {
    const method = getFetchMethod(resource, init);
    const rawUrl = getResourceUrl(resource);
    const rewrite = maybeRewriteUrl(rawUrl, method, state);

    if (!rewrite.changed) {
      return {
        resource: resource,
        init: init,
        captureUrl: rewrite.absoluteUrl,
        rewritten: false,
      };
    }

    if (resource && typeof Request !== "undefined" && resource instanceof Request) {
      return {
        resource: new Request(rewrite.url, resource),
        init: init,
        captureUrl: rewrite.absoluteUrl,
        rewritten: true,
        pageSize: rewrite.pageSize,
      };
    }

    return {
      resource: formatResourceUrl(rawUrl, rewrite.url),
      init: init,
      captureUrl: rewrite.absoluteUrl,
      rewritten: true,
      pageSize: rewrite.pageSize,
    };
  }

  globalThis.__ASREdgeJudgementNetworkUrlRewriter = {
    maybeRewriteUrl: maybeRewriteUrl,
    formatResourceUrl: formatResourceUrl,
    rewriteFetchResource: rewriteFetchResource,
  };
})();
