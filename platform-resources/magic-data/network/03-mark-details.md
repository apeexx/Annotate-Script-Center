# 03 标注任务详情页（mark/details）网络摘要

## 请求标识 / 目的

- 当前文件记录该请求或该组请求的稳定参考结论。

## 页面入口 / 触发动作

- URL 示例：`https://work.magicdatatech.com/#/mark/details?...`

## 请求摘要

- method：`POST`
- pathname：`/api/management-service/userTaskDetail/getUserTaskDetailList`
- query keys：无
- method：`POST`
- pathname：`/api/management-service/userTaskDetail/detail`
- query keys：无

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- response 顶层字段：`code,data,message,messageDetail`
- response 顶层字段：`code,data,message`

## 关键字段

- 当前重点继续以路径、query、响应字段名和脱敏占位为主。

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 文档只保留当前有效结论；新增缺口统一回写稳定参考页或 `log.md`。
