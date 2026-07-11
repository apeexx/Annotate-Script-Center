# Magic Data ANNOTATOR 安全边界

## 请求标识 / 目的

- 当前文件记录该请求或该组请求的稳定参考结论。

## 页面入口 / 触发动作

- 用户主动点击后：定位当前条目、定位文本区、执行只读复制类操作
- 用户主动点击后：执行播放/暂停等非提交型前端动作（不变更业务状态）
- 用户主动点击后：导出脱敏调试信息（不含 token/cookie/完整音频URL）

- 调用任何可能写入平台状态的接口前
- 涉及任务状态迁移动作：开始、领取、退回、通过、驳回
- 涉及批量动作：批量提交、批量流转、批量审核
- 涉及人员归属变更、分配变更、删除

以下接口来自前端 bundle 关键字检索与已观测链路归纳，当前轮均未主动触发：

- 标注侧
  - `/management-service/annotateTask/save`
  - `/management-service/annotateTask/submit`
  - `/management-service/annotateTask/pending`
  - `/management-service/annotateTask/upOrDown`
  - `/management-service/annotateTask/goBack`
- 抽检/审核侧
  - `/management-service/sampling/save`
  - `/management-service/sampling/submit`
  - `/management-service/checkMark/save`
  - `/management-service/checkMark/wholeQua/...`
  - `/management-service/checkMark/wholeBack`
- 元素级写操作
  - `/management-service/taskElement/annoSubmit`
  - `/management-service/taskElement/checkSubmit`
  - `/management-service/taskElement/save`
  - `/management-service/taskElement/saveCheck`
  - `/management-service/taskElement/del`

## 请求摘要

- 当前文件未补充更细的请求摘要。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

- 当前文件未补充独立响应结构。

## 关键字段

- 当前重点继续以路径、query、响应字段名和脱敏占位为主。

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 文档只保留当前有效结论；新增缺口统一回写稳定参考页或 `log.md`。
