# Aishell Tech 闽南语助手

## 目录职责

- `ai/adapter.js`：Aishell 请求归一与成功/失败响应契约适配辅助。
- `backend/`：Aishell 独立 AI recommend 后端；底层只复用公共 provider HTTP 工具，不再复用 DataBaker recommend orchestration。
- `data/`：脚本资料、后续样例，以及当前 Aishell 平台专属 AI 调用 CSV 副本目录。

## 当前范围

- 仅服务 `https://mark.aishelltech.com/mytask/mark?...` 的闽南语推荐文本助手。
- 接口独立为 `/api/aishell-tech/minnan-helper/ai/recommend*`。
- Prompt、模型白名单与默认模型仍参考现有 DataBaker 口径；Aishell 继续保留自己的闽南语转换词表副本路径，运行时主文件固定为 `minnan-lexicon.json`，参考源继续保留 `minnan-lexicon.csv`。当前这轮已与 DataBaker 同步落同一份词表内容；后续如需分叉，再分别维护各自副本。如果 JSON 缺失但本地 CSV 仍在，页面会在右下角弹出一次“没有字词对应表”提示，停留约 1 秒后自动消失，不会回退成 CSV 主读取。
- 当前默认配置已收口为独立的 `转换 / 听音 / 比较` 三板块：`转换 qwen3.5-plus + 听音 qwen3.5-omni-flash + Qwen 比较 qwen3.5-plus`。
- `转换` 当前改为“规则优先 + 歧义时 AI 兜底”：运行时主读 `minnan-lexicon.json`，参考源 `minnan-lexicon.csv` 仅保留给人工整理和外部 AI 处理；默认仍按 `对应华语 -> 建议用字` 做最长匹配替换，只有命中多候选或切分冲突时才调用转换模型。
- options 页当前已与 DataBaker 共用固定顺序的右侧 `AI 设置` 模块；`AI 连续填入并发数量` 已移动到该区域，默认 `5`，Omni 范围 `1~25`，Fun-ASR 范围 `1~50`。
- 当前只保留三板块并行口径：
  - `转换`：先按词表规则做最长匹配替换；只有命中歧义词或切分冲突时，才会调用文本模型做受限兜底，输出 `convertedText`。
  - `听音`：继续按实际发音输出 `heardText`，不负责最终推荐。
  - `比较`：`Qwen` 只做纯文本比较；`Omni` 固定作为独立的第三段音频比较请求。
  - `pageText` 与词表只作为参考，不再主导改写；音频里没有读出的词不补回。
  - options 页当前可单独配置三段模型、Prompt 和参数；比较段额外支持 `比较方式` 与 `采纳阈值`。
  - 后端仍会构建词表上下文给模型参考，但 `lexicon.rewriteMode` 固定为 `off`，不会再做后端强制词表改写。
- 当前独立队列组固定为 `aishell_qwen_omni / aishell_fun_asr / aishell_text_compare`。
- 当前环境变量默认优先读取 `AISHELL_AI_*`；第一阶段仍允许只读回退旧的 `DATABAKER_AI_*`。
- 当前默认链路为短请求创建 job + HTTP 轮询结果；同步 `POST /recommend` 仅保留兼容 / 调试用途，不引入 SSE 或 WebSocket；当前同步总超时统一为 `60000ms`。
- Aishell 当前已单独拆出 `backend/dashscope-omni-client.js` 处理 DashScope compatible-mode 的 Omni 音频请求，并固定 `enable_thinking=false`。
- 当前仓库所有 AI 链路都已统一固定关闭 thinking；Aishell 不再开放 thinking 作为有效配置项。
- 成功响应固定为 `success + data + meta`，失败响应固定为 `success=false + error + meta`。
- 只有响应真正成功写回客户端后，才允许写成功缓存与成功 CSV；取消、超时或连接中断不会再在刷新后伪装成缓存命中结果。
- 前端会在构建 recommend 请求前，自动从 Aishell 头像下拉提取平台账号；`ASmnbz001【标注人员】` 这类显示文本会先归一成纯账号 `ASmnbz001`，再作为 `platformUserName` 发往后端。
- 前端批量链路当前为“AI 并发请求 + 页面串行保存”：
  - 先按 `packageItemList` 直接生成当前分包待处理条目，并从第 1 条扫到最后 1 条。
  - 页面当前拆成两个批量入口：
    - `全部AI批量识别`：整包扫描，包含 `dataStatus === 2` 的已完成条目。
    - `未完成的AI批量识别`：只处理未完成条目；默认 `0` 视为待处理。
  - 启动后会先把前端请求窗口尽快灌满到当前并发上限。
  - 某条 AI 一旦返回结果，就立即释放 1 个前端请求槽位并补发下一条，不等待当前条保存完成。
  - AI 结果谁先返回，谁先进入保存队列；保存阶段继续串行执行。
  - 真正写页面前，会按条目编号与文件名后缀重新匹配左侧列表，再触发平台真实“保存”按钮。
  - 右侧当前条校验会优先从 `.fileName-line` 整行提取 `编号: 文件名.wav`，兼容平台把编号单独放在首个 `span`、文件名和工具按钮共用一行的结构。
  - 保存成功优先以页面 `保存成功!` 提示为准；若提示未及时出现，再回退检查 `getShortMark / packageItemList` 的保存结果。
  - 用户手动停止后不再发起新的 AI 请求；当前保存步骤结束后结束本轮，已在途请求允许自然结束。
- 后端默认 Prompt 已限制 `heardText / recommendedText` 必须使用简体中文，不允许输出繁体字；前端不再做二次繁简转换。
- Aishell 当前会额外把每次 recommend 的成功/失败调用写一份到 `data/runtime/ai-calls-YYYY-MM-DD.csv`，作为本平台单独日志副本；这一步先独立实现，暂不并入统一日志合并层。
- 当前也已补齐平台内统计接口：
  - `GET /api/aishell-tech/minnan-helper/ai/recommend/logs/summary`
- 前端 UI 口径当前固定为“嵌入式推荐卡片 + 原生按钮注入”：
  - 推荐卡片嵌入标注表单下方。
  - `AI识别` 放在原生“保存”按钮右侧。
  - `全部AI批量识别 / 未完成的AI批量识别 / 停止批量` 放在原生工具按钮区域。
  - 当前识别结果区会显示原始文本、转换文本、听音文本、推荐文本，以及“听音文本 vs 转换文本”的差异高亮。
  - AI 诊断信息会继续显示执行链路、模型选择、比较方式、采纳阈值、校正置信度、AI耗时、前端并发、token、FunASR provider、后端模式、后端地址、是否发生自动回退、requestId、debugId。
  - 当前识别结果区与批量失败详情现在统一优先读取后端 `meta`，额外展示排队等待、缓存命中与阶段信息。
  - 批量状态区会显示 `前端并发 / 发送间隔 / 已发请求 / AI处理中 / AI已返回 / 待保存队列 / 已完成 / 失败数 / 批量输入Token / 批量输出Token / 批量总Token / 批量预估人民币`，方便区分是前端未灌满请求窗口、后端模型池仍在排队，还是本轮 AI 消耗已经累计到什么程度。
  - 若用户当前把全局后端模式切到“本机（127.0.0.1:3333）”，但本机接口不可达，前端会对本次请求自动回退一次服务器接口 `script.xiangtianzhen.store`，同时保留当前设置不变。
  - 浏览器层请求失败时，前端会把当前后端模式、请求 endpoint、回退 endpoint、原始异常名/消息与 online 状态直接写进原始诊断 JSON，便于现场排查是本机服务未启动、网络失败还是扩展上下文失效。
  - 若真实 `POST /recommend` 在网络层失败，前端还会补打一条 `GET /recommend/health`；health 成功时会把问题归类为“服务器入口可达，但真实推荐请求链路被中断”，便于优先排查反向代理和 Node 进程层。
  - 批量失败清单的每条记录都支持 `查看详情 / 查看原始JSON`，方便区分是 AI 请求失败、切条失败还是保存失败，并直接查看对应上下文。
- Aishell 前端支持独立快捷键配置：单条识别、批量识别、复制听音文本、复制推荐文本、填入并保存当前条、忽略结果；当前批量快捷键仍对应“未完成的AI批量识别”。
