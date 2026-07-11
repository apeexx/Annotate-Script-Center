"use strict";

const COMMON_COLUMNS = [
  { key: "createdAt", header: "创建时间" },
  { key: "requestId", header: "请求ID" },
  { key: "platformId", header: "平台ID" },
  { key: "scriptId", header: "脚本ID" },
  { key: "success", header: "是否成功" },
  { key: "errorCode", header: "错误码" },
  { key: "errorMessage", header: "错误信息" },
  { key: "durationMs", header: "总耗时毫秒" },
  { key: "promptTokens", header: "输入Token" },
  { key: "completionTokens", header: "输出Token" },
  { key: "totalTokens", header: "总Token" },
  { key: "aiUsageOperatorName", header: "AI调用使用人" },
  { key: "platformUserName", header: "平台账号" },
  { key: "platformUserId", header: "平台用户ID" },
  { key: "rawResponseJson", header: "原始返回JSON" },
  { key: "rawErrorJson", header: "原始错误JSON" },
];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeColumn(column) {
  const source = column && typeof column === "object" ? column : {};
  const key = normalizeText(source.key);
  if (!key) {
    return null;
  }
  return {
    key,
    header: normalizeText(source.header) || key,
  };
}

function createAiCallLogSchema(options) {
  const source = options && typeof options === "object" ? options : {};
  const extraColumns = Array.isArray(source.extraColumns) ? source.extraColumns : [];
  const schema = [];
  const seen = new Set();

  function appendColumn(column) {
    const normalized = normalizeColumn(column);
    if (!normalized || seen.has(normalized.key)) {
      return;
    }
    seen.add(normalized.key);
    schema.push(normalized);
  }

  COMMON_COLUMNS.forEach(appendColumn);
  extraColumns.forEach(appendColumn);

  return schema;
}

module.exports = {
  COMMON_COLUMNS,
  createAiCallLogSchema,
};
