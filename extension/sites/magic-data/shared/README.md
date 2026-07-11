# Magic Data 平台共享模块

`shared/` 仅放同平台复用能力，不放具体助手业务入口。

## 模块列表

- `page-detector.js`：Magic Data 页面识别。
- `data-collector.js`：当前条数据采集（缓存优先，DOM 兜底）。
- `page-world/network-observer.js`：MAIN world 网络只读监听（单次注入）。
- `assistant-panel-core.js`：客家话助手结果区核心。
- `shortcuts-runtime.js`：客家话助手快捷键运行时。
- `ai-review-client.js`：客家话助手 AI 接口客户端。

## 约束

- 网络监听只读，不采集敏感凭据。
- 不在共享层实现自动保存、自动提交、自动审核、自动流转。
