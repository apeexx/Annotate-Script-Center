# Aishell Tech 粤语助手运行时

## 当前范围

- 仅在 `https://mark.aishelltech.com/mytask/mark?...` 生效。
- 使用 content script 从页面存储读取 JWT，再直接请求 Aishell API；不使用主世界抓包或动态脚本注入。
- 内部 ID 为 `aishellTechCantoneseAssistant`，与 Aishell Tech 的其他语言助手互斥。

## 数据与 AI

- 从任务详情与当前分包缓存读取条目；音频地址固定按 `dataRoot + url` 拼接。
- 粤语助手只识别当前带纯数字 `data-region-label` 的蓝色波形区段：按当前 `regionSelected` 按钮和页面“当前选择”精确匹配编号，使用当前“截取时长”校准像素时间；区段标题只用于校验，不用于推断裁剪范围。说话人 S1–S4 覆盖层不参与音频裁剪、结果绑定或批量目录。
- 浏览器对当前原始音频只获取并解码一次，再离线裁剪对应的 `16kHz` 单声道 WAV Data URL。裁剪失败、区段/按钮数量不一致或当前选择未同步时直接拒绝，不会回退发送整条音频。
- AI 通过 `POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs` 创建任务并轮询结果；成功业务字段只有 `listenText`。
- `listenText` 是原始繁体粤语听音结果。展示、复制、单条回填和批量保存均逐字符使用原值：不转换繁简、不 trim、不折叠或删除空格、不补标点、不做文本归一化。
- 平台参考文本只保留为当前条目的展示与匹配上下文，可以为空；只要条目 ID 和音频地址有效，原始听写仍会执行。
- 结果键绑定“任务条目 + 区段 ID + 起止时间”；切换蓝色区段后，旧识别结果不能填入新段。裁剪 WAV、完整音频地址不会进入前端结果缓存或展示。
- 批量 AI 请求允许按设置并发预取；同一当前音频的解码缓冲由本轮所有区段复用，结束或停止后释放。

## 回填与保存边界

- 单条 AI 识别后只能由用户点击“原样填入”写入当前文本框，绝不自动保存。
- 用户启动“全部”批量后，助手处理当前音频全部带编号的蓝色区段；“未完成”批量逐段切换，并以“文本”输入框为空判定。说话人覆盖层只保留为页面元数据，不进入批量任务。
- 批量 AI 可乱序返回，但结果先缓冲，页面仍按区段编号顺序串行“切换区段 → 校验选择/时长 → 原样填入 → 点击真实保存 → 等待成功提示”。空 `listenText` 只标记人工复核，不填入、不保存。
- 停止批量后立即取消待发与进行中的裁剪/AI 请求，不再发起新识别或保存；已经开始的页面保存会收尾后结束本轮。
- 点击真实保存按钮前会再次同步核对当前条目和蓝色区段，避免用户手动切换页面后误存。
- 不自动提交任务、不跨分包、不写 `.check-area`，也不绕过平台原生 `disabled` 或 `readonly` 限制。

## 验证

- `node --test extension/sites/aishell-tech/cantonese-helper/*.test.js`
- `node --check extension/sites/aishell-tech/cantonese-helper/<modified-file>.js`
