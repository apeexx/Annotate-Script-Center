"use strict";

const fs = require("fs");
const path = require("path");

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveAssetPath(baseDir, relativePath) {
  return path.resolve(baseDir || process.cwd(), String(relativePath || ""));
}

function readOptionalUtf8File(filePath, optional) {
  if (optional === true && !fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

function loadAssetValue(baseDir, descriptor) {
  if (descriptor == null) {
    return null;
  }

  if (typeof descriptor === "string") {
    return descriptor;
  }

  if (!isPlainObject(descriptor)) {
    return descriptor;
  }

  if (Object.prototype.hasOwnProperty.call(descriptor, "inline")) {
    return descriptor.inline;
  }

  if (descriptor.path) {
    return readOptionalUtf8File(resolveAssetPath(baseDir, descriptor.path), descriptor.optional === true);
  }

  if (descriptor.jsonPath) {
    const jsonText = readOptionalUtf8File(
      resolveAssetPath(baseDir, descriptor.jsonPath),
      descriptor.optional === true
    );
    if (jsonText === null) {
      return null;
    }
    return JSON.parse(jsonText);
  }

  return Object.assign({}, descriptor);
}

function loadProjectAssets(adapter, options) {
  const source = adapter && typeof adapter === "object" ? adapter : {};
  const runtimeOptions = options && typeof options === "object" ? options : {};
  const assets = isPlainObject(source.assets) ? source.assets : {};
  const baseDir = runtimeOptions.baseDir || source.baseDir || process.cwd();
  const resolvedAssets = {};

  Object.keys(assets).forEach(function loadAsset(key) {
    resolvedAssets[key] = loadAssetValue(baseDir, assets[key]);
  });

  return resolvedAssets;
}

module.exports = {
  loadProjectAssets,
  loadAssetValue,
};
