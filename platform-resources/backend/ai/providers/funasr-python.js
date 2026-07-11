"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { TextDecoder } = require("util");

const {
  DEFAULT_FUN_ASR_MODEL,
  getFunAsrPythonConfig,
} = require("../config");
const {
  createPythonRuntimeError,
} = require("../errors");
const { sanitizeProviderErrorSummary } = require("../sanitizer");

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });

function decodeUtf8Chunks(chunks) {
  const buffers = Array.isArray(chunks) ? chunks.filter(Buffer.isBuffer) : [];
  if (buffers.length <= 0) {
    return "";
  }
  return UTF8_DECODER.decode(Buffer.concat(buffers));
}

function isHeardTextLikelyMojibake(text) {
  const value = String(text || "").trim();
  if (!value) {
    return false;
  }
  const replacementCount = (value.match(/\uFFFD/g) || []).length;
  if (replacementCount >= 3) {
    return true;
  }
  if (replacementCount >= 1 && value.length <= 32) {
    return true;
  }
  return replacementCount > 0 && replacementCount / Math.max(value.length, 1) >= 0.08;
}

function resolvePythonBin() {
  const config = getFunAsrPythonConfig();
  if (config.pythonBin) {
    return {
      pythonBin: config.pythonBin,
      source: "env",
      exists: fs.existsSync(config.pythonBin),
    };
  }
  const candidate = config.defaultPythonCandidates.find(function (item) {
    return fs.existsSync(item);
  });
  if (candidate) {
    return {
      pythonBin: candidate,
      source: "venv",
      exists: true,
    };
  }
  return {
    pythonBin: "",
    source: "missing",
    exists: false,
  };
}

function getFunAsrClientConfig() {
  const config = getFunAsrPythonConfig();
  const pythonResolution = resolvePythonBin();
  return Object.assign({}, config, {
    pythonBin: pythonResolution.pythonBin,
    pythonSource: pythonResolution.source,
    pythonExists: pythonResolution.exists,
    pythonScriptPath: config.defaultScriptPath,
  });
}

function createPythonEnvironmentMissingError() {
  return createPythonRuntimeError(
    "Fun-ASR Python 环境未配置，请在 platform-resources/backend/.venv 创建统一 Python 虚拟环境，并执行 .venv\\Scripts\\python.exe -m pip install -r ai\\python\\requirements.txt。",
    "fun-asr-python-not-configured",
    503
  );
}

function createJsonParseError(stdoutText, stderrText) {
  return createPythonRuntimeError(
    "Fun-ASR Python 输出解析失败。",
    "fun-asr-python-invalid-output",
    502,
    stdoutText || stderrText || ""
  );
}

function normalizeFailureMessage(code, providerStatus, message) {
  if (code === "fun-asr-python-not-configured") {
    return "Fun-ASR Python 环境未配置，请在 platform-resources/backend/.venv 创建统一 Python 虚拟环境，并执行 .venv\\Scripts\\python.exe -m pip install -r ai\\python\\requirements.txt。";
  }
  if (code === "invalid-fun-asr-model") {
    return "Fun-ASR 模型名应为 fun-asr。";
  }
  if (code === "fun-asr-audio-url-unreachable") {
    return "Fun-ASR 调用被拒绝。当前更像是平台音频 URL 对模型服务不可访问，可先切换到 qwen3.5-omni-flash 或 qwen3.5-omni-plus 恢复使用。";
  }
  if (code === "fun-asr-mojibake-text") {
    return "Fun-ASR 返回文本疑似编码异常，请检查 Python stdout UTF-8 配置或结果文件编码。";
  }
  if (providerStatus === 403 || code === "fun-asr-forbidden") {
    return "Fun-ASR 调用被拒绝。可能是 DashScope 权限/地域未开通、API Key 无权限，或平台音频 URL 无法被 Fun-ASR 服务访问。可先切换到 qwen3.5-omni-flash 或 qwen3.5-omni-plus 恢复使用。";
  }
  return String(message || "Fun-ASR 调用失败。").slice(0, 240);
}

function runPythonClient(payload, timeoutMs, clientConfig) {
  const config =
    clientConfig && typeof clientConfig === "object"
      ? clientConfig
      : getFunAsrClientConfig();
  if (!config.pythonBin) {
    return Promise.reject(createPythonEnvironmentMissingError());
  }
  if (config.pythonSource === "env" && !config.pythonExists) {
    return Promise.reject(
      createPythonRuntimeError(
        "DATABAKER_FUNASR_PYTHON_BIN 指向的 Python 不存在，请检查路径。",
        "fun-asr-python-not-configured",
        503
      )
    );
  }
  return new Promise(function (resolve, reject) {
    const requestId = String(payload?.requestId || payload?.traceId || "").trim();
    const spawnedAt = Date.now();
    console.info("[FunASR] spawn start", {
      requestId,
      model: String(payload?.model || "").trim(),
      pythonSource: config.pythonSource,
      hasPythonBin: config.pythonExists === true,
      timeoutMs: Math.max(1000, Number(timeoutMs) || config.timeoutMs),
    });
    const child = spawn(config.pythonBin, [config.pythonScriptPath], {
      cwd: path.dirname(config.pythonScriptPath),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: Object.assign({}, process.env, {
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      }),
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    let settled = false;
    const timer = setTimeout(function () {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      console.info("[FunASR] spawn finish", {
        requestId,
        durationMs: Math.max(0, Date.now() - spawnedAt),
        success: false,
        rawStatus: "timeout",
      });
      const stderrText = sanitizeProviderErrorSummary(decodeUtf8Chunks(stderrChunks));
      reject(
        createPythonRuntimeError("Fun-ASR Python 调用超时。", "timeout", 504, stderrText)
      );
    }, Math.max(1000, Number(timeoutMs) || config.timeoutMs));

    child.stdout.on("data", function (chunk) {
      stdoutChunks.push(Buffer.from(chunk || ""));
    });
    child.stderr.on("data", function (chunk) {
      stderrChunks.push(Buffer.from(chunk || ""));
    });
    child.on("error", function (error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      console.info("[FunASR] spawn finish", {
        requestId,
        durationMs: Math.max(0, Date.now() - spawnedAt),
        success: false,
        rawStatus: "launch-error",
      });
      const stderrText = sanitizeProviderErrorSummary(decodeUtf8Chunks(stderrChunks));
      if (error?.code === "ENOENT") {
        reject(createPythonEnvironmentMissingError());
        return;
      }
      reject(
        createPythonRuntimeError(
          "Fun-ASR Python 进程启动失败。",
          "fun-asr-python-launch-failed",
          502,
          error?.message || stderrText
        )
      );
    });
    child.on("close", function (code) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      const stdoutText = decodeUtf8Chunks(stdoutChunks).trim();
      const stderrText = sanitizeProviderErrorSummary(decodeUtf8Chunks(stderrChunks));
      let parsed = null;
      try {
        parsed = JSON.parse(stdoutText || "{}");
      } catch (error) {
        console.info("[FunASR] spawn finish", {
          requestId,
          durationMs: Math.max(0, Date.now() - spawnedAt),
          success: false,
          rawStatus: "",
        });
        reject(createJsonParseError(stdoutText, stderrText));
        return;
      }
      console.info("[FunASR] spawn finish", {
        requestId,
        durationMs: Math.max(0, Date.now() - spawnedAt),
        success: parsed?.success === true && code === 0,
        rawStatus: String(parsed?.rawStatus || "").trim(),
      });
      if (code !== 0 && parsed?.success !== false) {
        reject(
          createPythonRuntimeError(
            "Fun-ASR Python 进程执行失败。",
            "fun-asr-python-process-failed",
            502,
            stderrText || stdoutText
          )
        );
        return;
      }
      resolve({
        payload: parsed,
        stderrText,
      });
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

async function requestFunAsrRecognition(input, options) {
  const overrideConfig =
    options && options.clientConfig && typeof options.clientConfig === "object"
      ? options.clientConfig
      : {};
  const baseConfig = getFunAsrClientConfig();
  const config = Object.assign({}, baseConfig, overrideConfig);
  if (overrideConfig.pythonBin) {
    config.pythonBin = String(overrideConfig.pythonBin || "").trim();
    config.pythonSource = overrideConfig.pythonSource
      ? String(overrideConfig.pythonSource)
      : "override";
    config.pythonExists = fs.existsSync(config.pythonBin);
  }
  if (overrideConfig.pythonScriptPath) {
    config.pythonScriptPath = String(overrideConfig.pythonScriptPath || "").trim();
  }
  const model = String(options?.model || config.model || DEFAULT_FUN_ASR_MODEL).trim() || DEFAULT_FUN_ASR_MODEL;
  if (config.mockEnabled) {
    return {
      model,
      heardText: String(input?.pageText || "").trim() || "mock 听音文本",
      confidence: 0.82,
      usage: {},
      mock: true,
      taskId: "mock-task",
      rawStatus: "MOCK",
    };
  }
  if (!config.hasApiKey) {
    throw createPythonRuntimeError("缺少 DASHSCOPE_API_KEY。", "missing-api-key", 503);
  }
  const timeoutMs = Math.max(1000, Number(options?.timeoutMs) || config.timeoutMs);
  const result = await runPythonClient(
    {
      requestId: String(options?.requestId || options?.traceId || "").trim(),
      audioUrl: String(input?.audioUrl || ""),
      model,
      languageHints: config.languageHints,
      timeoutMs,
      baseHttpApiUrl: config.sdkBaseHttpApiUrl,
    },
    timeoutMs,
    config
  );
  const payload = result.payload && typeof result.payload === "object" ? result.payload : {};
  if (payload.success !== true) {
    const providerStatus = Number(payload.providerStatus) || 0;
    const code = String(payload.code || "fun-asr-python-error");
    const error = createPythonRuntimeError(
      normalizeFailureMessage(code, providerStatus, payload.message),
      code,
      providerStatus > 0 ? providerStatus : 502,
      payload.message || result.stderrText || ""
    );
    if (providerStatus > 0) {
      error.providerStatus = providerStatus;
    }
    throw error;
  }
  const heardText = String(payload.heardText || "").trim();
  if (!heardText) {
    throw createPythonRuntimeError(
      "Fun-ASR 未返回可用转写文本。",
      "fun-asr-empty-text",
      502,
      result.stderrText
    );
  }
  if (isHeardTextLikelyMojibake(heardText)) {
    throw createPythonRuntimeError(
      "Fun-ASR 返回文本疑似编码异常，请检查 Python stdout UTF-8 配置或结果文件编码。",
      "fun-asr-mojibake-text",
      502,
      result.stderrText
    );
  }
  return {
    model: String(payload.model || model).trim() || model,
    heardText,
    confidence: Number(payload.confidence || 0),
    usage: {},
    mock: false,
    simplifiedChineseNormalized: payload.simplifiedChineseNormalized === true,
    simplifiedChineseSource: String(payload.simplifiedChineseSource || "").trim(),
    taskId: String(payload.taskId || "").trim(),
    rawStatus: String(payload.rawStatus || "").trim(),
  };
}

module.exports = {
  DEFAULT_FUN_ASR_MODEL,
  getFunAsrClientConfig,
  requestFunAsrRecognitionPython: requestFunAsrRecognition,
  requestFunAsrRecognition,
};
