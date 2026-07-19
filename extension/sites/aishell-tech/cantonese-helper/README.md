# Aishell Tech 粤语助手运行时

## 当前范围

- 仅在 `https://mark.aishelltech.com/mytask/mark?...` 生效。
- 使用 content script 从页面存储读取 JWT，再直接请求 Aishell API；不使用主世界抓包或动态脚本注入。
- 内部 ID 为 `aishellTechCantoneseAssistant`，与 Aishell Tech 的其他语言助手互斥。

## 数据与 AI

- 从任务详情与当前分包缓存读取条目；音频地址固定按 `dataRoot + url` 拼接。
- AI 通过 `POST /api/aishell-tech/cantonese-helper/ai/recommend/jobs` 创建任务并轮询结果；成功业务字段只有 `listenText`。
- `listenText` 是原始繁体粤语听音结果。展示、复制、单条回填和批量保存均逐字符使用原值：不转换繁简、不 trim、不折叠或删除空格、不补标点、不做文本归一化。
- 平台参考文本只保留为当前条目的展示与匹配上下文，可以为空；只要条目 ID 和音频地址有效，原始听写仍会执行。
- 结果与任务详情维持当前分包内缓存；批量 AI 请求允许按设置并发预取。

## 回填与保存边界

- 单条 AI 识别后只能由用户点击“原样填入”写入当前文本框，绝不自动保存。
- 用户启动批量后，助手才按完成的 AI 结果逐条切换页面、原样填入，并点击平台真实“保存”按钮；页面切换、填入和保存严格串行。
- 停止批量后立即取消待发与进行中的 AI 请求，不再发起新请求；已开始的页面保存会收尾后结束本轮。
- 不自动提交任务、不跨分包、不写 `.check-area`，也不绕过平台原生 `disabled` 或 `readonly` 限制。

## 验证

- `node --test extension/sites/aishell-tech/cantonese-helper/*.test.js`
- `node --check extension/sites/aishell-tech/cantonese-helper/<modified-file>.js`
