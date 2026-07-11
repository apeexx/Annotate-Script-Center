(function () {
  const LOG_PREFIX = "[ASR Edge][judgement-page-detector]";
  const constants = globalThis.ASREdgeConstants || {};
  const targetHost = constants?.TARGET_PLATFORM?.host || "labelx.alibaba-inc.com";

  const SELECTORS = {
    item: ".labelRender-item[data-index]",
    audioContainer: ".dt-audio-base-container",
    audio: ".dt-audio-base-container audio[controls], audio[controls]",
    radioGroup: ".labelRender-item-answer-wrap .ant-v5-radio-group, .ant-v5-radio-group",
    remarkTextarea:
      '.labelRender-item-answer-wrap textarea[title="填空"], textarea[title="填空"]',
    toolbox: ".mark-toolbox",
  };

  function count(selector) {
    return document.querySelectorAll(selector).length;
  }

  function getLabelingPageType() {
    const pathname = String(location.pathname || "").toLowerCase();

    if (pathname.indexOf("/corpora/labeling/labelingtask") >= 0) {
      return "labeling-task-home";
    }

    if (pathname.indexOf("/corpora/labeling/sdk") >= 0) {
      return "labeling-sdk";
    }

    if (pathname.indexOf("/corpora/labeling/") >= 0) {
      return "labelx-labeling";
    }

    return "labelx-other";
  }

  function detect() {
    if (location.hostname !== targetHost) {
      return {
        isTargetSite: false,
        isJudgementDetail: false,
        pageType: "non-labelx",
        reason: "host-mismatch",
        counts: {},
      };
    }

    const counts = {
      item: count(SELECTORS.item),
      audioContainer: count(SELECTORS.audioContainer),
      audio: count(SELECTORS.audio),
      radioGroup: count(SELECTORS.radioGroup),
      remarkTextarea: count(SELECTORS.remarkTextarea),
      toolbox: count(SELECTORS.toolbox),
    };

    const hasJudgementShape =
      counts.item > 0 &&
      counts.audio > 0 &&
      counts.radioGroup > 0 &&
      counts.remarkTextarea > 0;

    if (hasJudgementShape) {
      return {
        isTargetSite: true,
        isJudgementDetail: true,
        pageType: "judgement-detail",
        reason: "judgement-dom-detected",
        counts: counts,
      };
    }

    const pageType = getLabelingPageType();
    return {
      isTargetSite: true,
      isJudgementDetail: false,
      pageType: counts.item > 0 || counts.audio > 0 ? "judgement-detail-pending" : pageType,
      reason: counts.audio > 0 ? "partial-judgement-dom" : "judgement-dom-not-ready",
      counts: counts,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementPageDetector = {
    detect: detect,
    SELECTORS: SELECTORS,
    LOG_PREFIX: LOG_PREFIX,
  };
})();
