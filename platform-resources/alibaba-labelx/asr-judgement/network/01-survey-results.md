# GET /api/v1/label/surveyResults

## 请求标识 / 目的

该请求出现在详情页初始化早期。本次采集中返回 `404`，响应体为空。当前 ASR 更优判断详情页未观察到依赖该请求渲染核心内容。

## 页面入口 / 触发动作

- 打开详情页。
- 刷新详情页。

## 请求摘要

- Method：`GET`
- URL：`/api/v1/label/surveyResults`
- Query：
  - `_=<REDACTED_TIMESTAMP>`
- Request Body：无。
- Status：`404`
- Response Body：空。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

该请求出现在详情页初始化早期。本次采集中返回 `404`，响应体为空。当前 ASR 更优判断详情页未观察到依赖该请求渲染核心内容。
- Response Body：空。
<empty response>

## 关键字段

- `_<timestamp>` 是前端通用防缓存参数。
- `location` 指向任务列表页，可能是旧 survey 能力的兼容跳转。
- 当前页面可以把该请求视为非核心请求。

## 前端接入建议

- 不建议将该请求作为 ASR 更优判断页面是否加载成功的依据。
- 如果做网络监听，可以记录为初始化噪声请求。

## 风险 / 未确认项

- 其他 LabelX 项目或 survey 类型页面是否使用该接口尚未确认。
