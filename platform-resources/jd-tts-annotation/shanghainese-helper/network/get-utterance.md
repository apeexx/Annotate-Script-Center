# 当前语句获取请求参考

## 请求标识 / 目的

- 请求：`POST /annotation/get_utterance/`。
- 目的：页面取得当前待标注语句的身份、临时音频资源和波形资源。
- 本助手只被动观察已完成的成功响应；不主动触发、不改写该请求。

## 页面入口 / 触发动作

- 页面：`#/annotation/dataset/annotate`。
- 触发：进入标注页或切换到下一条语句。

## 请求摘要

- 方法：`POST`。
- 请求地址仅记录路径，不保存主机以外的资源地址、签名参数、Cookie 或 Authorization。
- 请求体未作为本助手输入，也不写入日志。

## 请求体摘要

- 当前资料未保留请求体内容；助手不依赖请求体判断当前语句。

## 响应摘要

- 顶级字段：
  - `status`: number；`0` 表示成功。
  - `utterance`: object；成功时的当前语句对象。
- `utterance` 已确认字段：
  - `id`: string；数字字符串，用作语句身份的一部分。
  - `checksum`: string；语句/音频校验值，用作身份的一部分。
  - `category`: string。
  - `url`: string；临时音频资源地址，只在页面主世界内短暂使用，不跨世界、不进后端、不进文档日志。
  - `waveform_url`: string；临时波形资源地址，助手不读取。
- 若 `status` 非 `0`，或缺少有效 `id`、`checksum`、HTTPS 音频地址，则不建立可用音频快照。

## 关键字段

- 当前语句身份固定为 `utterance.id + utterance.checksum`。
- 音频响应的已观测约束：状态码 `200`、`Content-Type` 为 `audio/x-wav`；`Content-Length` 为随文件变化的整数。
- 运行时同时兼容 `audio/wav`、`audio/x-wav`、`audio/wave`，并限制 WAV 二进制不超过 2 MiB。

## 前端接入建议

- 新成功响应先同步不含资源地址的身份快照，使旧音频和旧 AI 结果立即失效。
- 仅在隔离世界请求且 nonce 有效时下载当前 WAV；跨世界只传递 `ArrayBuffer`、MIME 和身份字段。
- 回填前再次比较当前页面身份，任一不一致都拒绝写入。

## 风险 / 未确认项

- 临时资源地址可能过期，且其签名参数不能保存或复用。
- 请求体与波形资源不是当前助手的依赖；后续若平台调整字段或响应方式，需要重新采样脱敏结构。
