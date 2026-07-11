# 标注脚本中心

用于维护浏览器扩展、统一后端和多平台资料的仓库。

## 项目定位

- 运行时代码：`extension/`
- 平台资料与脚本后端：`platform-resources/`
- 统一后端入口：`platform-resources/backend/server.js`
- 当前扩展版本以 `extension/manifest.json` 为准
- 当前只保留 `public` 发布通道

## 快速开始

### 本地加载扩展

1. 打开 `edge://extensions/` 或 `chrome://extensions/`。
2. 开启开发者模式。
3. 加载 `D:\Annotate-Script-Center\extension`。

详细运行时说明见 `extension/README.md`。

### 本地启动后端

在仓库根目录运行：

```powershell
node platform-resources/backend/server.js
```

默认监听：

```text
http://127.0.0.1:3333
```

后端环境变量、PM2 和统一后端边界见 `platform-resources/backend/README.md`。

## 安装与前置

- 当前仓库没有根级 `package.json`，不是 `npm install / npm run` 型项目。
- 本地至少需要 Node.js、Chrome 或 Edge，以及可加载扩展开发模式的桌面环境。
- 服务端部署可按需准备 PM2、`config/env/backend.env` 与 `config/env/ai.env`。
- 正式 CRX 打包需要 `config/secrets/annotation-script-center.pem` 与 `config/package-crx-release.json`。

## 打包与发布

在仓库根目录运行：

```powershell
node scripts/package-crx-release.js
```

当前只生成 public 产物：

- `dist/annotation-script-center-v<version>.crx`
- `dist/annotation-script-center-v<version>.zip`
- `dist/annotation-script-center-update.xml`
- `dist/annotation-script-center-crx-latest.json`

更多配置说明见 `config/README.md`。

## 目录导航

- `AGENTS.md`：项目规则、Git 规范、验证要求、安全边界。
- `extension/`：浏览器扩展运行时代码。
- `platform-resources/`：平台资料、Network 资料、页面结构和脚本后端。
- `docs/`：平台索引、外部文档入口和未完成事项。
- `log.md`：历史改动记录。

## 文档入口

- 项目规则：`AGENTS.md`
- 扩展源码说明：`extension/README.md`
- 平台资料总览：`platform-resources/README.md`
- 统一后端说明：`platform-resources/backend/README.md`
- 配置说明：`config/README.md`
- docs 导航：`docs/README.md`
- 平台与脚本索引：`docs/platforms-index.md`
- 百炼官方文档入口：`docs/external-docs-aliyun-bailian.md`
- 未完成模块说明：`docs/unfinished-crx-enterprise-managed-install.md`
- 历史变更记录：`log.md`