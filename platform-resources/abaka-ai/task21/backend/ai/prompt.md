# Abaka AI Task21 Prompt（abaka-task21-ai-v5-removed-text-multiset）

## 版本与定位

- 当前规则版本：`abaka-task21-ai-v5-removed-text-multiset`（与 `backend/prompt.js` 同步）。
- 默认分析方案：`two_stage`（vision_extract -> reasoning_decide，OCR 可选且默认关闭）。
- 保留方案：`single_model`。
- AI 只提供建议；不自动保存、不自动提交、不自动送审。
- 仅当用户点击“填写 AI 答案”时，前端才执行字段写入。

## same_font 规则

- same_font 只比较 `image_a` 与 `image_b` 的字体结构（typeface/weight/style）。
- 忽略文本内容、颜色、位置、字号、大小写。
- 允许值：
  - `true`
  - `false`
  - `unsure`
  - `error`
  - `same underlying font+artistic effect`
- `same_font=false/unsure/error` 时：
  - `image_b_texts_removed=not_applicable`
  - `other_changes=not_applicable`

## image_b_texts_removed 规则（核心）

仅比较 `image_b` 与 `image_b_removed`，`image_a` 不参与删除判断。

定义多重集（multiset）：

- `T` = target removal text multiset（目标删除文本多重集，仅辅助范围）
- `B` = image_b 可读文本实例多重集
- `R` = image_b_removed 仍可读文本实例多重集
- `D = B - R`（实际删除文本多重集）

判定：

- `D == T` => `true`
- `D` 为空 => `null`
- `D` 非空且 `D != T` => `specify`

补充约束：

- 不能因为“有删字”就一律 `specify`。
- 不能因为“目标文本全删”就一律 `true`，若有 extra/部分删除/数量不匹配仍应 `specify`。
- 仅 `image_b` 有且 `image_b_removed` 无，才算删除。
- `image_b_removed` 仍保留的文本不可写入删除列表。

### 归一比较规则

- 大小写不敏感（case-insensitive）。
- 普通空格和普通字距差异可归一。
- 换行和 `<br>` 有意义，不可合并。
- 输出时保留准确文本形态（如 `MODERN<br>ABODE`）。

### specify 标准答案格式

`specify` 仅允许以下行格式：

- `all instances of xxx`
- `1 instance of xxx`
- `N instances of xxx`

说明：

- 同文本全部实例删除时用 `all instances of xxx`。
- 仅删除 1 个实例时用 `1 instance of xxx`。
- 删除 N 个但不是全部时用 `N instances of xxx`。
- 不允许 bullet、编号、解释句。

## other_changes 规则

- 只比较 `image_b_removed` 与 `image_b`。
- 不比较 `image_a`。
- `specify` 输出英文短句，建议 30 词以内。

## 输出 schema 摘要

最终输出必须是 JSON，核心结构：

- `target`
- `same_font`（applicable/choice/value/confidence/reason/evidence/warnings）
- `image_b_texts_removed`（applicable/choice/value_type/value/lines/segment_count/reason/evidence/warnings）
- `other_changes`（applicable/choice/value_type/value/word_count/reason/evidence/warnings）
- `workflow`（skip_later_fields/skip_reason）

## two_stage 阶段职责

- `vision_extract`：只提取视觉事实，不输出最终字段值。
- `reasoning_decide`：基于规则和观察事实输出最终 JSON。
- `ocr_extract`：仅文本辅助提取（默认关闭）。

## 旧口径迁移说明

本文件已从旧 `v2` 口径升级到当前 `v5`：

- 同步 `same_font=error`。
- 同步 `image_b_texts_removed` 的 T/B/R/D 多重集判断。
- 明确 `image_a` 不参与删除判断。
- 明确 `other_changes` 只比较 `image_b_removed` 与 `image_b`。
