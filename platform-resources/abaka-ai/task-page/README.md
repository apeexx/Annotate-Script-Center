# Abaka AI Task 页面资料（只读采集壳）

## 目录定位

本目录用于沉淀 Abaka AI Task 页面的只读采集资料与后续接口结构说明。

- 平台：Abaka AI
- 登录地址：`http://abao.fortidyndns.com:30473/login`
- 当前阶段：只读页面结构与 Network 结构采集
- 当前目标：Task21 / MMAT

## 目录说明

- `README.md`：Task 页面公共采集壳说明与安全边界。
- `backend/`：脚本级后端预留目录（当前无 task-page 专属后端，保留 `.gitkeep`）。
- `network/`：脚本级 Network 差异预留目录（公共请求集中在平台根 `../network/`）。
- `page-structure/`：脚本级页面结构差异预留目录（公共结构集中在平台根 `../page-structure/`）。

## 本轮边界

- 只做 DOM / Network 结构观察与脱敏导出。
- 不做自动领取任务。
- 不做自动保存、自动提交、自动流转。
- 不主动调用业务 API，只被动观察页面真实 `fetch/XMLHttpRequest`。

## Console 采集方法

1. 重新加载扩展。
2. 打开 Abaka AI 并登录。
3. 进入任务列表和 Task21 页面。
4. 打开 DevTools Console。
5. 执行：
   - `window.__ASCAbakaAiCapture.snapshot()`
   - `window.__ASCAbakaAiCapture.download()`
6. 下载脱敏 JSON 后用于下一轮功能设计。
7. 不要把导出的 JSON 提交到 Git。

## 脱敏要求

- 禁止记录：`cookie`、`authorization`、`token`、`password`、`secret`、`signature`。
- 禁止保留完整音频/文件/下载/OSS URL。
- 对 `audio/url/file/download/oss/path/src/href` 类字符串仅保留类型与长度，不保留原值。

## 后续接口清单模板（待补）

- 接口用途
- method
- pathname
- queryKeys
- requestShape
- responseShape
- 分页字段
- 列表字段
- 备注
