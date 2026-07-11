(function () {
  const protocol = globalThis.__ASREdgeJudgementNetworkProtocol;

  function summarizeSubtaskData(body, urlText, rewrittenPageSize) {
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

    const url = protocol.parseUrl(urlText);
    const query = {};
    if (url) {
      url.searchParams.forEach(function (value, key) {
        query[key] = value;
      });
    }

    return {
      ok: body?.success !== false && body?.code !== undefined ? body.code === 0 : true,
      subTaskId: String(data.id || ""),
      size: Number.isFinite(Number(data.size)) ? Number(data.size) : null,
      itemCount: dataList.length,
      durationCount: durationCount,
      totalSeconds: totalSeconds,
      page: Number(query.page || 0) || null,
      pageSize: Number(query.pageSize || 0) || null,
      rewrittenPageSize: rewrittenPageSize || null,
      capturedAt: new Date().toISOString(),
      source: "page-network",
    };
  }

  function postSummary(state, summary) {
    state.lastSummaryAt = new Date().toISOString();
    window.postMessage(
      {
        source: protocol.SOURCE_PAGE,
        type: protocol.TYPE_SUBTASK_DATA_SUMMARY,
        payload: {
          summary: protocol.clone(summary),
          state: protocol.clone(state),
        },
      },
      "*"
    );
  }

  function captureBody(state, body, urlText, rewrittenPageSize) {
    const url = protocol.parseUrl(urlText);
    if (!protocol.isSubtaskDataUrl(url)) {
      return;
    }

    postSummary(state, summarizeSubtaskData(body, urlText, rewrittenPageSize));
  }

  function captureFetchResponse(state, response, urlText, rewrittenPageSize) {
    if (!response || typeof response.clone !== "function") {
      return;
    }

    const url = protocol.parseUrl(urlText || response.url || "");
    if (!protocol.isSubtaskDataUrl(url)) {
      return;
    }

    void response
      .clone()
      .json()
      .then(function (body) {
        captureBody(state, body, urlText || response.url || "", rewrittenPageSize);
      })
      .catch(function () {});
  }

  globalThis.__ASREdgeJudgementNetworkSummary = {
    captureBody: captureBody,
    captureFetchResponse: captureFetchResponse,
    summarizeSubtaskData: summarizeSubtaskData,
  };
})();
