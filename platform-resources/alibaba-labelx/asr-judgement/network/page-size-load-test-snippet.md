# 快判每页条数负载测试脚本

## 请求标识 / 目的

- 当前文件记录该请求或该组请求的稳定参考结论。

## 页面入口 / 触发动作

- 当前文件未补充额外入口说明；默认按对应页面自然加载或用户显式操作触发。

## 请求摘要

dataStatus: "ALL",
    questionsQueryConditions: "AND",
      itemCards: document.querySelectorAll(".labelRender-item[data-index]").length,
      audioElements: document.querySelectorAll("audio[controls]").length,
      radioInputs: document.querySelectorAll("input[type='radio']").length,
      textareas: document.querySelectorAll("textarea").length,
      status: response.status,
      status: row.status,

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

这个脚本只测 `data` 接口请求、响应体大小和 JSON 解析成本，同时记录当前页面 DOM 压力。页面真正卡顿通常还来自 LabelX 把题卡、音频控件、单选项和文本框渲染进 DOM 的成本，所以测试结果要和实际滚动、点击、快捷键响应一起判断。
    const response = await fetch(url.toString(), {
    const responseAt = performance.now();
    const text = await response.text();
    const list = Array.isArray(json?.data?.dataList) ? json.data.dataList : [];
      status: response.status,
      ok: response.ok,
      fetchMs: Math.round(responseAt - startedAt),
      readTextMs: Math.round(textAt - responseAt),
      responseKB: Math.round(new Blob([text]).size / 1024),
      responseKB: row.responseKB,
- 如果 `400` 的接口耗时和响应体大小都明显高于 `100/150/200`，优先使用 `100` 或 `150`。

## 关键字段

- 当前重点继续以路径、query、响应字段名和脱敏占位为主。

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 文档只保留当前有效结论；新增缺口统一回写稳定参考页或 `log.md`。
