"use strict";

const assert = require("assert");
const test = require("node:test");

const adapter = require("./adapter");

test("ASR judgement data adapter picks exact row for label slots and audit role", function () {
  const rows = [
    {
      "标注员1子任务ID": "label-1",
      "标注员1_P": "标注员一",
      "标注员2子任务ID": "",
      "标注员2_P": "",
      "标注员3子任务ID": "",
      "标注员3_P": "",
      "审核子任务ID": "audit-1",
    },
    {
      "标注员1子任务ID": "",
      "标注员1_P": "",
      "标注员2子任务ID": "label-2",
      "标注员2_P": "标注员二",
      "标注员3子任务ID": "",
      "标注员3_P": "",
      "审核子任务ID": "audit-2",
    },
  ];

  assert.equal(adapter.pickRow(rows, "label", "label-2", "标注员二"), rows[1]);
  assert.equal(adapter.pickRow(rows, "audit", "audit-1"), rows[0]);
});

test("ASR judgement data adapter only marks label complete on exact username plus subTaskId match", function () {
  const labelResult = adapter.evaluateCompletion(
    {
      "分包ID": "batch-1",
      "任务名称": "任务1",
      "任务ID": "task-1",
      "题数": "400",
      "标注员1子任务ID": "label-1",
      "标注员1_P": "标注员一",
      "标注员2子任务ID": "",
      "标注员3子任务ID": "",
    },
    "label",
    "label-1",
    "标注员一"
  );
  const auditResult = adapter.evaluateCompletion(
    {
      "分包ID": "batch-1",
      "任务名称": "任务1",
      "任务ID": "task-1",
      "题数": "400",
      "审核子任务ID": "audit-1",
    },
    "audit",
    "audit-1"
  );

  assert.deepEqual(labelResult, {
    complete: true,
    missingFields: [],
  });
  assert.deepEqual(auditResult, {
    complete: true,
    missingFields: [],
  });
});

test("ASR judgement data adapter reports conflicts when only one identity key matches", function () {
  const row = {
    "分包ID": "batch-2",
    "任务名称": "任务2",
    "任务ID": "task-2",
    "题数": "400",
    "标注员1子任务ID": "label-1",
    "标注员1_P": "标注员一",
  };

  assert.deepEqual(
    adapter.evaluateCompletion(row, "label", "label-1", "新标注员"),
    {
      complete: false,
      missingFields: ["标注员双键冲突:子任务ID命中但用户名不一致"],
    }
  );

  assert.deepEqual(
    adapter.evaluateCompletion(row, "label", "label-2", "标注员一"),
    {
      complete: false,
      missingFields: ["标注员双键冲突:用户名命中但子任务ID不一致"],
    }
  );
});

test("ASR judgement data adapter keeps conflict missingFields wording stable", function () {
  const subTaskConflict = adapter.evaluateCompletion(
    {
      "分包ID": "batch-2",
      "任务名称": "任务2",
      "任务ID": "task-2",
      "题数": "400",
      "标注员1子任务ID": "label-1",
      "标注员1_P": "标注员一",
    },
    "label",
    "label-1",
    "新标注员"
  );

  const userConflict = adapter.evaluateCompletion(
    {
      "分包ID": "batch-2",
      "任务名称": "任务2",
      "任务ID": "task-2",
      "题数": "400",
      "标注员1子任务ID": "label-1",
      "标注员1_P": "标注员一",
    },
    "label",
    "label-2",
    "标注员一"
  );

  assert.equal(
    subTaskConflict.missingFields[0],
    "标注员双键冲突:子任务ID命中但用户名不一致"
  );
  assert.equal(
    userConflict.missingFields[0],
    "标注员双键冲突:用户名命中但子任务ID不一致"
  );
});

test("ASR judgement data adapter treats blank label identity as incomplete", function () {
  assert.deepEqual(
    adapter.evaluateCompletion(
      {
        "分包ID": "batch-3",
        "任务名称": "任务3",
        "任务ID": "task-3",
        "题数": "400",
      },
      "label",
      "",
      ""
    ),
    {
      complete: false,
      missingFields: ["标注员子任务ID", "标注员_P"],
    }
  );
});

test("ASR judgement data adapter exposes download metadata", function () {
  assert.equal(adapter.datasetId, "asr-judgement-statistics");
  assert.equal(adapter.downloadFilePrefix, "asr-judgement");
  assert.deepEqual(adapter.getMissingFieldsForAbsentBatch("label", "", ""), ["标注员子任务ID", "标注员_P"]);
  assert.deepEqual(adapter.getMissingFieldsForAbsentBatch("audit"), ["审核子任务ID"]);
});
