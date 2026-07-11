"use strict";

function normalizeReleaseChannel(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text === "public") {
    return "public";
  }
  throw new Error("仅支持 public 发布通道。");
}

function normalizeReleaseBuildMode(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text === "public") {
    return "public";
  }
  throw new Error("仅支持 public 发布通道。");
}

function buildReleaseProfile(channel, version) {
  const normalizedChannel = normalizeReleaseChannel(channel);
  return {
    channel: normalizedChannel,
    crxFilename: `annotation-script-center-v${version}.crx`,
    zipFilename: `annotation-script-center-v${version}.zip`,
    includeZip: true,
    includeUpdateXml: true,
    includeLatestJson: true,
  };
}

function buildReleaseProfiles(mode, version) {
  const normalizedMode = normalizeReleaseBuildMode(mode);
  return [buildReleaseProfile(normalizedMode, version)];
}

function buildManifestForChannel(manifest, channel) {
  normalizeReleaseChannel(channel);
  const source = manifest && typeof manifest === "object" ? manifest : {};
  const nextManifest = JSON.parse(JSON.stringify(source));
  delete nextManifest.version_name;
  return nextManifest;
}

function buildBuildMetaContent(input) {
  const config = input && typeof input === "object" ? input : {};
  const releaseChannel = normalizeReleaseChannel(config.releaseChannel);
  return [
    "(function () {",
    "  globalThis.ASREdgeBuildMeta = {",
    `    releaseChannel: ${JSON.stringify(releaseChannel)},`,
    "  };",
    "})();",
    "",
  ].join("\n");
}

module.exports = {
  buildBuildMetaContent,
  buildManifestForChannel,
  buildReleaseProfile,
  buildReleaseProfiles,
  normalizeReleaseBuildMode,
  normalizeReleaseChannel,
};
