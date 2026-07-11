(function () {
  function createRuntime(deps) {
    const options = deps && typeof deps === "object" ? deps : {};
    let toastContainer = null;
    let toastTimer = null;

    function isTopLevelContext() {
      return typeof options.isTopLevelContext === "function" ? options.isTopLevelContext() : window.top === window.self;
    }

    function ensureToastContainer() {
      if (toastContainer && toastContainer.isConnected) {
        return toastContainer;
      }

      toastContainer = document.createElement("div");
      toastContainer.setAttribute("data-asr-edge-judgement-toast", "true");
      Object.assign(toastContainer.style, {
        position: "fixed",
        top: "18px",
        right: "18px",
        zIndex: "2147483647",
        maxWidth: "320px",
        padding: "10px 14px",
        borderRadius: "12px",
        background: "rgba(15, 23, 42, 0.92)",
        color: "#f8fafc",
        fontSize: "13px",
        lineHeight: "1.5",
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.28)",
        pointerEvents: "none",
        opacity: "0",
        transform: "translateY(-6px)",
        transition: "opacity 140ms ease, transform 140ms ease",
      });

      (document.body || document.documentElement || document).appendChild(toastContainer);
      return toastContainer;
    }

    function show(message, tone) {
      if (!message || !isTopLevelContext()) {
        return;
      }

      const node = ensureToastContainer();
      node.textContent = String(message);
      node.style.background =
        tone === "error" ? "rgba(185, 28, 28, 0.94)" : "rgba(15, 23, 42, 0.92)";
      node.style.opacity = "1";
      node.style.transform = "translateY(0)";

      if (toastTimer) {
        window.clearTimeout(toastTimer);
      }

      toastTimer = window.setTimeout(function () {
        node.style.opacity = "0";
        node.style.transform = "translateY(-6px)";
        toastTimer = null;
      }, 1600);
    }

    return {
      show: show,
    };
  }

  globalThis.__ASREdgeAlibabaLabelxJudgementToast = {
    createRuntime: createRuntime,
  };
})();
