# 京东 TTS 上海话助手资料

## 目录职责

- `backend/`：上海话单阶段 Qwen Omni 异步识别接口。
- `network/`：当前语句获取请求的稳定脱敏参考。
- `page-structure/`：目标标注页的 DOM 结构和安全挂载规则。
- `data/`：AI 调用日志定义与本地运行产物目录。

## 当前能力

- 仅处理当前完整 WAV；成功业务结果同时返回百炼 `rawListenText` 与加工后的 `listenText`，页面仅回填后者。
- 后端读取 `backend/lexicon/shanghainese-lexicon.json` 的人工确认别名，将 `aliases` 字面量最长优先替换为对应 `display` 正字；不使用普通话释义、不调用第二个模型，词表缺失、无匹配或不合法时安全原样返回。
- 默认模型为 `qwen3.5-omni-plus`，可选 `qwen3.5-omni-flash`；强制关闭 thinking，任务从创建起最长 60 秒。
- 脚本中心上海话详情页提供 AI 开关、固定 `60000ms` 超时、固定关闭 thinking、模型、可选 Prompt 和单阶段生成参数的保存入口；继续使用既有 defaults 与运行时配置读取链路。
- 前端以 `utteranceId + checksum` 验证 AI 是否回显本次请求，并在回填前以完整 WAV 内容验证目标仍属同一整条音频。画段引起的快照变化不会阻断回填；完整 WAV 不同才拒绝旧结果。
- 空识别结果标为人工复核，不写入文本框。
- 首页全局“AI 调用使用人”是识别前置条件；首页保存后会从扩展存储回读确认，上海话客户端每次识别也重新读取同一实例的有效状态。兼容入口和 jobs 入口继续在创建任务前校验。缺失时返回 `missing-ai-usage-operator-name` 与 `validate`，不读取音频、不创建任务；扩展重载后的旧页面上下文会提示刷新当前标注页。
- 创建 jobs 前必须完成后端 health 门禁：服务端 health 为 `404` 而本机 health 为 `200` 时，只向本机创建一个 job；两端 health 均失败、`404` 或无法连接时返回 `backend-health-check-failed` 与 `health`，不创建 job、不发送 WAV。jobs 创建阶段的 `404` 会映射为 `shanghainese-route-not-deployed`，并按本地/服务端模式给出启动本机后端或远端未部署路由的脱敏建议。
- “文本:”或“文本：”所在 `.cell` 内仅有一个 textarea 时，才挂载“上海话 AI 信息”卡并锁定该文本框；另兼容已采样的共享结构：同一 `FONT` 内依次只有“文本:”/“文本：”和“拼音:”/“拼音：”标签，且 `.cell` 直属的两个 Element UI 输入容器中第一个容器唯一含有 textarea。共享结构仅查询、锁定和写入第一个容器的 textarea，绝不查询、读取、监听、写入或触发第二个（拼音）textarea；其他不唯一或结构不完整的 `.cell` 绝不作为候选。其中回填前步骤为“校验完整 WAV”。信息卡默认展示百炼原文、正字加工后文本和替换次数；详细信息仅含模型、耗时、Token、费用、排队、缓存和 requestId。
- 失败卡显示失败步骤、脱敏错误摘要和下一步建议；空识别、完整 WAV 切换、后端结果身份不一致、只读文本框和超时各自给出明确结论，不向平台文本框写入状态。

## 接口与日志

- 接口根路径：`/api/jd-tts-annotation/shanghainese-helper/ai/recommend`。
- 当前运行时使用 `POST /jobs` 创建任务并轮询结果；根 `POST /recommend` 同样返回异步 job，供兼容调用。
- jobs 完成态的 `data` 保留完整成功响应体，浏览器端必须解包其内层业务 `data`，再取得 `utteranceId`、`checksum`、`rawListenText`、`listenText`、无文本内容的 `orthography` 摘要和脱敏 `meta`；不得把任务外壳字段作为业务结果。
- 脚本级 AI 日志下载项：`jd-tts-shanghainese-helper-ai`。
- 运行时 CSV 目录：`data/runtime/`；该目录下的生成文件不提交 Git。

## 本地验收

1. 在仓库根目录运行 `node platform-resources/backend/server.js`，确认 `http://127.0.0.1:3333/api/jd-tts-annotation/shanghainese-helper/ai/recommend/health` 返回 `200`。
2. 在扩展首页保存“本地”后端模式、`http://127.0.0.1:3333` 与全局“AI 调用使用人”，随后刷新京东标注页。
3. 任意点选波形画段后点击“上海话识别”，确认助手仍只处理当前完整 WAV，信息卡经过健康检查、创建任务、等待结果和“校验完整 WAV”，并展示百炼原文、正字加工后文本及替换次数；仅回填精确“文本:”或“文本：”textarea。
4. 停止本机后端后重试，确认流程停在“后端健康检查”，既不创建 jobs，也不向 AI 后端发送 WAV。

## 回填边界

- 标注员在京东标注页点击扩展功能“上海话识别”启动识别。它通常直接位于平台“自动标注”按钮右侧，属于独立扩展按钮而非平台按钮；若平台工具栏暂时缺失或被 Vue 重建，按钮可安全地显示在精确“文本:”或“文本：”字段旁，并在工具栏重建后重新挂载。
- 按钮只识别当前完整 WAV，不解析或裁剪波形画段，只写入点击时锁定的精确“文本:”或“文本：”textarea。
- 只定位含“文本:”或“文本：”标签的 `.cell` 内唯一 textarea，或已采样的“文本/拼音”共享结构中第一个直属输入容器的唯一 textarea；设置已正字加工的 `listenText` 并派发 `input`，标签可被 `FONT` 等页面元素包裹。
- “拼音:”或“拼音：”textarea 不在选择、监听、读取或写入范围内。
- 不调用 `focus()`、`blur()`、保存、提交、领取或 `reserve/` 等平台操作。
- 不支持批量保存、快捷键或自动提交。
- 不保留资源地址、签名参数、音频 Data URL、Cookie、Authorization 或真实转写内容。
- 不在卡片或错误摘要中暴露 jobId、临时资源地址、音频内容或鉴权字段。
