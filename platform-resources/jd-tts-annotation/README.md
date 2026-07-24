# 京东 TTS 标注平台资料

## 平台定位

- 平台标识：`jd-tts-annotation`。
- 当前覆盖页面：`https://tts-biaozhu-pub.jd.com/#/annotation/dataset/annotate`。
- 当前资料和运行时只覆盖当前完整 WAV 的上海话辅助听写、确认别名的正字归一化与“文本:”字段回填。

## 目录入口

- `shanghainese-helper/README.md`：助手的运行边界、后端接口和日志口径。
- `shanghainese-helper/network/get-utterance.md`：当前语句获取请求的脱敏结构。
- `shanghainese-helper/page-structure/annotation-dataset-annotate.md`：目标页面的稳定 DOM 选择与重渲染结论。
- `shanghainese-helper/backend/README.md`：统一后端注册的 jobs 接口。

## 当前边界

- 页面接口观察是被动的，不改写页面请求、响应、请求头或请求体。
- 助手仅辅助用户填写“文本:”输入框，不处理“拼音:”输入框。
- 上海话识别前必须在扩展首页保存全局“AI 调用使用人”；缺失时不会读取当前 WAV 或创建 AI 任务。
- “文本:”区域下的只读 AI 信息卡仅展示本次识别状态与脱敏诊断，不保存识别文本到本地存储或运行日志。
- 百炼原文只在本次页面信息卡显示；后端仅以人工确认的 `aliases` 确定性替换为正字，不从普通话翻译反推上海话词汇。
- 不自动保存、提交、领取、送审、切换条目或调用任何平台写操作接口。
- 文档仅保留字段名、类型和脱敏结构；不记录资源地址、签名参数、Cookie、Authorization 或真实转写内容。
