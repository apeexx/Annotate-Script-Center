"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const childProcess = require("child_process");
const {
  buildBuildMetaContent,
  buildManifestForChannel,
  buildReleaseProfile,
  buildReleaseProfiles,
  normalizeReleaseBuildMode,
  normalizeReleaseChannel,
} = require("./package-crx-build-profile");

const APP_NAME = "annotation-script-center";
const REPO_ROOT = path.resolve(__dirname, "..");
const SOURCE_EXTENSION_DIR = path.join(REPO_ROOT, "extension");
const MANIFEST_PATH = path.join(SOURCE_EXTENSION_DIR, "manifest.json");
const DIST_DIR = path.join(REPO_ROOT, "dist");
const KEY_PATH = path.join(REPO_ROOT, "config", "secrets", `${APP_NAME}.pem`);
const DEFAULT_DOWNLOAD_BASE_URL = "https://script.xiangtianzhen.store/downloads/";
const UPDATE_XML_FILENAME = `${APP_NAME}-update.xml`;
const DEFAULT_UPDATE_XML_URL = `${DEFAULT_DOWNLOAD_BASE_URL}${UPDATE_XML_FILENAME}`;
const CRX_LATEST_FILENAME = `${APP_NAME}-crx-latest.json`;
const DEFAULT_MIN_AGENT_VERSION = "0.1.0";
const RELEASE_CONFIG_PATH = path.join(REPO_ROOT, "config", "package-crx-release.json");
const RELEASE_LOCAL_CONFIG_PATH = path.join(
  REPO_ROOT,
  "config",
  "secrets",
  "package-crx-release.local.json"
);
const ZIP_PROTECTED_NAME_PATTERNS = [
  /^config\//i,
  /^platform-resources\//i,
  /^scripts\//i,
  /^docs\//i,
  /^dist\//i,
  /^\.git\//i,
  /^node_modules\//i,
  /statistics-data\//i,
  /export-data\//i,
  /audit-data\//i,
  /config\/secrets\//i,
  /^\.env$/i,
  /^\.env\./i
];

const BROWSER_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const [key, inlineValue] = token.split("=", 2);
    const normalizedKey = key.slice(2);
    if (!normalizedKey) {
      continue;
    }

    if (typeof inlineValue === "string") {
      result[normalizedKey] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];
    if (typeof nextToken === "string" && !nextToken.startsWith("--")) {
      result[normalizedKey] = nextToken;
      index += 1;
      continue;
    }

    result[normalizedKey] = "true";
  }
  return result;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJsonConfigFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, "utf8");
  if (!String(raw || "").trim()) {
    return {};
  }
  const parsed = JSON.parse(raw);
  if (!isPlainObject(parsed)) {
    throw new Error(`配置文件必须是 JSON 对象：${filePath}`);
  }
  return parsed;
}

function loadReleaseConfig() {
  return Object.assign(
    {},
    readJsonConfigFile(RELEASE_CONFIG_PATH),
    readJsonConfigFile(RELEASE_LOCAL_CONFIG_PATH)
  );
}

function normalizeBaseUrl(input) {
  const raw = (input || "").trim();
  const base = raw || DEFAULT_DOWNLOAD_BASE_URL;
  return base.endsWith("/") ? base : `${base}/`;
}

function ensureFileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} 不存在：${filePath}`);
  }
}

function safeUnlink(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function escapeSingleQuotes(value) {
  return String(value || "").replace(/'/g, "''");
}

function readManifestMeta() {
  const manifestText = fs.readFileSync(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(manifestText);
  const version = typeof manifest.version === "string" ? manifest.version.trim() : "";
  if (!version) {
    throw new Error("extension/manifest.json 缺少有效 version");
  }
  if (!manifest.update_url || typeof manifest.update_url !== "string") {
    throw new Error("extension/manifest.json 缺少 update_url，无法用于企业更新");
  }
  if (manifest.update_url.trim() !== DEFAULT_UPDATE_XML_URL) {
    console.warn(
      `[crx-release] 警告：manifest.update_url 当前为 ${manifest.update_url}，建议使用 ${DEFAULT_UPDATE_XML_URL}`
    );
  }
  return { version, updateUrl: manifest.update_url.trim() };
}

function resolveBrowserExecutable() {
  const envPath = (process.env.ASC_CHROME_EXE || "").trim();
  if (envPath) {
    ensureFileExists(envPath, "ASC_CHROME_EXE 指定的浏览器");
    return envPath;
  }

  for (const candidate of BROWSER_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "未找到可用 Chrome/Edge。请设置 ASC_CHROME_EXE 指向 chrome.exe 或 msedge.exe。"
  );
}

function runPackExtension(browserExe, extensionDir, keyPathOrNull) {
  const args = [`--pack-extension=${extensionDir}`];
  if (keyPathOrNull) {
    args.push(`--pack-extension-key=${keyPathOrNull}`);
  }
  const result = childProcess.spawnSync(browserExe, args, {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  if (result.error) {
    throw new Error(`执行浏览器打包失败：${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    throw new Error(
      `浏览器打包返回非 0（${result.status}）。${stderr || stdout || "无额外输出"}`
    );
  }
}

function ensureCrxAndKey(browserExe, extensionDir) {
  const packOutputDir = path.dirname(extensionDir);
  const tempCrxPath = path.join(packOutputDir, "extension.crx");
  const tempPemPath = path.join(packOutputDir, "extension.pem");
  safeUnlink(tempCrxPath);
  safeUnlink(tempPemPath);

  const keyExists = fs.existsSync(KEY_PATH);
  if (keyExists) {
    runPackExtension(browserExe, extensionDir, KEY_PATH);
    ensureFileExists(tempCrxPath, "浏览器打包输出 extension.crx");
    if (fs.existsSync(tempPemPath)) {
      safeUnlink(tempPemPath);
    }
    return { tempCrxPath, generatedNewKey: false };
  }

  fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true });
  runPackExtension(browserExe, extensionDir, null);
  ensureFileExists(tempCrxPath, "浏览器打包输出 extension.crx");
  ensureFileExists(tempPemPath, "浏览器打包输出 extension.pem");
  if (fs.existsSync(KEY_PATH)) {
    throw new Error(`检测到密钥文件已存在，已中止覆盖：${KEY_PATH}`);
  }
  fs.renameSync(tempPemPath, KEY_PATH);
  return { tempCrxPath, generatedNewKey: true };
}

function nibbleToIdChar(nibble) {
  return String.fromCharCode(97 + nibble);
}

function computeExtensionIdFromPrivateKeyPem(pemPath) {
  const privatePem = fs.readFileSync(pemPath, "utf8");
  const privateKey = crypto.createPrivateKey(privatePem);
  const publicDer = crypto.createPublicKey(privateKey).export({
    type: "spki",
    format: "der"
  });
  const digest = crypto.createHash("sha256").update(publicDer).digest();
  let extensionId = "";
  for (let index = 0; index < 16; index += 1) {
    const value = digest[index];
    extensionId += nibbleToIdChar((value >> 4) & 0x0f);
    extensionId += nibbleToIdChar(value & 0x0f);
  }
  return extensionId;
}

function sha256File(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function runCommand(command, args, options) {
  const result = childProcess.spawnSync(command, args, Object.assign(
    {
      cwd: REPO_ROOT,
      encoding: "utf8"
    },
    options || {}
  ));
  if (result.error) {
    throw new Error(`执行命令失败：${command} ${args.join(" ")} | ${result.error.message}`);
  }
  return result;
}

function createZipArchive(zipOutputPath, extensionDir) {
  safeUnlink(zipOutputPath);
  if (process.platform === "win32") {
    const commandText = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.IO.Compression",
      "Add-Type -AssemblyName System.IO.Compression.FileSystem",
      `$source='${escapeSingleQuotes(extensionDir)}'`,
      `$destination='${escapeSingleQuotes(zipOutputPath)}'`,
      "if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }",
      "$zip=[System.IO.Compression.ZipFile]::Open($destination,[System.IO.Compression.ZipArchiveMode]::Create)",
      "try {",
      "  Get-ChildItem -LiteralPath $source -Recurse -File | ForEach-Object {",
      "    $relative=$_.FullName.Substring($source.Length).TrimStart('\\')",
      "    $entryName=$relative.Replace('\\','/')",
      "    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$entryName) | Out-Null",
      "  }",
      "} finally {",
      "  $zip.Dispose()",
      "}"
    ].join("; ");
    const result = runCommand("powershell.exe", ["-NoProfile", "-Command", commandText], {
      cwd: REPO_ROOT
    });
    if (result.status !== 0) {
      throw new Error(`ZIP 打包失败（PowerShell）：${(result.stderr || result.stdout || "").trim() || "无额外输出"}`);
    }
    return "powershell";
  }

  const probe = runCommand("zip", ["-v"], { cwd: extensionDir });
  if (probe.status !== 0) {
    throw new Error("未找到可用 ZIP 工具。Windows 请使用 PowerShell Compress-Archive；Linux/macOS 请安装 zip。");
  }
  const result = runCommand("zip", ["-r", zipOutputPath, "."], { cwd: extensionDir });
  if (result.status !== 0) {
    throw new Error(`ZIP 打包失败（zip）：${(result.stderr || result.stdout || "").trim() || "无额外输出"}`);
  }
  return "zip";
}

function listZipEntries(zipOutputPath) {
  if (process.platform === "win32") {
    const commandText = [
      "Add-Type -AssemblyName System.IO.Compression.FileSystem;",
      `$z=[System.IO.Compression.ZipFile]::OpenRead('${escapeSingleQuotes(zipOutputPath)}');`,
      "$z.Entries | ForEach-Object { $_.FullName };",
      "$z.Dispose();"
    ].join(" ");
    const result = runCommand("powershell.exe", ["-NoProfile", "-Command", commandText], {
      cwd: REPO_ROOT
    });
    if (result.status !== 0) {
      throw new Error(`读取 ZIP 内容失败（PowerShell）：${(result.stderr || result.stdout || "").trim() || "无额外输出"}`);
    }
    return String(result.stdout || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const result = runCommand("unzip", ["-Z", "-1", zipOutputPath], { cwd: REPO_ROOT });
  if (result.status !== 0) {
    throw new Error(`读取 ZIP 内容失败（unzip）：${(result.stderr || result.stdout || "").trim() || "无额外输出"}`);
  }
  return String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function validateZipArchive(zipOutputPath) {
  ensureFileExists(zipOutputPath, "ZIP 产物");
  const stat = fs.statSync(zipOutputPath);
  if (!Number.isFinite(stat.size) || stat.size <= 0) {
    throw new Error(`ZIP 文件为空：${zipOutputPath}`);
  }
  const entries = listZipEntries(zipOutputPath);
  const hasManifest = entries.some((entry) => /(^|[\\/])manifest\.json$/i.test(String(entry || "")));
  if (!hasManifest) {
    throw new Error("ZIP 校验失败：未找到 manifest.json");
  }
  const hasRootManifest = entries.includes("manifest.json");
  if (!hasRootManifest) {
    console.warn("[crx-release] 警告：ZIP 内未检测到根层 manifest.json，已按包含 manifest.json 放行。");
  }

  const violated = entries.find((entry) =>
    ZIP_PROTECTED_NAME_PATTERNS.some((pattern) => pattern.test(String(entry || "")))
  );
  if (violated) {
    throw new Error(`ZIP 校验失败：检测到不应包含的路径 ${violated}`);
  }

  return {
    sizeBytes: stat.size,
    sha256: sha256File(zipOutputPath),
    entriesCount: entries.length
  };
}

function createPreparedExtensionBuild(options) {
  const config = options && typeof options === "object" ? options : {};
  const channel = normalizeReleaseChannel(config.channel);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${APP_NAME}-${channel}-`));
  const extensionDir = path.join(tempRoot, "extension");
  fs.cpSync(SOURCE_EXTENSION_DIR, extensionDir, { recursive: true });

  const manifestPath = path.join(extensionDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const nextManifest = buildManifestForChannel(manifest, channel);
  fs.writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");

  const buildMetaPath = path.join(extensionDir, "shared", "build-meta.js");
  fs.writeFileSync(
    buildMetaPath,
    buildBuildMetaContent({
      releaseChannel: channel,
    }),
    "utf8"
  );

  return {
    tempRoot,
    extensionDir,
    manifest: nextManifest,
  };
}

function buildUpdateXml(extensionId, codebaseUrl, version) {
  return [
    "<?xml version='1.0' encoding='UTF-8'?>",
    "<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>",
    `  <app appid='${extensionId}'>`,
    `    <updatecheck codebase='${codebaseUrl}' version='${version}' />`,
    "  </app>",
    "</gupdate>",
    ""
  ].join("\n");
}

function validateCrxLatestPayload(payload) {
  const required = [
    "name",
    "release_type",
    "latest_version",
    "extension_id",
    "filename",
    "download_url",
    "update_xml_url",
    "sha256",
    "size_bytes",
    "created_at",
    "min_agent_version",
    "release_notes"
  ];
  for (const key of required) {
    if (!payload[key]) {
      throw new Error(`crx latest json 缺少字段：${key}`);
    }
  }
  if (!/^[a-f0-9]{64}$/i.test(String(payload.sha256))) {
    throw new Error("crx latest json 的 sha256 不是 64 位 hex");
  }
}

function validateUpdateXml(xmlText, extensionId, codebaseUrl, version) {
  const requiredSnippets = [
    "<gupdate",
    "<app ",
    "<updatecheck ",
    `appid='${extensionId}'`,
    `codebase='${codebaseUrl}'`,
    `version='${version}'`
  ];
  for (const snippet of requiredSnippets) {
    if (!xmlText.includes(snippet)) {
      throw new Error(`update.xml 缺少关键片段：${snippet}`);
    }
  }
}

function packageReleaseProfile(options) {
  const config = options && typeof options === "object" ? options : {};
  const version = String(config.version || "").trim();
  const browserExe = String(config.browserExe || "").trim();
  const downloadBaseUrl = normalizeBaseUrl(config.downloadBaseUrl);
  const releaseNotes = String(config.releaseNotes || "").trim() || `${APP_NAME} release ${version}`;
  const profile = config.profile;
  if (!profile || typeof profile !== "object") {
    throw new Error("缺少有效打包 profile。");
  }

  const preparedBuild = createPreparedExtensionBuild({
    channel: profile.channel,
  });

  try {
    fs.mkdirSync(DIST_DIR, { recursive: true });
    const crxFilename = profile.crxFilename;
    const zipFilename = profile.zipFilename;
    const crxOutputPath = crxFilename ? path.join(DIST_DIR, crxFilename) : "";
    const zipOutputPath = zipFilename ? path.join(DIST_DIR, zipFilename) : "";
    const updateXmlPath = profile.includeUpdateXml
      ? path.join(DIST_DIR, UPDATE_XML_FILENAME)
      : "";
    const crxLatestPath = profile.includeLatestJson
      ? path.join(DIST_DIR, CRX_LATEST_FILENAME)
      : "";

    let generatedNewKey = false;
    let extensionId = "";
    let stat = null;
    let downloadUrl = "";
    if (crxFilename) {
      const crxPackResult = ensureCrxAndKey(browserExe, preparedBuild.extensionDir);
      safeUnlink(crxOutputPath);
      fs.renameSync(crxPackResult.tempCrxPath, crxOutputPath);
      ensureFileExists(KEY_PATH, "CRX 私钥文件");
      generatedNewKey = crxPackResult.generatedNewKey;
      extensionId = computeExtensionIdFromPrivateKeyPem(KEY_PATH);
      stat = fs.statSync(crxOutputPath);
      downloadUrl = `${downloadBaseUrl}${crxFilename}`;
    }

    let zipPackTool = "";
    let zipMeta = null;
    if (profile.includeZip && zipOutputPath) {
      zipPackTool = createZipArchive(zipOutputPath, preparedBuild.extensionDir);
      zipMeta = validateZipArchive(zipOutputPath);
    }

    if (profile.includeUpdateXml && updateXmlPath) {
      const updateXml = buildUpdateXml(extensionId, downloadUrl, version);
      validateUpdateXml(updateXml, extensionId, downloadUrl, version);
      fs.writeFileSync(updateXmlPath, updateXml, "utf8");
    }

    if (profile.includeLatestJson && crxLatestPath && zipMeta) {
      const zipDownloadUrl = `${downloadBaseUrl}${zipFilename}`;
      const updateXmlUrl = `${downloadBaseUrl}${UPDATE_XML_FILENAME}`;
      const crxLatestPayload = {
        name: APP_NAME,
        release_type: "crx",
        latest_version: version,
        extension_id: extensionId,
        filename: crxFilename,
        download_url: downloadUrl,
        update_xml_url: updateXmlUrl,
        sha256: sha256File(crxOutputPath),
        size_bytes: stat ? stat.size : 0,
        zip_filename: zipFilename,
        zip_download_url: zipDownloadUrl,
        zip_sha256: zipMeta.sha256,
        zip_size_bytes: zipMeta.sizeBytes,
        created_at: new Date().toISOString(),
        min_agent_version: DEFAULT_MIN_AGENT_VERSION,
        release_notes: releaseNotes
      };
      validateCrxLatestPayload(crxLatestPayload);
      fs.writeFileSync(crxLatestPath, `${JSON.stringify(crxLatestPayload, null, 2)}\n`, "utf8");
    }

    return {
      channel: profile.channel,
      crxOutputPath,
      zipOutputPath,
      updateXmlPath,
      crxLatestPath,
      extensionId,
      generatedNewKey,
      zipPackTool,
      zipEntriesCount: zipMeta ? zipMeta.entriesCount : 0,
    };
  } finally {
    if (preparedBuild?.tempRoot && fs.existsSync(preparedBuild.tempRoot)) {
      fs.rmSync(preparedBuild.tempRoot, { recursive: true, force: true });
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const releaseConfig = loadReleaseConfig();
  const { version } = readManifestMeta();
  const downloadBaseUrl = normalizeBaseUrl(
    args.downloadBaseUrl || process.env.ASC_DOWNLOAD_BASE_URL || releaseConfig.downloadBaseUrl
  );
  const buildMode = normalizeReleaseBuildMode(
    args.channel || process.env.ASC_RELEASE_CHANNEL || releaseConfig.channel
  );
  const releaseNotes = typeof args.notes === "string" && args.notes.trim()
    ? args.notes.trim()
    : `${APP_NAME} release ${version}`;
  const profiles = buildReleaseProfiles(buildMode, version);
  const needsCrxArtifacts = profiles.some(function (profile) {
    return Boolean(profile.crxFilename);
  });
  const browserExe = needsCrxArtifacts ? resolveBrowserExecutable() : "";

  const results = profiles.map(function (profile) {
    return packageReleaseProfile({
      version,
      browserExe,
      downloadBaseUrl,
      releaseNotes,
      profile,
    });
  });

  console.log("release generated:");
  results.forEach(function (result) {
    const profile = buildReleaseProfile(result.channel, version);
    console.log(`- channel: ${result.channel}`);
    if (result.crxOutputPath) {
      console.log(`  CRX: ${result.crxOutputPath}`);
    }
    if (profile.includeZip && result.zipOutputPath) {
      console.log(`  ZIP: ${result.zipOutputPath}`);
    }
    if (profile.includeUpdateXml && result.updateXmlPath) {
      console.log(`  update.xml: ${result.updateXmlPath}`);
    }
    if (profile.includeLatestJson && result.crxLatestPath) {
      console.log(`  latest json: ${result.crxLatestPath}`);
    }
    console.log(`  extension id: ${result.extensionId}`);
    if (result.zipPackTool) {
      console.log(`  zip pack tool: ${result.zipPackTool}, entries: ${result.zipEntriesCount}`);
    }
  });
  console.log("");
  console.log("当前手工分发文件：");
  let outputIndex = 1;
  results.forEach(function (result) {
    if (result.crxOutputPath) {
      console.log(`${outputIndex}. ${result.crxOutputPath}`);
      outputIndex += 1;
    }
    if (result.zipOutputPath) {
      console.log(`${outputIndex}. ${result.zipOutputPath}`);
      outputIndex += 1;
    }
  });
  const publicResult = results.find(function (result) {
    return result.channel === "public";
  });
  if (publicResult && publicResult.updateXmlPath && publicResult.crxLatestPath) {
    console.log("");
    console.log("企业自动更新预留文件：");
    console.log(`1. ${publicResult.updateXmlPath}`);
    console.log(`2. ${publicResult.crxLatestPath}`);
  }
  if (results.some(function (result) { return result.generatedNewKey; })) {
    console.log(
      `首次生成私钥：${KEY_PATH}。请离线备份该 pem；丢失会导致 extension ID 变化并需要重配企业策略。`
    );
  }
}

try {
  main();
} catch (error) {
  console.error(`[crx-release] ${error.message}`);
  process.exitCode = 1;
}
