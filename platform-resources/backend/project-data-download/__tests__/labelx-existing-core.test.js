"use strict";

const assert = require("assert");
const test = require("node:test");

const {
  buildExistingResponseItems,
} = require("../labelx-existing-core");

test("LabelX existing core groups rows by batchId and evaluates items through adapter", function () {
  const items = [
    {
      batchId: "batch-1",
      role: "label",
      subTaskId: "label-1",
      userName: "标注员一",
    },
    {
      batchId: "batch-2",
      role: "audit",
      subTaskId: "audit-2",
    },
  ];
  const rowsByMergeRowId = {
    "row-1": {
      "分包ID": "batch-1",
      labelId: "label-1",
      userName: "标注员一",
      complete: "1",
    },
  };
  const adapter = {
    pickRow(rows, role, subTaskId, userName) {
      return rows.find(function (row) {
        if (role === "audit") {
          return row.auditId === subTaskId;
        }
        return row.labelId === subTaskId && row.userName === userName;
      }) || rows[0] || null;
    },
    evaluateCompletion(row, role, subTaskId, userName) {
      const complete =
        role === "label"
          ? String(row?.complete || "") === "1" &&
            row?.labelId === subTaskId &&
            row?.userName === userName
          : String(row?.complete || "") === "1";
      return {
        complete,
        missingFields: complete ? [] : ["示例字段"],
      };
    },
    getMissingFieldsForAbsentBatch(role) {
      return role === "audit" ? ["审核字段"] : ["标注字段"];
    },
  };

  const result = buildExistingResponseItems(items, rowsByMergeRowId, adapter);

  assert.deepEqual(result, [
    {
      batchId: "batch-1",
      role: "label",
      subTaskId: "label-1",
      exists: true,
      complete: true,
      missingFields: [],
    },
    {
      batchId: "batch-2",
      role: "audit",
      subTaskId: "audit-2",
      exists: false,
      complete: false,
      missingFields: ["审核字段"],
    },
  ]);
});

test("LabelX existing core normalizes check role to audit", function () {
  const adapter = {
    pickRow(rows) {
      return rows[0] || null;
    },
    evaluateCompletion() {
      return {
        complete: false,
        missingFields: ["审核子任务ID"],
      };
    },
    getMissingFieldsForAbsentBatch(role) {
      return role === "audit" ? ["审核子任务ID"] : ["标注子任务ID"];
    },
  };

  const result = buildExistingResponseItems(
    [
      {
        batchId: "batch-9",
        role: "check",
        subTaskId: "audit-9",
      },
    ],
    {},
    adapter
  );

  assert.deepEqual(result, [
    {
      batchId: "batch-9",
      role: "audit",
      subTaskId: "audit-9",
      exists: false,
      complete: false,
      missingFields: ["审核子任务ID"],
    },
  ]);
});

test("LabelX existing core passes label userName into adapter", function () {
  const observed = [];
  const adapter = {
    pickRow(rows, role, subTaskId, userName) {
      observed.push(["pickRow", role, subTaskId, userName]);
      return rows[0] || null;
    },
    evaluateCompletion(row, role, subTaskId, userName) {
      observed.push(["evaluateCompletion", role, subTaskId, userName]);
      return {
        complete: false,
        missingFields: ["示例字段"],
      };
    },
    getMissingFieldsForAbsentBatch(role, subTaskId, userName) {
      observed.push(["getMissingFieldsForAbsentBatch", role, subTaskId, userName]);
      return ["示例字段"];
    },
  };

  buildExistingResponseItems(
    [
      {
        batchId: "batch-1",
        role: "label",
        subTaskId: "label-1",
        userName: "标注员一",
      },
    ],
    {
      "row-1": {
        "分包ID": "batch-1",
      },
    },
    adapter
  );

  assert.deepEqual(observed, [
    ["pickRow", "label", "label-1", "标注员一"],
    ["evaluateCompletion", "label", "label-1", "标注员一"],
  ]);
});

test("LabelX existing core preserves adapter conflict missingFields", function () {
  const adapter = {
    pickRow(rows) {
      return rows[0] || null;
    },
    evaluateCompletion() {
      return {
        complete: false,
        missingFields: ["标注员双键冲突:子任务ID命中但用户名不一致"],
      };
    },
    getMissingFieldsForAbsentBatch() {
      return ["示例字段"];
    },
  };

  const result = buildExistingResponseItems(
    [
      {
        batchId: "batch-1",
        role: "label",
        subTaskId: "label-1",
        userName: "标注员一",
      },
    ],
    {
      "row-1": {
        "分包ID": "batch-1",
      },
    },
    adapter
  );

  assert.deepEqual(result, [
    {
      batchId: "batch-1",
      role: "label",
      subTaskId: "label-1",
      exists: true,
      complete: false,
      missingFields: ["标注员双键冲突:子任务ID命中但用户名不一致"],
    },
  ]);
});
