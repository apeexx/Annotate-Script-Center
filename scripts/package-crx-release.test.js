"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const releaseScriptPath = path.resolve(__dirname, "package-crx-release.js");
const buildProfilePath = path.resolve(__dirname, "package-crx-build-profile.js");

function loadReleaseInternals(repoRoot) {
  const source = fs.readFileSync(releaseScriptPath, "utf8");
  const mainInvocationMatch = /\r?\ntry \{\r?\n  main\(\);/.exec(source);
  assert.ok(mainInvocationMatch, "release script main invocation should be present");
  const mainInvocationIndex = mainInvocationMatch.index;

  const module = { exports: {} };
  const scriptDirectory = path.join(repoRoot, "scripts");
  fs.mkdirSync(scriptDirectory, { recursive: true });
  const sandbox = {
    Buffer,
    console,
    module,
    exports: module.exports,
    process,
    __dirname: scriptDirectory,
    __filename: path.join(scriptDirectory, "package-crx-release.js"),
    require: function sandboxRequire(identifier) {
      if (identifier === "child_process") {
        return {
          spawnSync: function spawnSync() {
            throw new Error("browser packaging should not run without an existing signing key");
          },
        };
      }
      if (identifier === "./package-crx-build-profile") {
        return require(buildProfilePath);
      }
      return require(identifier);
    },
  };

  vm.runInNewContext(
    `${source.slice(0, mainInvocationIndex)}\nmodule.exports = {\n  ensureCrxAndKey,\n  moveFileSync: typeof moveFileSync === "function" ? moveFileSync : null\n};\n`,
    sandbox,
    { filename: sandbox.__filename }
  );
  return module.exports;
}

test("CRX packaging refuses a missing signing key before it invokes browser packaging", function () {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asc-release-test-"));
  const extensionDirectory = path.join(repoRoot, "extension");
  fs.mkdirSync(extensionDirectory, { recursive: true });

  try {
    const { ensureCrxAndKey } = loadReleaseInternals(repoRoot);

    assert.throws(
      function () {
        ensureCrxAndKey("unused-browser", extensionDirectory);
      },
      /未找到既有 CRX 签名私钥/
    );
    assert.equal(fs.existsSync(path.join(repoRoot, "config", "secrets")), false);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("CRX move falls back to copy when a cross-volume rename reports EXDEV", function () {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asc-release-move-test-"));
  const sourcePath = path.join(repoRoot, "source.crx");
  const destinationPath = path.join(repoRoot, "dist", "release.crx");
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(sourcePath, "crx-content", "utf8");

  const { moveFileSync } = loadReleaseInternals(repoRoot);
  assert.equal(typeof moveFileSync, "function");

  const originalRenameSync = fs.renameSync;
  const originalCopyFileSync = fs.copyFileSync;
  let copyCalls = 0;
  fs.renameSync = function renameSyncAsCrossVolumeMove() {
    const error = new Error("cross-volume rename");
    error.code = "EXDEV";
    throw error;
  };
  fs.copyFileSync = function trackedCopyFileSync() {
    copyCalls += 1;
    return originalCopyFileSync.apply(this, arguments);
  };

  try {
    moveFileSync(sourcePath, destinationPath);
    assert.equal(copyCalls, 1);
    assert.equal(fs.existsSync(sourcePath), false);
    assert.equal(fs.readFileSync(destinationPath, "utf8"), "crx-content");
  } finally {
    fs.renameSync = originalRenameSync;
    fs.copyFileSync = originalCopyFileSync;
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});
