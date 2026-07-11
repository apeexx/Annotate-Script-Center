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

## 安全边界

- 不在仓库提交真实 API Key、token、cookie、authorization、JWT secret 或下载口令。
- 管理类下载接口必须通过环境变量配置鉴权。
- 日志只保留必要摘要，避免写入敏感 payload。