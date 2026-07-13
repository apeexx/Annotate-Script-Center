# 扩展运行时代码

`extension/` 是浏览器扩展开发模式加载目录。当前只保留 public 版本能力，脚本中心展示公开脚本和统一后端地址配置。新安装扩展默认使用 `https://script.aisiyunling.com`；已保存的旧域名设置保持不变，`script.xiangtianzhen.store` 继续兼容。

## 加载方式

1. 打开 `edge://extensions/` 或 `chrome://extensions/`。
2. 开启开发者模式。
3. 加载 `D:\Annotate-Script-Center\extension`。

## 主要入口

- `manifest.json`：扩展声明、权限和 content script 注入入口。
- `shared/`：共享常量、存储、构建元信息和通用工具。
- `options/`：脚本中心配置页。
- `popup/`：当前页面脚本识别和启停入口。
- `background/`：后台 service worker。
- `sites/`：各平台运行时代码。

## 当前保留脚本

- Alibaba LabelX 转写与快判脚本。
- Lightwheel 查看态面板。
- DataBaker 一检助手。
- Magic Data 客家话、闽南语助手。
- Aishell Tech 闽南语、越南语、泰语和中英短剧脚本。
- Abaka AI Task21 助手。
- Haitian uTrans 音频下载助手。

## 验证建议

修改 `manifest.json` 后需要确认 JSON 可解析，并检查 manifest 引用的 JS / CSS 路径存在。修改 JS 文件后至少运行对应 `node --check <file>`。
