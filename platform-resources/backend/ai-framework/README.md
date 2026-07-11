# AI Framework 骨架

`platform-resources/backend/ai-framework/` 是统一 AI 后端框架骨架目录。

当前阶段先提供最小公共层：

- `contracts/`：统一 request/response 契约。
- `core/`：统一 AI route 工厂。
- `loaders/`：项目资产加载器。
- `runtime/`：项目 pipeline 执行器。
- `registry/`：项目 adapter 注册表。
- `__tests__/`：Node 内置测试。

当前约束：

- 本阶段只搭骨架，不直接替换旧项目路由。
- 旧项目仍通过各自 `backend/` 目录运行。
- 下一块开始由 DataBaker 作为首个 adapter 迁移样板接入。
- route factory 已支持 `createSuccessBody / createErrorBody`，用于旧项目在接入 framework 时继续保留原有外部响应结构。
