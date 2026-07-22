# 京东 TTS 标注平台资料

## 平台定位

- 平台标识：`jd-tts-annotation`。
- 当前覆盖页面：`https://tts-biaozhu-pub.jd.com/#/annotation/dataset/annotate`。
- 当前资料和运行时只覆盖当前完整 WAV 的上海话辅助听写与“文本:”字段回填。

## 目录入口

- `shanghainese-helper/README.md`：助手的运行边界、后端接口和日志口径。
- `shanghainese-helper/network/get-utterance.md`：当前语句获取请求的脱敏结构。
- `shanghainese-helper/page-structure/annotation-dataset-annotate.md`：目标页面的稳定 DOM 选择与重渲染结论。
- `shanghainese-helper/backend/README.md`：统一后端注册的 jobs 接口。

## 当前边界

- 页面接口观察是被动的，不改写页面请求、响应、请求头或请求体。
- 助手仅辅助用户填写“文本:”输入框，不处理“拼音:”输入框。
- 不自动保存、提交、领取、送审、切换条目或调用任何平台写操作接口。
- 文档仅保留字段名、类型和脱敏结构；不记录资源地址、签名参数、Cookie、Authorization 或真实转写内容。
