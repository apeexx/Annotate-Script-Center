# 京东 TTS 上海话文本回填助手运行时

## 适用范围

- 仅在 `https://tts-biaozhu-pub.jd.com/#/annotation/dataset/annotate` 生效。
- 脚本 ID：`jdTtsShanghaineseAssistant`；默认关闭。
- 同一平台只启用本助手时才会挂载页面按钮。

## 当前能力

- 页面已自行发出 `POST /annotation/get_utterance/` 后，主世界脚本仅被动读取成功响应中的当前语句身份和临时音频资源。
- 主世界只在隔离世界携带一次性 nonce 请求时下载当前完整 WAV；跨世界只传递二进制和 `utteranceId + checksum`，不传递资源地址。
- 用户点击“上海话识别”后，浏览器把 WAV Data URL 发送到统一后端的异步 jobs 接口。
- AI 成功且当前语句身份仍一致时，只将原样 `listenText` 回填到“文本:”标签紧邻的 textarea，并只派发一次 `input` 事件。
- 脚本中心的上海话详情页显示独立 AI 设置：AI 开关、固定 `60000ms` 超时、固定关闭 thinking、`qwen3.5-omni-plus / qwen3.5-omni-flash` 模型、可选 Prompt，以及 temperature、top_p、token、penalty、seed、stop 参数。保存后继续复用既有后端 defaults 和运行时读取链路。

## 明确不做

- 不读取、监听、填写或校验“拼音:”textarea。
- 不自动点击、聚焦、失焦、保存、提交、领取或切换下一条。
- 不调用平台的 `reserve/`、文本写入、保存或提交接口。
- 不做批量识别、音频分段、普通话转换、繁简转换、词表替换或文本润色。
- 不提供批量保存、快捷键或自动提交能力。
- 不把临时签名音频地址、WAV Data URL、Cookie 或 Authorization 写入 storage、结果卡、日志或文档。

## 安全校验

- 每次获得新语句身份时立即废弃旧音频快照；回填前再次比较 `utteranceId + checksum`。
- 空结果、请求取消、页面切换、文本框 `disabled` / `readonly`、身份变化或任一音频/AI 错误时均不写入文本框。
- 音频只接受 WAV MIME，大小上限 2 MiB；后端 JSON 请求体上限 3 MiB，AI job 从创建起最长 60 秒。

## 验证

- 加载 `extension/` 后，进入目标标注页并在脚本中心启用“上海话助手”。
- 切换不同语句后再点击识别，确认按钮只出现在“文本:”输入框旁；“拼音:”输入框保持不变。
- 成功识别后确认文本框更新，但页面未自动保存、提交或跳转。真实登录页面验收需要在用户浏览器中完成。
