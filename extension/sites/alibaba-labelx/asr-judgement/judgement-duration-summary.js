(function () {
  const DEFAULT_ALL_PAGE_SIZE = 400;

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const restSeconds = seconds % 60;
    const pad = function (value) {
      return String(value).padStart(2, "0");
    };

    if (hours > 0) {
      return String(hours) + ":" + pad(minutes) + ":" + pad(restSeconds);
    }

    return pad(minutes) + ":" + pad(restSeconds);
  }

  function buildSubtaskDataUrl(subTaskId, pageSize, page) {
    const url = new URL(
      "/api/v1/label/center/subTask/" + encodeURIComponent(subTaskId) + "/data",
      location.origin
    );
    url.searchParams.set("page", String(page || 1));
    url.searchParams.set("pageSize", String(pageSize || DEFAULT_ALL_PAGE_SIZE));
    url.searchParams.set("filterPassedVote", "false");
    url.searchParams.set(
      "filter",
      JSON.stringify({
        questions: [],
        dataStatus: "ALL",
        questionsQueryConditions: "AND",
      })
    );
    url.searchParams.set("_", String(Date.now()));
    return url;
  }

  function summarizeSubtaskDataBody(body, source, requestedPageSize, requestedPage) {
    const data = body && typeof body === "object" ? body.data || {} : {};
    const dataList = Array.isArray(data.dataList) ? data.dataList : [];
    let totalSeconds = 0;
    let durationCount = 0;

    dataList.forEach(function (item) {
      const duration = Number(item?.data?.duration);
      if (!Number.isFinite(duration) || duration < 0) {
        return;
      }

      totalSeconds += duration;
      durationCount += 1;
    });

    const expectedCount = Number(data.size);
    const normalizedExpectedCount = Number.isFinite(expectedCount) && expectedCount > 0 ? expectedCount : dataList.length;
    const full = durationCount > 0 && (!normalizedExpectedCount || durationCount >= normalizedExpectedCount);

    return {
      status: durationCount > 0 ? (full ? "ready" : "partial") : "empty",
      totalSeconds: totalSeconds,
      itemCount: dataList.length,
      durationCount: durationCount,
      expectedCount: normalizedExpectedCount || 0,
      requestedPageSize: requestedPageSize || null,
      requestedPage: requestedPage || null,
      source: source || "data-fetch",
      updatedAt: new Date().toISOString(),
      error: "",
    };
  }

  function mergeDurationSummaries(summaries, source) {
    const validSummaries = Array.isArray(summaries)
      ? summaries.filter(function (summary) {
          return summary && summary.status !== "empty";
        })
      : [];
    const expectedCount = validSummaries.reduce(function (maxValue, summary) {
      return Math.max(maxValue, Number(summary.expectedCount) || 0);
    }, 0);
    const durationCount = validSummaries.reduce(function (total, summary) {
      return total + (Number(summary.durationCount) || 0);
    }, 0);
    const itemCount = validSummaries.reduce(function (total, summary) {
      return total + (Number(summary.itemCount) || 0);
    }, 0);
    const totalSeconds = validSummaries.reduce(function (total, summary) {
      return total + (Number(summary.totalSeconds) || 0);
    }, 0);

    return {
      status:
        durationCount > 0 && (!expectedCount || durationCount >= expectedCount)
          ? "ready"
          : durationCount > 0
            ? "partial"
            : "empty",
      totalSeconds: totalSeconds,
      itemCount: itemCount,
      durationCount: durationCount,
      expectedCount: expectedCount,
      requestedPageSize: validSummaries[0]?.requestedPageSize || null,
      requestedPage: null,
      source: source || "content-fetch-pages",
      updatedAt: new Date().toISOString(),
      error: "",
    };
  }

  async function fetchSubtaskDurationSummary(subTaskId, pageSize, page) {
    const url = buildSubtaskDataUrl(subTaskId, pageSize, page || 1);
    const response = await fetch(url.toString(), {
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json, text/plain, */*",
      },
    });

    if (!response.ok) {
      throw new Error("data 请求失败：" + String(response.status));
    }

    const body = await response.json();
    if (body?.success === false || (body?.code !== undefined && body.code !== 0)) {
      throw new Error(body?.message || "data 响应失败。");
    }

    return summarizeSubtaskDataBody(body, "content-fetch", pageSize, page || 1);
  }

  async function fetchCompleteSubtaskDurationSummary(subTaskId, allPageSizeValue) {
    const pageSize = Number(allPageSizeValue) || DEFAULT_ALL_PAGE_SIZE;
    const firstSummary = await fetchSubtaskDurationSummary(subTaskId, pageSize, 1);
    const expectedCount = Number(firstSummary.expectedCount) || 0;

    if (
      firstSummary.status === "ready" ||
      expectedCount <= 0 ||
      expectedCount <= firstSummary.durationCount ||
      expectedCount > 1000
    ) {
      return firstSummary;
    }

    const fallbackPageSize = 50;
    const pageCount = Math.ceil(expectedCount / fallbackPageSize);
    const pageNumbers = [];
    for (let page = 1; page <= pageCount; page += 1) {
      pageNumbers.push(page);
    }

    const pageSummaries = await Promise.all(
      pageNumbers.map(function (page) {
        return fetchSubtaskDurationSummary(subTaskId, fallbackPageSize, page);
      })
    );
    return mergeDurationSummaries(pageSummaries, "content-fetch-pages");
  }

  function normalizeNetworkDurationSummary(summary) {
    if (!summary || typeof summary !== "object") {
      return null;
    }

    const durationCount = Number(summary.durationCount);
    const expectedCount = Number(summary.size);
    const itemCount = Number(summary.itemCount);
    const totalSeconds = Number(summary.totalSeconds);
    const normalizedExpectedCount =
      Number.isFinite(expectedCount) && expectedCount > 0
        ? expectedCount
        : Number.isFinite(itemCount)
          ? itemCount
          : 0;
    const normalizedDurationCount = Number.isFinite(durationCount) ? durationCount : 0;

    return {
      status:
        normalizedDurationCount > 0 &&
        (!normalizedExpectedCount || normalizedDurationCount >= normalizedExpectedCount)
          ? "ready"
          : normalizedDurationCount > 0
            ? "partial"
            : "empty",
      totalSeconds: Number.isFinite(totalSeconds) ? totalSeconds : 0,
      itemCount: Number.isFinite(itemCount) ? itemCount : normalizedDurationCount,
      durationCount: normalizedDurationCount,
      expectedCount: normalizedExpectedCount,
      requestedPageSize: summary.rewrittenPageSize || summary.pageSize || null,
      source: summary.source || "page-network",
      updatedAt: summary.capturedAt || new Date().toISOString(),
      error: "",
    };
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementDurationSummary = {
    formatDuration: formatDuration,
    fetchCompleteSubtaskDurationSummary: fetchCompleteSubtaskDurationSummary,
    normalizeNetworkDurationSummary: normalizeNetworkDurationSummary,
  };
})();
