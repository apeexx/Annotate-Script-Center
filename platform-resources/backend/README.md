# 统一后端说明

`platform-resources/backend/` 是本项目统一 Node 后端入口，负责公共路由、管理接口、下载接口、AI 调用记录导出和各保留脚本的后端注册。

## 启动

在仓库根目录运行：

```powershell
node platform-resources/backend/server.js
```

默认监听：

```text
http://127.0.0.1:3333
```

## 正字表数据库

运行环境要求 Node.js 24，使用内置 `node:sqlite`，无需 npm 安装数据库依赖。
首次启动前，在仓库根目录执行：

```powershell
node scripts/import-lexicons.js
node platform-resources/backend/server.js
```

默认数据库为 `platform-resources/backend/runtime-data/lexicons.sqlite`；可在 `config/env/backend.env` 或进程环境中设置 `ASC_LEXICON_DB_PATH`，相对路径以启动命令的工作目录为准。导入命令和后端加载相同环境文件。

| 词表标识 | 默认导入来源 | 初始条数 |
|---|---|---:|
| data-baker/round-one-quality | reference/minnan-lexicon.json | 529 |
| aishell-tech/minnan-helper | reference/minnan-lexicon.json | 529 |
| magic-data/hakka-helper | lexicon/hakka-lexicon.json | 690 |
| magic-data/minnan-helper | lexicon/minnan-lexicon.csv | 562 |
| jd-tts-annotation/shanghainese-helper | lexicon/shanghainese-lexicon.json | 0 |

来源路径相对各脚本 `backend/`。原始 JSON/CSV/XLSX 仅为导入源与备份；运行时通过参数化 SQL 查询 `lexicons` 和 `lexicon_entries`，按原始顺序读取，数组和扩展属性以 JSON 列存储。各平台独立保存。上海话保留合法空词表；Magic Data 闽南语保留原 CSV 的空释义及原始字段。

重复初始化会跳过已有词表，且不读取其源文件。显式更新单份词表：

```powershell
node scripts/import-lexicons.js --replace --lexicon magic-data/hakka-helper
node scripts/import-lexicons.js --replace --lexicon magic-data/minnan-helper --source ./updated-minnan.csv
```

`--source` 需要同时指定 `--lexicon`，支持词表 JSON；Magic Data 闽南语额外支持现有三列表头 CSV 及转换工具的七列表头 CSV。已有 `ASC_AISHELL_MINNAN_LEXICON_JSON_PATH` 仅控制 Aishell 导入来源，不再改变业务读取路径。Excel 转换工具仅生成导入源，并提示后续入库命令。

一次命令的所有导入在同一事务内完成，校验或写入失败会回滚。导入完成后重启后端使内存缓存生效。数据库缺失、损坏或未导入对应词表时，日志报告词表不可用，业务沿用原有无词表降级，不读取 JSON/CSV 兜底。

备份前停止后端和导入进程，复制 SQLite 文件到备份位置；恢复时停止进程，将备份复制回配置路径，再启动后端。运行数据库及日志文件不提交 Git；新部署必须执行初始化。

## 当前注册范围

- Alibaba LabelX 转写和快判。
- DataBaker 一检助手。
- Magic Data 客家话和闽南语助手。
- Aishell Tech 闽南语、粤语、越南语、泰语助手。
- 京东 TTS 上海话助手。
- Abaka AI Task21。
- 管理会话、管理面板、下载中心、项目数据下载、AI 调用记录下载。
- 公开下载中心默认地址：`https://script.aisiyunling.com/downloads/`。

## 工作台系统管理对接

扩展工作台的“系统管理”视图仅调用当前统一后端的管理员会话、仪表盘、下载中心、项目数据导出和 AI 调用记录导出接口。管理员会话使用环境变量配置的密码摘要和 JWT secret 鉴权；未配置或凭据错误时应返回脱敏错误，前端不得保存管理员密码或 token。

当前 AI 默认配置接口仅为已注册的 LabelX、DataBaker、Magic Data、Aishell Tech、京东 TTS 上海话和 Abaka Task21 脚本提供。未接入 AI 的现行脚本不会伪造 AI 配置接口；已删除的历史脚本也不会重新注册路由。

## 安全边界

- 不在仓库提交真实 API Key、token、cookie、authorization、JWT secret 或下载口令。
- 管理类下载接口必须通过环境变量配置鉴权。
- 日志只保留必要摘要，避免写入敏感 payload。
