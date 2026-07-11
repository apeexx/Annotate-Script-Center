# 阿里云百炼官方文档索引

本文件集中维护百炼官方文档入口。涉及模型、参数、thinking、结构化输出、Qwen-Omni、Web Search 等内容时，先查这里。

## API 文档

OpenAI 兼容 Chat 内容：  
[https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016807](https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016807)

OpenAI 兼容 Responses：

- 创建响应：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016539](https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016539)
- 获取响应：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3033492](https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3033492)
- 删除响应：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3033494](https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3033494)
- 获取输入项列表：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3033495](https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3033495)

Anthropic 兼容 Messages：  
[https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=2980295](https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=2980295)

DashScope：  
[https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016809](https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016809)

## 基础文档

- 模型列表：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-market/all](https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-market/all)
- 模型费用：
  [https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148](https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148)
- 调用地区：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=3004398](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=3004398)
- 限流限制：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2840182](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2840182)

## 模型目录

### 文本模型

- `qwen3.6-plus`
  - `modelId`：`qwen3.6-plus`
  - `family`：`text`
  - `categoryDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2841718`
  - `apiDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016807`
  - `pricingUrl`：`https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148`
  - `supportsThinking`：`true`
  - `defaultThinking`：`false`
  - `recommendedUsage`：质量优先文本比较/转换
- `qwen3.5-plus`
  - `modelId`：`qwen3.5-plus`
  - `family`：`text`
  - `categoryDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2841718`
  - `apiDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016807`
  - `pricingUrl`：`https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148`
  - `supportsThinking`：`true`
  - `defaultThinking`：`false`
  - `recommendedUsage`：稳妥文本比较/转换
- `qwen3.6-flash`
  - `modelId`：`qwen3.6-flash`
  - `family`：`text`
  - `categoryDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2841718`
  - `apiDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016807`
  - `pricingUrl`：`https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148`
  - `supportsThinking`：`true`
  - `defaultThinking`：`false`
  - `recommendedUsage`：更快的文本比较/转换
- `qwen3.5-flash`
  - `modelId`：`qwen3.5-flash`
  - `family`：`text`
  - `categoryDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2841718`
  - `apiDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016807`
  - `pricingUrl`：`https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148`
  - `supportsThinking`：`true`
  - `defaultThinking`：`false`
  - `recommendedUsage`：速度优先文本比较/转换默认候选

### 多模态模型

- `qwen3.5-omni-plus`
  - `modelId`：`qwen3.5-omni-plus`
  - `family`：`omni`
  - `categoryDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2867839`
  - `apiDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016807`
  - `pricingUrl`：`https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148`
  - `supportsThinking`：`true`
  - `defaultThinking`：`false`
  - `recommendedUsage`：质量优先音频理解/听音
- `qwen3.5-omni-flash`
  - `modelId`：`qwen3.5-omni-flash`
  - `family`：`omni`
  - `categoryDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2867839`
  - `apiDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=api#/api/?type=model&url=3016807`
  - `pricingUrl`：`https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148`
  - `supportsThinking`：`true`
  - `defaultThinking`：`false`
  - `recommendedUsage`：速度优先音频理解/听音默认候选

### 音频识别模型

- `fun-asr`
  - `modelId`：`fun-asr`
  - `family`：`asr`
  - `categoryDocUrl`：`https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2880903`
  - `apiDocUrl`：`https://help.aliyun.com/zh/model-studio/recording-file-recognition-api-details`
  - `pricingUrl`：`https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148`
  - `supportsThinking`：`false`
  - `defaultThinking`：`false`
  - `recommendedUsage`：速度优先录音文件识别默认候选

## 文本生成

- 概述：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2841718](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2841718)
- 多轮对话：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2866125](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2866125)
- 深度思考：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2870973](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2870973)
- 结构化输出：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2862209](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2862209)
- 批量推理：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2864784](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2864784)

## 语音识别

- 录音文件识别 Fun-ASR / Paraformer：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2880903](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2880903)
- 录音文件识别 千问：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2979031](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2979031)

## 全模态

- 非实时 Qwen-Omni：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2867839](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2867839)

## 视觉与 OCR

- 视觉理解（help.aliyun）：
  [https://help.aliyun.com/zh/model-studio/vision?spm=a2c4g.11186623.help-menu-2400256.d_0_3_1_0.34b2141cE5YHDK](https://help.aliyun.com/zh/model-studio/vision?spm=a2c4g.11186623.help-menu-2400256.d_0_3_1_0.34b2141cE5YHDK)
- 视觉理解：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=3026912](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=3026912)
- 图像与视频理解：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2845871](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2845871)
- 文字提取：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2860683](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2860683)
- 视觉推理：  
  [https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2877996](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2877996)

## 通用能力

- 联网搜索：  
  [https://help.aliyun.com/zh/model-studio/web-search](https://help.aliyun.com/zh/model-studio/web-search)

## 使用规则

1. 涉及模型名称时，先查“模型列表”，模型名必须使用官方列表名称。
2. 涉及调用地区、模型不可用、地域错误时，先查“调用地区”。
3. 涉及限流、并发、QPS、TPM、RPM 时，先查“限流限制”。
4. 涉及 `enable_thinking` / thinking / reasoning 时，先查“深度思考”。
5. 涉及 JSON schema、`json_object`、结构化输出时，先查“结构化输出”。
6. 涉及 Qwen-Omni、音频输入、听音、`input_audio` 时，先查“非实时 Qwen-Omni”。
7. 涉及录音文件识别时，必须区分 Fun-ASR/Paraformer 与千问录音识别文档。
8. 涉及 Web Search、`enable_search`、`search_options`、联网搜索结果时，先查“联网搜索”。
9. 若本地无法访问官方文档，最终输出必须明确“未能联网核对官方文档”，不得伪造结论。
10. 前端不得保存 API Key；后端参数必须白名单过滤；不支持参数前端不显示、后端不发送。
11. 涉及图片理解、OCR、视觉推理、图像/视频输入模型时，必须优先核对“视觉与 OCR”中的四个官方文档。
12. Abaka AI Task21 的视觉模型、OCR/文字提取模型、视觉推理模型必须来自上述官方文档或模型列表。
13. 涉及 Abaka AI Task21 视觉理解模型时，优先核对 `help.aliyun.com/zh/model-studio/vision` 与百炼控制台视觉文档，模型名必须使用官方精确小写名称。
