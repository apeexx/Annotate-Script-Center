# 平台资料总览

`platform-resources/` 存放平台资料、Network 参考、页面结构、脚本后端和统一后端入口。前端运行时代码仍在 `extension/`。

## 当前保留平台

- `alibaba-labelx/`：LabelX 转写和快判资料、后端与数据说明。
- `data-baker/`：DataBaker 一检助手资料与后端。
- `magic-data/`：Magic Data 客家话、闽南语助手资料与后端。
- `aishell-tech/`：Aishell Tech 多脚本资料与后端。
- `abaka-ai/`：Abaka AI Task21 资料与后端。
- `haitian-utrans/`：uTrans 音频下载助手资料。
- `jd-tts-annotation/`：京东 TTS 上海话文本回填助手资料、脱敏 Network / DOM 参考和后端。
- `backend/`：统一后端入口、公共管理接口、下载与日志能力。

## 目录约定

- 平台总览写入 `platform-resources/<platform>/README.md`。
- 脚本细节写入 `platform-resources/<platform>/<script>/README.md`。
- 后端公共入口写入 `platform-resources/backend/`。
- Network 和页面结构只保留当前有效参考，不保留过程型会话记录。
