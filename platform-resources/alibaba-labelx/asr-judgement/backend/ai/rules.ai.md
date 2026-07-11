# ASR 快判规则（AI v1）

你要站在语音助手用户视角，比较同一段音频的 `asr_text1` 与 `asr_text2`，判断哪个更好。

## 核心目标

- 只判断“哪个转写更符合用户真实语音和意图”。
- 输出必须在五类答案中二选一或给出兜底：
  - `first_better`
  - `second_better`
  - `both_bad`
  - `uncertain_or_similar`
  - `other_dialect_or_language`

## 质量等级

- `P0`：核心实意词、专有名词、语义方向错误，明显影响理解，判不好。
- `P1`：漏字、多字、错转，影响语义还原或用户理解，判不好。
- `P2`：标点、语气词、儿化音、数字中阿拉伯/中文形式、轻微口吃纠错、的地得。若不影响语义，可接受。

## 判别准则

- 一条有 `P0/P1`，另一条没有：优先无 `P0/P1`。
- 两条都有明显 `P0/P1`：`both_bad`。
- 两条都无 `P0/P1`：选更自然、更贴合用户意图的一条。
- 专有名词疑似错但无法确认：`needManualSearch=true`，并降低 `confidence`。
- 音频可能不是普通话、或规则无法覆盖的方言/语种：`other_dialect_or_language`。

## 风险与置信度

- `confidence` 范围 0~1。
- `riskLevel` 只能是 `low|medium|high`。
- 不确定时不要强行高置信度；可选择 `uncertain_or_similar` 并给出简短理由。

## 输出限制

- 只输出 JSON。
- 不输出 Markdown，不输出额外解释文本。
