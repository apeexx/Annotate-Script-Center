# 04-任务详情 网络请求

## 请求标识 / 目的

- 页面路由：`/mytask/detail/<taskId>`
- 访问方式：我的任务列表 → 点击任务名称

## 页面入口 / 触发动作

- 当前文件未补充额外入口说明；默认按对应页面自然加载或用户显式操作触发。

## 请求摘要

- 当前文件未补充更细的请求摘要。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- **响应关键字段**：
  - `data.result.id`：任务 ID
  - `data.result.taskName`：任务名称
  - `data.result.templateName`：任务模板
  - `data.result.isPackage`：是否分包（true）
  - `data.result.packageCount`：总分包数（10）
  - `data.result.notReceivePackageCount`：未领取数（9）
  - `data.result.project.dataRoot`：**OSS 存储域名**（`https://bpp-collect.oss-cn-hangzhou.aliyuncs.com`）
  - `data.result.project.projectName`：项目名称
  - `data.result.assignedOrgName`：分配机构
  - `data.result.assignedTeamName`：分配团队
  - `data.result.acceptTime`：接收时间
  - `data.isSucceed`：是否成功
- **响应关键字段**：

## 关键字段

- 当前重点继续以路径、query、响应字段名和脱敏占位为主。

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 文档只保留当前有效结论；新增缺口统一回写稳定参考页或 `log.md`。
