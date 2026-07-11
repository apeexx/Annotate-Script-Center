"use strict";

(function initOptionsRouteState(globalObject) {
  const VALID_VIEWS = {
    center: true,
    downloads: true,
    script: true,
    admin: true,
  };

  const VALID_ADMIN_TABS = {
    overview: true,
    backend: true,
    exports: true,
  };

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeAdminTab(value) {
    const tab = normalizeText(value).toLowerCase();
    if (tab === "stats") {
      return "overview";
    }
    if (tab === "downloads") {
      return "exports";
    }
    return VALID_ADMIN_TABS[tab] ? tab : "overview";
  }

  function parseOptionsRoute(search, scriptLibrary) {
    const scripts = scriptLibrary && typeof scriptLibrary === "object" ? scriptLibrary : {};
    const searchParams = new URLSearchParams(normalizeText(search).replace(/^\?/, ""));
    const view = normalizeText(searchParams.get("view")).toLowerCase();
    const scriptId = normalizeText(searchParams.get("script"));
    const adminTab = normalizeAdminTab(searchParams.get("tab"));

    if (view === "script" && scriptId && Object.prototype.hasOwnProperty.call(scripts, scriptId)) {
      return {
        view: "script",
        scriptId,
        adminTab: "overview",
      };
    }

    if (view === "admin") {
      return {
        view: "admin",
        scriptId: null,
        adminTab,
      };
    }

    return {
      view: VALID_VIEWS[view] ? view : "center",
      scriptId: null,
      adminTab: "overview",
    };
  }

  function buildOptionsRouteHref(currentHref, nextRoute) {
    const route = nextRoute && typeof nextRoute === "object" ? nextRoute : {};
    const currentUrl = new URL(String(currentHref || "http://127.0.0.1/options/options.html"));
    const view = normalizeText(route.view).toLowerCase();
    const normalizedView = VALID_VIEWS[view] ? view : "center";

    currentUrl.searchParams.set("view", normalizedView);
    currentUrl.searchParams.delete("script");
    currentUrl.searchParams.delete("tab");

    if (normalizedView === "script" && normalizeText(route.scriptId)) {
      currentUrl.searchParams.set("script", normalizeText(route.scriptId));
    }

    if (normalizedView === "admin") {
      currentUrl.searchParams.set("tab", normalizeAdminTab(route.adminTab));
    }

    if (normalizedView === "center" && Array.from(currentUrl.searchParams.keys()).length === 1) {
      currentUrl.search = "?view=center";
    }

    return currentUrl.toString();
  }

  const api = {
    buildOptionsRouteHref,
    normalizeAdminTab,
    parseOptionsRoute,
  };

  globalObject.ASREdgeOptionsRouteState = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
