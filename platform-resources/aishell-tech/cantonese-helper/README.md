# 希尔贝壳粤语助手资料

## 当前能力

- 运行时代码：`extension/sites/aishell-tech/cantonese-helper/`。
- 仅在 `https://mark.aishelltech.com/mytask/mark?...` 工作页启用。
- 使用当前分包条目的 `dataRoot + url` 拼接 OSS 音频地址；保留任务、分包、条目、参考文本、页面当前文本、条目编号、时长和使用人元数据。参考文本可为空，不阻断基于音频的原始听写。
- AI 为单次 Omni 原始听写。浏览器先按当前蓝色波形区段裁剪原始音频为 `16kHz` 单声道 WAV Base64 Data URL，再交给模型；这是对原先“直传 OSS URL”的已批准替换。
- 区段从 `wave > region.wavesurfer-region` 中按编号建立目录：唯一纯数字 `data-region-label` 为主段，编号可以稀疏且始终优先。若没有纯数字主段，严格“说话人 S1–S4:局部编号”节点可与未保存手绘节点共同建目录；后者只能是空标签、完整匹配的 `wavesurfer_` 前缀 ID 且 CSS 几何为完整 `px` 值的 Wavesurfer 临时节点。节点与按钮精确 `1…N` 对应时，按 CSS `left` 升序映射为全局 `1…N`；同一 `left` 仅以波形区域 DOM 顺序作次级排序。若最小纯数字主段为 `N>1`，其左侧恰好 `N-1` 个严格说话人节点也按同一规则映射为前缀 `1…N-1`。冒号后的局部编号、标题时间，以及跨不同 `left` 的 DOM 顺序均不参与映射；非空未知标签、临时 ID 异常或重复、按钮/几何不安全时拒绝全位置映射。前缀映射失败仅标记对应段预检失败，不影响安全纯数字段。目录按页面区段按钮与“当前选择”精确匹配；使用当前“截取时长”校准区段 CSS `left / width` 的像素时间。区域标题仅作非阻断诊断，不参与裁剪范围计算或识别拒绝。编号重复、按钮映射、当前选择、时长、CSS 几何或裁剪后的音频实际范围无效时拒绝识别，绝不回退整段音频。
- 请求固定携带 `regionId`、`segmentNumber`、`startMs`、`endMs`、`durationMs` 与 `selectionKey`。完整 `audioUrl` 仅保留为瞬时来源上下文，不送入模型，也不写入缓存、调试摘要或日志。
- 成功业务结果唯一为繁体粤语口语 `listenText`。页面展示、复制和填入都原样使用该字段，不做繁简转换、去空格、补标点或词表替换；但精确 `#N#` 代表多人重叠、串音、静音或听不清，固定标记人工复核，绝不自动填入或保存。

## 保存与批量边界

- 批量按钮始终挂载到 `.mark-area` 中真实“保存”按钮所在操作行，紧跟“AI识别”后；旧“删除音频标点 / 查看历史标注记录”工具栏不参与挂载。顺序固定为“保存 → AI识别 → 全部AI批量识别 → 未完成的AI批量识别 → 停止批量”。页面重绘后会复核真实保存按钮的父容器并恢复该顺序，页面中每个批量按钮始终只有一枚。
- 单条识别和“原样填入”不会自动保存。
- 用户明确启动批量后，“全部”覆盖当前音频的全部安全带编号蓝色区段，“未完成”逐段切换并以“文本”输入框为空筛选；预检失败段从开始即计入失败统计，不裁剪或发起 AI。仅当前选择预检失败或明确缺时长、比例/范围无效时，才切换至最小安全纯数字段校准；按钮映射或选择同步错误不会自动切换。粤语批量固定只保留 `1` 个在途识别作业，避免前端历史并发设置把单并发上游队列排满；每段返回后才会发起下一段。
- 每次批量保存仍只点击页面真实“保存”按钮，不直接调用平台写接口。成功确认依次接受新的成功提示、列表已切换或完成、平台已读回与本段逐字符一致的 `listenText`、以及分包条目已标注状态；因此页面未渲染 Toast 时，不会把已实际保存的区段误记为失败。
- 正常结束但返回空 `listenText`，或返回精确 `#N#` 时均计为人工复核，不填入、不保存；截断或畸形响应保持接口错误。最终 `429` 会记录当前段并暂停剩余未发段，避免同一额度窗口继续制造连锁失败；用户可稍后使用“未完成的AI批量识别”继续。停止批量只取消未发请求；已发 AI 与已开始保存自然安全收尾，但不再启动新的保存。
- 不自动提交任务，不跨分包处理，也不操作质检控件。

## 后端

后端说明见 `backend/README.md`。统一接口前缀为：

- `GET /api/aishell-tech/cantonese-helper/ai/recommend/health`
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/defaults`
- `POST /api/aishell-tech/cantonese-helper/ai/recommend`
- `POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs`
- `POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/cancel`
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId`
- `GET /api/aishell-tech/cantonese-helper/ai/recommend/jobs/:jobId/debug`

## 边界

- 默认模型为 `qwen3.5-omni-plus`，只允许切换到 `qwen3.5-omni-flash`。
- 模型 Prompt 和白名单参数由 Options 保存，空 Prompt 回退后端默认的粤语原始听写 Prompt；后端始终追加“重叠或无法确认只输出 `#N#`”的安全规则，不能被旧的已保存 Prompt 覆盖。
- 请求体上限为 `3MB`；超过时返回结构化 `payload-too-large`，不把音频内容、完整音频地址或凭据写入调试信息。
- 粤语后端使用独立的 `aishell_cantonese_qwen_omni` 队列：默认每分钟最多 `8` 个上游请求、上游并发 `1`。该队列不按具体模型名改写键，因此不会落入通用模型队列的宽松默认值；429 重试同样重新占用请求间隔，后续任务从最后一次真实上游调用继续节流。最终限流失败会保留脱敏诊断、上游状态码、provider code 和重试次数。
- 不使用主世界抓包、动态脚本注入、SSE 或 WebSocket。
