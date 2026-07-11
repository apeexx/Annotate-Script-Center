"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createAdminSessionToken,
  createPasswordSha256,
} = require("../../admin-auth");
const {
  FILE_PATH,
  REQUEST_PATH,
  registerProjectDataDownloadRoutes,
} = require("../routes");

function createRouter() {
  const routes = [];
  return {
    routes,
    get(pathname, handler) {
      routes.push({ method: "GET", pathname, handler });
    },
    post(pathname, handler) {
      routes.push({ method: "POST", pathname, handler });
    },
    head(pathname, handler) {
      routes.push({ method: "HEAD", pathname, handler });
    },
  };
}

function createRequest(body, headers) {
  return {
    headers: headers || {},
    on(eventName, handler) {
      if (eventName === "data") {
        handler(Buffer.from(body, "utf8"));
        return;
      }
      if (eventName === "end") {
        process.nextTick(handler);
      }
    },
    destroy() {},
  };
}

function createResponse() {
  return {
    statusCode: 0,
    body: "",
    headers: {},
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers || {};
    },
    end(body) {
      this.body = String(body || "");
    },
  };
}

test("project data download request accepts admin bearer token without password", async function () {
  const tempDir = fs.mkdtempSync(path.join(__dirname, "tmp-project-data-"));
  const csvPath = path.join(tempDir, "statistics-merged.csv");
  fs.writeFileSync(csvPath, "\uFEFF分包ID,任务名称\nB-1,测试任务\n", "utf8");

  process.env.ASC_PROJECT_DATA_DOWNLOAD_PASSWORD_SHA256 = createPasswordSha256("download-pass");
  process.env.ASC_PROJECT_DATA_DOWNLOAD_JWT_SECRET = "secret-project-data";

  const issued = createAdminSessionToken(
    {
      operatorName: "管理员",
    },
    {
      jwtSecret: "secret-project-data",
    }
  );

  const router = createRouter();
  registerProjectDataDownloadRoutes(router, {
    datasets: [
      {
        id: "test-project-data",
        label: "测试项目数据",
        defaultFileName: "test-project-data.csv",
        getCsvPath() {
          return csvPath;
        },
      },
    ],
  });

  const route = router.routes.find(function (item) {
    return item.method === "POST" && item.pathname === REQUEST_PATH;
  });

  const response = createResponse();
  await route.handler({
    request: createRequest(
      JSON.stringify({
        dataset: "test-project-data",
        operatorName: "傅成林",
      }),
      {
        authorization: "Bearer " + issued.token,
      }
    ),
    response,
  });

  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.success, true);
  assert.ok(body.data.downloadUrl);
});

test("project data download request accepts explicit all-suppliers selection", async function () {
  const tempDir = fs.mkdtempSync(path.join(__dirname, "tmp-project-data-all-"));
  const csvPath = path.join(tempDir, "statistics-merged.csv");
  fs.writeFileSync(
    csvPath,
    "\uFEFF分包ID,任务名称,供应商\nB-1,海天 任务,海天\nB-2,贝壳 任务,希尔贝壳\n",
    "utf8"
  );

  process.env.ASC_PROJECT_DATA_DOWNLOAD_PASSWORD_SHA256 = createPasswordSha256("download-pass");
  process.env.ASC_PROJECT_DATA_DOWNLOAD_JWT_SECRET = "secret-project-data";

  const issued = createAdminSessionToken(
    {
      operatorName: "管理员",
    },
    {
      jwtSecret: "secret-project-data",
    }
  );

  const router = createRouter();
  registerProjectDataDownloadRoutes(router, {
    datasets: [
      {
        id: "test-project-data",
        label: "测试项目数据",
        defaultFileName: "test-project-data.csv",
        getCsvPath() {
          return csvPath;
        },
      },
    ],
  });

  const requestRoute = router.routes.find(function (item) {
    return item.method === "POST" && item.pathname === REQUEST_PATH;
  });
  const fileRoute = router.routes.find(function (item) {
    return item.method === "GET" && item.pathname === FILE_PATH;
  });

  const requestResponse = createResponse();
  await requestRoute.handler({
    request: createRequest(
      JSON.stringify({
        dataset: "test-project-data",
        supplier: "__all__",
        operatorName: "傅成林",
      }),
      {
        authorization: "Bearer " + issued.token,
        host: "127.0.0.1:3333",
      }
    ),
    response: requestResponse,
  });

  const requestBody = JSON.parse(requestResponse.body);
  assert.equal(requestResponse.statusCode, 200);
  assert.equal(requestBody.success, true);
  assert.ok(requestBody.data.downloadUrl);

  const downloadUrl = new URL(requestBody.data.downloadUrl);
  const fileResponse = createResponse();
  await fileRoute.handler({
    request: createRequest("", {
      host: "127.0.0.1:3333",
    }),
    response: fileResponse,
    query: {
      token: downloadUrl.searchParams.get("token"),
    },
  });

  assert.equal(fileResponse.statusCode, 200);
  assert.match(fileResponse.body, /海天 任务/);
  assert.match(fileResponse.body, /贝壳 任务/);
});
