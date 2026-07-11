# GET /oss-proxy-labelx/.../*.wav

## 请求标识 / 目的

该请求是页面自动触发的音频 media 加载。音频 URL 来自 `data.dataList[].data.raw_audio_path`。

## 页面入口 / 触发动作

- 详情页刷新后页面自动加载。
- 点击第一条题卡音频的 `播放` 控件。
- 对第一条题卡音频执行播放、暂停、拖动进度、快进、后退、倍速调整和重载。

## 请求摘要

- Method：`GET`
- URL 形态：`/oss-proxy-labelx/.../*.wav?Expires=<REDACTED>&OSSAccessKeyId=<REDACTED>&Signature=<REDACTED>`
- Status：`206 Partial Content`
- Request Body：无。
- Response Body：音频二进制分片。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

```http
HTTP/2 206 Partial Content
Content-Type: audio/wav
Content-Range: bytes <REDACTED_RANGE>/<REDACTED_TOTAL_BYTES>

<binary audio chunk>
```

## 关键字段

- `206 Partial Content` 表示浏览器使用 Range 方式加载音频。
- 同一音频可能出现多次请求，扩展不能简单按请求次数判断样本数量。
- 音频资源的真实业务关联应回到 `dataList[].data.raw_audio_path` 和同一条样本的 `dataId`。

## 前端接入建议

- 不建议监听 media 请求作为核心数据源。
- 如需关联音频，优先使用 `data` 接口中的 `raw_audio_path` 字段。
- 长期日志只保留是否存在音频、文件扩展名、可选的路径摘要，不保留完整 URL 或签名 query。
- 不建议把暂停、进度拖动、倍速切换作为答案保存信号；本次观察这些操作不触发 `data` 保存接口。
- 如果需要判断音频是否重新加载，可观察同一 `raw_audio_path` 的新增 `206` 请求，但不能依赖请求次数推断用户播放次数。

## 风险 / 未确认项

- 音频加载失败时的状态码和页面表现未采集；该路径依赖异常资源或网络异常，用户确认实际使用中基本不会出现，因此不再主动构造采集。
