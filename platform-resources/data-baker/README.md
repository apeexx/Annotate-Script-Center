# DataBaker 平台资料

## 平台范围

本目录维护 标贝易采 平台脚本资料，当前脚本为 `round-one-quality`（闽南语助手）。

- 扩展运行时代码：`extension/sites/data-baker/round-one-quality/`
- 脚本资料入口：`platform-resources/data-baker/round-one-quality/README.md`
- 统一后端入口：`platform-resources/backend/server.js`

## 平台级目录

- `backend/`：平台共用后端能力预留目录（当前暂无 DataBaker 跨脚本共用后端实现，保留 `.gitkeep`）。
- `network/`：平台共用 Network 资料预留目录（当前暂无跨脚本共用差异，保留 `.gitkeep`）。
- `page-structure/`：平台共用页面结构资料预留目录（当前暂无跨脚本共用差异，保留 `.gitkeep`）。
- `round-one-quality/`：闽南语助手脚本专属资料目录（包含专属后端、`data/adapter.js`、`data/field-mappings.js`、`data/scripts/*`、`data/assets/*`、Network、页面结构、词表）；当前 `data/` 已开始承接 upload 字段归一、CSV helper、merge helper、latest/history/events 持久化 helper、history 读取 helper 和脱敏样例。

## 安全边界

- 资料只记录脱敏结构，不写入 token、cookie、authorization、完整签名 URL、真实敏感文本。
- AI 仅作辅助，不自动保存、不自动提交、不自动领取、不自动审核、不自动流转。
