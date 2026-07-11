"use strict";

const APP_NAME = "annotation-script-center";
const FALLBACK_DOWNLOAD_BASE_URL = "https://script.xiangtianzhen.store/downloads/";
const VERSION_FILE_PATTERN = /^annotation-script-center-v([0-9A-Za-z.-]+)\.(crx|zip)$/i;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeBaseUrl(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  return text.endsWith("/") ? text : `${text}/`;
}

function resolveDownloadBaseUrl(options) {
  const config = options && typeof options === "object" ? options : {};
  return (
    normalizeBaseUrl(config.downloadBaseUrl) ||
    normalizeBaseUrl(process.env.ASC_DOWNLOAD_BASE_URL) ||
    FALLBACK_DOWNLOAD_BASE_URL
  );
}

function buildDefaultLatestJsonUrl(downloadBaseUrl) {
  return new URL(`${APP_NAME}-crx-latest.json`, downloadBaseUrl).toString();
}

function normalizeIsoText(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function normalizeVersion(value) {
  return normalizeText(value).replace(/^v/i, "");
}

function compareVersionSegment(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftIsNumber = Number.isFinite(leftNumber);
  const rightIsNumber = Number.isFinite(rightNumber);
  if (leftIsNumber && rightIsNumber) {
    return leftNumber - rightNumber;
  }
  return String(left).localeCompare(String(right), "en");
}

function compareVersionsDescending(left, right) {
  const leftSegments = normalizeVersion(left).split(/[.-]/).filter(Boolean);
  const rightSegments = normalizeVersion(right).split(/[.-]/).filter(Boolean);
  const size = Math.max(leftSegments.length, rightSegments.length);
  for (let index = 0; index < size; index += 1) {
    const leftSegment = leftSegments[index] ?? "0";
    const rightSegment = rightSegments[index] ?? "0";
    const compared = compareVersionSegment(leftSegment, rightSegment);
    if (compared !== 0) {
      return compared > 0 ? -1 : 1;
    }
  }
  return 0;
}

function createReleaseItem(record) {
  const source = record && typeof record === "object" ? record : {};
  const version = normalizeVersion(source.version);
  if (!version) {
    return null;
  }
  return {
    version,
    crxUrl: normalizeText(source.crxUrl),
    zipUrl: normalizeText(source.zipUrl),
    createdAt: normalizeIsoText(source.createdAt),
    isLatest: source.isLatest === true,
  };
}

function mergeReleaseItems(items) {
  const byVersion = new Map();
  (Array.isArray(items) ? items : []).forEach(function (item) {
    const normalized = createReleaseItem(item);
    if (!normalized) {
      return;
    }
    const previous = byVersion.get(normalized.version) || {
      version: normalized.version,
      crxUrl: "",
      zipUrl: "",
      createdAt: "",
      isLatest: false,
    };
    byVersion.set(normalized.version, {
      version: normalized.version,
      crxUrl: normalized.crxUrl || previous.crxUrl,
      zipUrl: normalized.zipUrl || previous.zipUrl,
      createdAt: normalized.createdAt || previous.createdAt,
      isLatest: normalized.isLatest || previous.isLatest,
    });
  });
  return Array.from(byVersion.values()).sort(function (left, right) {
    return compareVersionsDescending(left.version, right.version);
  });
}

function buildLatestReleaseItem(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  return createReleaseItem({
    version: source.latest_version,
    crxUrl: source.download_url,
    zipUrl: source.zip_download_url,
    createdAt: source.created_at,
    isLatest: true,
  });
}

function parseDirectoryIndex(htmlText, baseUrl) {
  const html = String(htmlText || "");
  const normalizedBase = normalizeBaseUrl(baseUrl) || FALLBACK_DOWNLOAD_BASE_URL;
  const items = [];
  const pattern = /href\s*=\s*"([^"]+)"/gi;
  let matched;
  while ((matched = pattern.exec(html))) {
    const href = normalizeText(matched[1]);
    if (!href) {
      continue;
    }
    const fileName = decodeURIComponent(href.split("/").pop() || "");
    const versionMatch = VERSION_FILE_PATTERN.exec(fileName);
    if (!versionMatch) {
      continue;
    }
    const version = normalizeVersion(versionMatch[1]);
    const type = String(versionMatch[2] || "").toLowerCase();
    const url = new URL(href, normalizedBase).toString();
    items.push({
      version,
      crxUrl: type === "crx" ? url : "",
      zipUrl: type === "zip" ? url : "",
      createdAt: "",
      isLatest: false,
    });
  }
  return mergeReleaseItems(items);
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
    },
  });
  if (!response || response.ok !== true) {
    throw new Error(`获取最新版元数据失败：${response ? response.status : "unknown"}`);
  }
  return response.json();
}

async function fetchText(fetchImpl, url) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "text/html, text/plain;q=0.9, */*;q=0.8",
    },
  });
  if (!response || response.ok !== true) {
    throw new Error(`获取下载目录失败：${response ? response.status : "unknown"}`);
  }
  return response.text();
}

async function loadAdminDownloadCenterReleases(options) {
  const config = options && typeof options === "object" ? options : {};
  const fetchImpl =
    typeof config.fetchImpl === "function"
      ? config.fetchImpl
      : typeof fetch === "function"
        ? fetch.bind(globalThis)
        : null;
  if (!fetchImpl) {
    throw new Error("当前运行环境不支持 fetch。");
  }

  const downloadBaseUrl = resolveDownloadBaseUrl(config);
  const latestJsonUrl = normalizeText(config.latestJsonUrl) || buildDefaultLatestJsonUrl(downloadBaseUrl);
  const directoryIndexUrl = normalizeBaseUrl(config.directoryIndexUrl) || downloadBaseUrl;
  const latestPayload = await fetchJson(fetchImpl, latestJsonUrl);
  const latestItem = buildLatestReleaseItem(latestPayload);
  if (!latestItem || !latestItem.crxUrl) {
    throw new Error("最新版元数据缺少有效下载地址。");
  }

  let items = [latestItem];
  let fallbackReason = "";
  try {
    const directoryHtml = await fetchText(fetchImpl, directoryIndexUrl);
    const parsedItems = parseDirectoryIndex(directoryHtml, directoryIndexUrl);
    items = mergeReleaseItems([latestItem].concat(parsedItems));
  } catch (error) {
    fallbackReason = error && error.message ? error.message : String(error);
    items = mergeReleaseItems([latestItem]);
  }

  return {
    latestVersion: latestItem.version,
    latestCreatedAt: latestItem.createdAt,
    source: {
      latestJsonUrl,
      directoryIndexUrl,
      usedFallback: Boolean(fallbackReason),
      fallbackReason,
    },
    items,
  };
}

module.exports = {
  FALLBACK_DOWNLOAD_BASE_URL,
  buildLatestReleaseItem,
  buildDefaultLatestJsonUrl,
  compareVersionsDescending,
  loadAdminDownloadCenterReleases,
  mergeReleaseItems,
  parseDirectoryIndex,
  resolveDownloadBaseUrl,
};
