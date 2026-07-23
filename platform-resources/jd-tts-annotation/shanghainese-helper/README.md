# 京东 TTS 上海话助手资料

## 目录职责

- `backend/`：上海话单阶段 Qwen Omni 异步识别接口。
- `network/`：当前语句获取请求的稳定脱敏参考。
- `page-structure/`：目标标注页的 DOM 结构和安全挂载规则。
- `data/`：AI 调用日志定义与本地运行产物目录。

## 当前能力

- 仅处理当前完整 WAV；成功业务结果固定为 `listenText`。
- 默认模型为 `qwen3.5-omni-plus`，可选 `qwen3.5-omni-flash`；强制关闭 thinking，任务从创建起最长 60 秒。
- 前端以当前 `utteranceId + checksum` 绑定音频、AI 结果和回填目标，防止切换语句后串写。
- 空识别结果标为人工复核，不写入文本框。

## 接口与日志

- 接口根路径：`/api/jd-tts-annotation/shanghainese-helper/ai/recommend`。
- 当前运行时使用 `POST /jobs` 创建任务并轮询结果；根 `POST /recommend` 同样返回异步 job，供兼容调用。
- 脚本级 AI 日志下载项：`jd-tts-shanghainese-helper-ai`。
- 运行时 CSV 目录：`data/runtime/`；该目录下的生成文件不提交 Git。

## 回填边界

- 标注员在京东标注页点击扩展功能“上海话识别”启动识别。它通常直接位于平台“自动标注”按钮右侧，属于独立扩展按钮而非平台按钮；若平台工具栏暂时缺失或被 Vue 重建，按钮可安全地显示在精确“文本:”字段旁，并在工具栏重建后重新挂载。
- 按钮只识别当前完整 WAV，只写入精确“文本:”textarea。
- 只定位精确“文本:”标签后紧邻容器内的 textarea，原样设置其值并派发 `input`。
- “拼音:”textarea 不在选择、监听、读取或写入范围内。
- 不调用 `focus()`、`blur()`、保存、提交、领取或 `reserve/` 等平台操作。
- 不保留资源地址、签名参数、音频 Data URL、Cookie、Authorization 或真实转写内容。
