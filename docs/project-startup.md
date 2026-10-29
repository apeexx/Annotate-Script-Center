# 项目启动说明

本文用于在 Windows 本地启动标注脚本中心。项目由浏览器扩展和统一 Node.js 后端两部分组成；仓库根目录没有 `package.json`，不需要执行 `npm install` 或 `npm run`。

## 环境要求

- Windows 桌面环境。
- Node.js 24，用于内置 `node:sqlite` 和统一后端。
- Chrome 或 Edge，并允许使用扩展开发者模式。
- 已克隆的项目仓库。

以下命令均在仓库根目录执行。先进入实际克隆目录，例如：

```powershell
Set-Location C:\Projects\annotation-script-center
```

## 首次启动

### 1. 确认 Node.js 版本

```powershell
node --version
```

版本应为 `v24.x`。本项目没有根级依赖安装步骤。

### 2. 准备可选环境配置

仅使用基础后端和非 AI 功能时，可以直接跳到下一步。需要管理下载、AI 或自定义数据库路径时，先复制对应模板：

```powershell
Copy-Item config\env\backend.env.example config\env\backend.env
Copy-Item config\env\ai.env.example config\env\ai.env
```

按实际需要填写本地文件。真实 API Key、密码、JWT secret、token、cookie 和签名信息不得提交 Git。

- `backend.env`：管理鉴权、下载鉴权、词表数据库路径等后端配置。
- `ai.env`：百炼 / DashScope 及各 AI 脚本配置。
- `ASC_ENV_FILE`：需要额外环境文件时可通过进程环境指定。

完整字段说明以模板和 [`config/README.md`](../config/README.md) 为准。

### 3. 初始化业务词表

首次运行必须导入五个 SQLite 业务词表：

```powershell
node scripts/import-lexicons.js
```

默认数据库位置为：

```text
platform-resources/backend/runtime-data/lexicons.sqlite
```

重复执行会跳过已有词表。更新已有词表必须显式使用 `--replace`；导入完成后应重启后端，使内存缓存重新加载。

### 4. 启动统一后端

```powershell
node platform-resources/backend/server.js
```

默认监听地址：

```text
http://127.0.0.1:3333
```

保持该终端窗口运行。需要停止时按 `Ctrl+C`。

### 5. 加载浏览器扩展

1. 打开 `edge://extensions/` 或 `chrome://extensions/`。
2. 开启“开发者模式”。
3. 点击“加载解压缩的扩展”。
4. 选择当前仓库下的 `extension` 目录，例如 `C:\Projects\annotation-script-center\extension`。
5. 打开扩展的“标注脚本中心”。

扩展新安装时默认使用线上服务 `https://script.aisiyunling.com`。本地联调时，在工作台“系统管理”的后端设置中切换为本机后端，并确认根地址为 `http://127.0.0.1:3333`。

## 日常启动

完成首次初始化后，通常只需：

```powershell
Set-Location C:\Projects\annotation-script-center
node platform-resources/backend/server.js
```

浏览器会保留已加载的开发版扩展。修改扩展代码后，在扩展管理页点击“重新加载”，再刷新目标业务页面；修改后端代码或环境配置后，停止并重新启动后端。

## 启动检查

- 后端终端没有启动错误，并显示实际监听地址。
- `platform-resources/backend/runtime-data/lexicons.sqlite` 已生成。
- 扩展管理页没有 manifest 或脚本加载错误。
- 脚本中心能够打开，并可在系统管理中保存本机后端地址。
- 目标业务页面命中对应脚本后，弹窗能够识别并启停脚本。

AI、管理下载或具体平台脚本还需要各自的环境配置和页面权限。对应入口见 [`docs/platforms-index.md`](platforms-index.md) 和 [`platform-resources/backend/README.md`](../platform-resources/backend/README.md)。

## 常见问题

### `node:sqlite` 不可用

确认 `node --version` 为 Node.js 24。旧版 Node.js 不满足当前运行要求。

### 后端端口被占用

后端默认使用 `127.0.0.1:3333`。可在启动前临时设置其他端口：

```powershell
$env:PLATFORM_RESOURCES_SERVER_PORT = "3334"
node platform-resources/backend/server.js
```

同时把扩展中的本机后端根地址改为相同端口。

### 词表不可用

在仓库根目录重新执行：

```powershell
node scripts/import-lexicons.js
```

如需替换指定词表，按统一后端文档使用 `--replace --lexicon <词表标识>`，然后重启后端。不要直接把 JSON、CSV 或 XLSX 当作运行时数据源。

### 扩展修改没有生效

在扩展管理页点击“重新加载”，再刷新目标业务页面。若修改了 `manifest.json`，同时检查 JSON 是否有效以及引用的脚本路径是否存在。

### AI 功能提示配置缺失

复制并填写 `config/env/ai.env`，然后重启后端。配置和日志中不得输出或提交完整 API Key、token、音频 URL 或签名参数。

## 延伸文档

- [`extension/README.md`](../extension/README.md)：扩展目录、加载方式和当前脚本范围。
- [`platform-resources/backend/README.md`](../platform-resources/backend/README.md)：统一后端、词表和接口边界。
- [`config/README.md`](../config/README.md)：环境配置与发布配置。
- [`docs/platforms-index.md`](platforms-index.md)：平台和脚本入口。

