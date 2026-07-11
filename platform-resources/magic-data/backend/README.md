# Magic Data 平台共用后端目录

本目录用于存放 Magic Data 平台级共用后端能力（如共用 loader、共用工具、兼容路由实现）。

当前状态：

- 旧 `annotator` API 兼容由 `hakka-helper/backend/ai-routes.js` 直接注册：
  - `GET /api/magic-data/annotator/ai/review-current/health`
  - `GET /api/magic-data/annotator/ai/defaults`
  - `POST /api/magic-data/annotator/ai/review-current`
- 现阶段未新增独立平台级 JS 运行文件；后续若出现跨助手共用后端代码，优先下沉到本目录。
