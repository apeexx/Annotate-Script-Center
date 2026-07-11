"use strict";

const url = require("url");
const { sendEmpty, sendJson } = require("./response");

function normalizeMethod(method) {
  return String(method || "GET").trim().toUpperCase();
}

function createRouter() {
  const routes = [];

  function normalizePathname(pathname) {
    const text = String(pathname || "/").trim() || "/";
    if (text === "/") {
      return "/";
    }
    return text.replace(/\/+$/, "") || "/";
  }

  function matchRoutePath(routePath, pathname) {
    const normalizedRoutePath = normalizePathname(routePath);
    const normalizedPathname = normalizePathname(pathname);
    if (normalizedRoutePath === normalizedPathname) {
      return {};
    }
    if (normalizedRoutePath.indexOf("/:") < 0) {
      return null;
    }

    const routeSegments = normalizedRoutePath.split("/");
    const pathSegments = normalizedPathname.split("/");
    if (routeSegments.length !== pathSegments.length) {
      return null;
    }

    const params = {};
    for (let index = 0; index < routeSegments.length; index += 1) {
      const routeSegment = routeSegments[index];
      const pathSegment = pathSegments[index];
      if (routeSegment === pathSegment) {
        continue;
      }
      if (!routeSegment || routeSegment[0] !== ":") {
        return null;
      }
      const key = routeSegment.slice(1).trim();
      if (!key) {
        return null;
      }
      try {
        params[key] = decodeURIComponent(pathSegment || "");
      } catch (error) {
        params[key] = pathSegment || "";
      }
    }
    return params;
  }

  function add(method, path, handler) {
    routes.push({
      method: normalizeMethod(method),
      path: String(path || "/"),
      handler,
    });
  }

  function findRoute(method, pathname) {
    for (let index = 0; index < routes.length; index += 1) {
      const route = routes[index];
      if (route.method !== method) {
        continue;
      }
      const params = matchRoutePath(route.path, pathname);
      if (params) {
        return {
          route,
          params,
        };
      }
    }
    return null;
  }

  async function handle(request, response) {
    const parsedUrl = url.parse(request.url || "", true);
    const method = normalizeMethod(request.method);
    const pathname = parsedUrl.pathname || "/";

    if (method === "OPTIONS") {
      sendEmpty(response, 204);
      return;
    }

    const matched = findRoute(method, pathname);
    if (!matched) {
      sendJson(response, 404, {
        success: false,
        message: "接口不存在。",
      });
      return;
    }

    try {
      await matched.route.handler({
        method,
        parsedUrl,
        pathname,
        params: matched.params || {},
        query: parsedUrl.query || {},
        request,
        response,
      });
    } catch (error) {
      sendJson(response, 500, {
        success: false,
        message: error && error.message ? error.message : String(error),
      });
    }
  }

  return {
    add,
    get: add.bind(null, "GET"),
    post: add.bind(null, "POST"),
    head: add.bind(null, "HEAD"),
    handle,
    routes,
  };
}

module.exports = {
  createRouter,
};
