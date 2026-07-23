# 扩展运行时代码

`extension/` 是浏览器扩展开发模式加载目录。当前只保留 public 版本能力，脚本中心展示公开脚本和统一后端地址配置。新安装扩展默认使用 `https://script.aisiyunling.com`；已保存的旧域名设置保持不变，`script.xiangtianzhen.store` 继续兼容。

## 加载方式

1. 打开 `edge://extensions/` 或 `chrome://extensions/`。
2. 开启开发者模式。
3. 加载 `D:\Annotate-Script-Center\extension`。

## 主要入口

- `manifest.json`：扩展声明、权限和 content script 注入入口。
- `shared/`：共享常量、存储、构建元信息和通用工具。
- `options/`：脚本中心工作台。提供功能面板、脚本详情设置、脚本下载中心和系统管理四个视图；卡片和可进入的详情页只从 `shared/constants.js` 的 `SCRIPT_LIBRARY` 及 public 可见性规则生成。系统管理中的后端模式与根地址设置固定显示在密码验证入口之前，以便服务器后端不可用时仍能切换到本机后端。
- `popup/`：当前页面脚本识别和启停入口；命中京东 TTS 标注路由时，即使上海话助手尚未启用也会显示该助手并允许直接启用。
- `background/`：后台 service worker。
- `sites/`：各平台运行时代码。

## 当前保留脚本

- Alibaba LabelX 转写与快判脚本。
- Lightwheel 查看态面板。
- DataBaker 一检助手。
- Magic Data 客家话、闽南语助手。
- Aishell Tech 闽南语、粤语、越南语、泰语和中英短剧脚本。
- 京东 TTS 上海话文本回填助手：在京东标注页点击扩展功能“上海话识别”即可识别当前 WAV 并只回填精确“文本:”textarea。该按钮通常直接位于平台“自动标注”按钮右侧，不属于平台按钮；工具栏临时缺失或被 Vue 重建时，会安全地在精确“文本:”字段旁独立显示，并在工具栏恢复后重新挂载。助手从不读取、观察或写入“拼音:”textarea，也不自动保存、提交、领取或调用平台写操作接口。
- Abaka AI Task21 助手。
- Haitian uTrans 音频下载助手。

工作台当前只管理上述 14 个脚本。每张卡片均可启停并通过“打开设置”进入对应详情页；详情页继续使用既有 `chrome.storage` 设置结构，保存不会重置已保存的用户配置。AI 设置仅在该脚本实际接入 AI 能力时显示；快捷键默认为空，可录制或清空。

已移除的历史脚本、其页面注入代码、后端路由和资料不属于工作台范围，也不会由卡片或路由入口暴露。

## 验证建议

修改 `manifest.json` 后需要确认 JSON 可解析，并检查 manifest 引用的 JS / CSS 路径存在。修改 JS 文件后至少运行对应 `node --check <file>`。
