# 闽南语助手网络资料

## 请求标识 / 目的

本文档记录 `roundOneCollect` 详情页当前已知网络接口。所有内容均为脱敏结构，不记录真实 token、cookie、完整签名音频 URL 或客户数据。

## 页面入口 / 触发动作

该接口通常在以下场景触发：

- 进入 `roundOneCollect` 详情页。
- 点击左侧搜索 / 重置。
- 修改分页页码。
- 修改每页条数。
- 可能在切换筛选条件后重新请求。

## 请求摘要

GET https://datafactory.data-baker.com/cms/tbAudioUserTask/queryCollectStatementByCondtion

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

每条记录通常包含：

```text
id
audioUrl
audioText
sentenceNumber
readRequire
effectiveStartTime
effectiveEndTime
effectiveTime
audioDuration
vad
statusName
collectId
textId
snr
volume
noise
```

重点字段说明：

- `list[].statusName`：判定是否允许处理（只处理“质检合格”）。
- `list[].audioText`：当前句候选文本。
- `list[].audioUrl`：音频地址（仅内存使用，日志与文档不记录完整 URL）。
- 其余重复细节已省略；如需补充，只保留当前有效结论。

运行时兼容多种列表包裹结构：

```text
data.list
data.records
data.rows
data.data
data
records
rows
list
```

总数字段兼容：

```text
data.total
data.count
data.totalCount
total
count
totalCount
```

如果后续确认真实接口固定结构，应回填本文档并收窄代码兼容范围。

## 关键字段

每条记录通常包含：

```text
id
audioUrl
audioText
sentenceNumber
readRequire
effectiveStartTime
effectiveEndTime
effectiveTime
audioDuration
vad
statusName
collectId
textId
snr
volume
noise
```

重点字段说明：

- `list[].statusName`：判定是否允许处理（只处理“质检合格”）。
- `list[].audioText`：当前句候选文本。
- `list[].audioUrl`：音频地址（仅内存使用，日志与文档不记录完整 URL）。
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 文档只保留当前有效结论；新增缺口统一回写稳定参考页或 `log.md`。
