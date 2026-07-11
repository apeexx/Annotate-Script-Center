"use strict";

const assert = require("assert");
const test = require("node:test");

const adapter = require("./adapter");

test("ASR transcription data adapter picks exact row for label and audit roles", function () {
  const rows = [
    {
      "标注子任务ID": "label-1",
      "审核子任务ID": "audit-1",
    },
    {
      "标注子任务ID": "label-2",
      "审核子任务ID": "audit-2",
    },
  ];

  assert.equal(
    adapter.pickRow(rows, "label", "label-2"),
    rows[1]
  );
  assert.equal(
    adapter.pickRow(rows, "audit", "audit-1"),
    rows[0]
  );
});

test("ASR transcription data adapter evaluates completion by role", function () {
  const labelResult = adapter.evaluateCompletion(
    {
      "分包ID": "batch-1",
      "任务名称": "任务1",
      "任务ID": "task-1",
      "题数": "50",
      "标注子任务ID": "",
    },
    "label",
    "label-1"
  );
  const auditResult = adapter.evaluateCompletion(
    {
      "分包ID": "batch-1",
      "任务名称": "任务1",
      "任务ID": "task-1",
      "题数": "50",
      "审核子任务ID": "audit-1",
    },
    "audit",
    "audit-1"
  );

  assert.deepEqual(labelResult, {
    complete: false,
    missingFields: ["标注子任务ID"],
  });
  assert.deepEqual(auditResult, {
    complete: true,
    missingFields: [],
  });
});

test("ASR transcription data adapter exposes download metadata", function () {
  assert.equal(adapter.datasetId, "asr-transcription-statistics");
  assert.equal(adapter.downloadFilePrefix, "asr-transcription");
  assert.deepEqual(adapter.getMissingFieldsForAbsentBatch("label"), ["标注子任务ID"]);
  assert.deepEqual(adapter.getMissingFieldsForAbsentBatch("audit"), ["审核子任务ID"]);
});
