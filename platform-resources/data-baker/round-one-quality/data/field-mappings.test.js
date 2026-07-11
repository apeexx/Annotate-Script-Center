"use strict";

const assert = require("assert");
const test = require("node:test");

const {
  CANONICAL_EXPORT_COLUMNS,
  EXPORT_ROW_KEY_FIELD_GROUPS,
  LEGACY_HEADER_ALIAS,
  TASK_ID_FIELD_GROUP,
} = require("./field-mappings");

test("DataBaker field mappings expose canonical export columns and legacy aliases", function () {
  assert.equal(LEGACY_HEADER_ALIAS["质检人"], "质检人_P");
  assert.equal(LEGACY_HEADER_ALIAS["有效时长"], "有效合格时长_S");

  const checkNameColumn = CANONICAL_EXPORT_COLUMNS.find(function (column) {
    return column.title === "质检人_P";
  });
  assert.deepEqual(checkNameColumn.keys, ["checkName"]);
});

test("DataBaker field mappings keep row key precedence and task id field group explicit", function () {
  assert.deepEqual(EXPORT_ROW_KEY_FIELD_GROUPS.textNumber, [
    "文本编号",
    "textNumber",
    "textNo",
    "text_number",
  ]);
  assert.deepEqual(TASK_ID_FIELD_GROUP, ["任务ID", "taskId"]);
});
