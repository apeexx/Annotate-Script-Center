# 07 审核单条页（asrmarkCheck）网络摘要

## 请求标识 / 目的

- 当前文件记录该请求或该组请求的稳定参考结论。

## 页面入口 / 触发动作

- URL 示例：`https://work.magicdatatech.com/#/asrmarkCheck?formType=1&id=...`

- method：`GET`
- hostname：`work.magicdatatech.com`
- pathname：`/api/management-service/sampling/projectInfo/{samplingRecordId}`
- response 顶层字段：`code,data,message,messageDetail`
- data 常见字段：`projectName,batchId,batchNo,nodeId,projectRate,closeButton,...`
- 用途推断：加载审核头部项目状态信息
- 是否敏感操作：否（读）
- 自动化边界：可观察

## 请求摘要

- method：`GET`
- hostname：`work.magicdatatech.com`
- pathname：`/api/management-service/annotateTask/historySubmitter/{taskItemId}`
- response 顶层字段：`code,data,message`
- data 常见字段：`nodeName,nickName,groupName,submitTime`
- 用途推断：显示历史提交人/时间
- 是否敏感操作：否（读，含个人信息字段，文档只保留字段名）
- 自动化边界：可观察

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- response 顶层字段：`code,data,message`
- response 顶层字段：`code,data,message,messageDetail`
- response 顶层字段：`code,data,message,messageDetail`
  - `samplingRecordId,taskBranchId,taskItemId,data.path,data.mark_info,data.statistics,allTaskBranchList,currentPkgItemList,isSubmit,...`
- response 顶层字段：`code,data,message,messageDetail`
- response 顶层字段：`code,data,message,messageDetail`
- response 顶层字段：`code,data,message`

## 关键字段

- 当前重点继续以路径、query、响应字段名和脱敏占位为主。

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 文档只保留当前有效结论；新增缺口统一回写稳定参考页或 `log.md`。
