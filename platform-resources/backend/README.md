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

## 当前注册范围

- Alibaba LabelX 转写和快判。
- DataBaker 一检助手。
- Magic Data 客家话和闽南语助手。
- Aishell Tech 闽南语、越南语、泰语助手。
- Abaka AI Task21。
- 管理会话、管理面板、下载中心、项目数据下载、AI 调用记录下载。
- 公开下载中心默认地址：`https://script.aisiyunling.com/downloads/`。

## 工作台系统管理对接

扩展工作台的“系统管理”视图仅调用当前统一后端的管理员会话、仪表盘、下载中心、项目数据导出和 AI 调用记录导出接口。管理员会话使用环境变量配置的密码摘要和 JWT secret 鉴权；未配置或凭据错误时应返回脱敏错误，前端不得保存管理员密码或 token。

当前 AI 默认配置接口仅为已注册的 LabelX、DataBaker、Magic Data、Aishell Tech 和 Abaka Task21 脚本提供。未接入 AI 的现行脚本不会伪造 AI 配置接口；已删除的历史脚本也不会重新注册路由。

## 安全边界

- 不在仓库提交真实 API Key、token、cookie、authorization、JWT secret 或下载口令。
- 管理类下载接口必须通过环境变量配置鉴权。
- 日志只保留必要摘要，避免写入敏感 payload。
