"use strict";

const CANONICAL_EXPORT_COLUMNS = [
  { title: "任务ID", keys: ["taskId"] },
  { title: "项目名称", keys: ["projectName"] },
  { title: "任务名称", keys: ["taskName"] },
  { title: "团队名称", keys: ["teamName"] },
  { title: "采集人", keys: ["userName", "collectName"] },
  { title: "手机号", keys: ["mobile"] },
  { title: "年龄", keys: ["collectAge"] },
  { title: "性别", keys: ["collectSexName", "collectSex"] },
  { title: "省", keys: ["collectProvince"] },
  { title: "市", keys: ["collectCity"] },
  { title: "区县", keys: ["collectTown"] },
  { title: "文本编号", keys: ["textNumber"] },
  { title: "文本数量", keys: ["audioTextNum"] },
  { title: "上传音频数", keys: ["uploadAudioNum"] },
  { title: "状态", keys: ["statusName", "status"] },
  { title: "驳回类型", keys: ["noPassType"] },
  { title: "质检人_P", keys: ["checkName"] },
  { title: "质检时间", keys: ["checkTime"] },
  { title: "提交时间", keys: ["submitTime"] },
  { title: "更新时间", keys: ["updateTime"] },
  { title: "有效总时长", keys: ["effectiveTotalTime"] },
  { title: "有效合格时长_S", keys: ["effectivePassTotalTime"] },
  { title: "有效不合格时长", keys: ["effectiveNoPassTotalTime"] },
  { title: "文件名", keys: ["fileName"] },
  { title: "段编号", keys: ["segmentNumber"] },
  { title: "手机型号", keys: ["phoneModel"] },
  { title: "版本", keys: ["version"] },
  { title: "质检驳回原因", keys: ["checkRejectReason"] },
  { title: "验收驳回原因", keys: ["acceptCheckRejectReason"] },
];

const LEGACY_HEADER_ALIAS = {
  "质检人": "质检人_P",
  "质检人_P": "质检人_P",
  "有效时长": "有效合格时长_S",
  "有效时长(秒)": "有效合格时长_S",
  "有效合格时长": "有效合格时长_S",
  "有效合格时长_S": "有效合格时长_S",
};

const EXPORT_ROW_KEY_FIELD_GROUPS = {
  textNumber: ["文本编号", "textNumber", "textNo", "text_number"],
  fileName: ["文件名", "fileName"],
  segmentNumber: ["段编号", "segmentNumber"],
  collector: ["采集人", "userName", "collectName"],
  mobile: ["手机号", "mobile"],
};

const TASK_ID_FIELD_GROUP = ["任务ID", "taskId"];

module.exports = {
  CANONICAL_EXPORT_COLUMNS,
  EXPORT_ROW_KEY_FIELD_GROUPS,
  LEGACY_HEADER_ALIAS,
  TASK_ID_FIELD_GROUP,
};
