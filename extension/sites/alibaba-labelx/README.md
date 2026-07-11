# Alibaba LabelX 站点目录

这个目录是 LabelX 站点级入口。站点根目录只保留说明文件，不放业务运行时 JS；所有 LabelX 相关代码和资料必须归属到具体脚本项目目录。

## 当前目录结构

```text
extension/sites/alibaba-labelx/
  README.md
    asr-judgement/
      README.md
      content.js
      page-detector.js
      judgement-*.js
      audio-*.js
      page-world/
      data/
  asr-transcription/
    README.md
    page-structure/
    page-world/
    *.js
```

## 脚本项目

- `asr-judgement/`
  - 中文名：阿里 ASR 语音判别 / ASR 快判
  - 负责快判 / 更优判断项目的资料、运行时和脚本详情页配置。
  - 当前已具备独立 content script、音频控制、分页设置、总时长统计、判别快捷键、工具栏和 MAIN world 网络监听。
  - 当前归属文件：`content.js`、`page-detector.js`、`judgement-*.js`、`audio-*.js`、`page-world/`、`data/`。
  - 页面结构、网络采集和统计契约统一维护在 `platform-resources/alibaba-labelx/asr-judgement/`。
  - 设置入口：options 快判详情页使用独立简化表单，不复用转写完整设置面板。
- `asr-transcription/`
  - 中文名：阿里 ASR 语音转写
  - 负责语音转写项目的完整运行时、页面注入、设置面板和页面结构资料。
  - 当前归属文件：`content.js`、`document-start.js`、`runtime-*.js`、`annotation-*.js`、`legacy-*.js`、`settings-panel.js`、`page-world/`、`page-structure/`。

## 当前加载方式

- `manifest.json` 直接加载两个脚本项目需要的文件。
- 快判的 `page-world/network-*.js` 运行在 MAIN world，用于请求改写和网络摘要。
- 快判的 `content.js` 运行在 ISOLATED world，只做入口编排和模块串联。
- 转写仍使用自己的 `page-world/`、`document-start.js`、`content.js` 和相关 `annotation-*` / `legacy-*` 模块。

## 站点根目录策略

站点根目录只保留站点级说明文件，不再直接放 LabelX 运行时 JS。`manifest.json`、options 和 popup 如果引用 LabelX 文件，路径必须显式指向 `asr-transcription/` 或 `asr-judgement/`。

## 公共目录策略

暂时不创建公共目录。快判和转写先按两个独立脚本维护，避免在边界未稳定前把选择器、运行时状态和设置模型提前耦合。

后续只有同时满足这些条件时，才考虑创建公共目录：

- 同一能力已经被 `asr-judgement/` 和 `asr-transcription/` 同时实际使用。
- 两边的 DOM 选择器、消息协议或状态模型已经稳定，抽取后不会引入跨脚本回归。
- 对应脚本 README 已记录复用点、调用方和验证步骤。

可能适合后续抽取的能力包括：

- 站点路由识别
- LabelX 页面等待工具
- 音频控制基础能力
- DOM 安全读写工具
- 运行时消息协议

## 后续迁移原则

1. 新增或移动 LabelX JS 时必须放入具体脚本目录。
2. 修改加载路径时同步检查 `manifest.json`、options、popup 和脚本文档。
3. 每次迁移后至少运行 `node --check` 覆盖变更 JS。
4. 涉及真实 LabelX 页面行为时，必须在 Edge 扩展中人工验证 popup 命中、runtime ping 和脚本详情页跳转。
5. 有功能、模块边界或验证步骤变化时，同步更新对应脚本 README 和仓库根目录 `log.md`。
