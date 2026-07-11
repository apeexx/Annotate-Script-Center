"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_ENV_FILES = [
  path.join(REPO_ROOT, "config", "env", "backend.env"),
  path.join(REPO_ROOT, "config", "env", "backend.local.env"),
  path.join(REPO_ROOT, "config", "env", "ai.env"),
  path.join(REPO_ROOT, "config", "env", "ai.local.env"),
  path.join(REPO_ROOT, ".env.local"),
];

function stripInlineComment(value) {
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previousChar = index > 0 ? value[index - 1] : "";
    if ((char === '"' || char === "'") && previousChar !== "\\") {
      quote = quote === char ? "" : quote || char;
      continue;
    }
    if (!quote && char === "#" && (index === 0 || /\s/.test(previousChar))) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value;
}

function unquoteValue(value) {
  const text = stripInlineComment(String(value || "").trim());
  if (text.length < 2) {
    return text;
  }
  const firstChar = text[0];
  const lastChar = text[text.length - 1];
  if (firstChar === '"' && lastChar === '"') {
    return text
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  if (firstChar === "'" && lastChar === "'") {
    return text.slice(1, -1);
  }
  return text;
}

function parseEnvLine(line) {
  const trimmedLine = String(line || "").trim();
  if (!trimmedLine || trimmedLine.startsWith("#")) {
    return null;
  }

  const normalizedLine = trimmedLine.startsWith("export ")
    ? trimmedLine.slice("export ".length).trimStart()
    : trimmedLine;
  const equalsIndex = normalizedLine.indexOf("=");
  if (equalsIndex <= 0) {
    return null;
  }

  const key = normalizedLine.slice(0, equalsIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  return {
    key,
    value: unquoteValue(normalizedLine.slice(equalsIndex + 1)),
  };
}

function parseEnvText(text) {
  const result = {};
  String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .forEach(function (line) {
      const entry = parseEnvLine(line);
      if (entry) {
        result[entry.key] = entry.value;
      }
    });
  return result;
}

function loadEnvFile(filePath, options) {
  const config = options && typeof options === "object" ? options : {};
  const resolvedPath = path.resolve(String(filePath || ""));
  if (!fs.existsSync(resolvedPath)) {
    return {
      filePath: resolvedPath,
      loaded: false,
      reason: "missing",
      keys: [],
    };
  }

  try {
    const protectedKeys = config.protectedKeys instanceof Set ? config.protectedKeys : null;
    const overwriteLoaded = config.overwriteLoaded === true;
    const parsed = parseEnvText(fs.readFileSync(resolvedPath, "utf8"));
    const loadedKeys = [];
    Object.keys(parsed).forEach(function (key) {
      if (protectedKeys && protectedKeys.has(key)) {
        return;
      }
      if (!overwriteLoaded && process.env[key] !== undefined) {
        return;
      }
      process.env[key] = parsed[key];
      loadedKeys.push(key);
    });
    return {
      filePath: resolvedPath,
      loaded: true,
      keys: loadedKeys,
    };
  } catch (error) {
    console.warn("[Platform Resources][backend] env file load failed", {
      filePath: resolvedPath,
      message: String(error?.message || "unknown").slice(0, 160),
    });
    return {
      filePath: resolvedPath,
      loaded: false,
      reason: "error",
      keys: [],
    };
  }
}

function collectDefaultEnvFiles() {
  const files = DEFAULT_ENV_FILES.slice();
  const ascEnvFile = String(process.env.ASC_ENV_FILE || "").trim();
  if (ascEnvFile) {
    files.push(path.resolve(REPO_ROOT, ascEnvFile));
  }
  return files;
}

function loadDefaultEnvFiles() {
  const protectedKeys = new Set(Object.keys(process.env));
  return collectDefaultEnvFiles().map(function (filePath) {
    return loadEnvFile(filePath, {
      overwriteLoaded: true,
      protectedKeys,
    });
  });
}

module.exports = {
  DEFAULT_ENV_FILES,
  REPO_ROOT,
  loadDefaultEnvFiles,
  loadEnvFile,
  parseEnvText,
};
