# 标注页文本字段参考

## 页面标识 / 路由 / 前置条件

- 页面：京东 TTS 标注页。
- Hash 路由：`#/annotation/dataset/annotate`。
- 前置条件：用户已进入页面，并在脚本中心显式启用上海话助手。

## 页面总览

- 当前条目包含“文本:”与“拼音:”两个 Element UI textarea。
- 本助手在“文本:”区域提供“上海话识别”按钮，并在该字段下方提供只读“上海话 AI 信息”卡。

## DOM 树 / 区域结构

    div.cell
      span 文本:
      div.input-container.el-textarea.el-input--suffix
        textarea.el-textarea__inner
      span 拼音:
      div.input-container.el-textarea.el-input--suffix
        textarea.el-textarea__inner

## 稳定选择器表

| 目标 | 稳定规则 | 使用方式 |
| --- | --- | --- |
| 文本标签 | 遍历 `div.cell > span:first-child`，仅接受文本精确为 `文本:` 的候选 | 作为唯一挂载起点 |
| 文本输入框 | 文本标签的 `nextElementSibling` 内 `textarea.el-textarea__inner` | 唯一允许读取/写入的 textarea |
| 拼音输入框 | “拼音:”标签后的 textarea | 明确忽略，不选择、不监听、不写入 |
| 按钮位置 | 文本输入框容器之后 | 插入单一“上海话识别”按钮 |
| AI 信息卡 | `data-asc-jd-tts-shanghai-info="true"` | 仅挂在精确“文本:”字段区域；不绑定拼音或页面保存按钮 |

不得依赖 textarea 下标、placeholder 或“拼音:”后的兄弟节点来定位文本输入框。

## 动态区域 / 重渲染风险

- 切换下一条后的已观测结果：文本 textarea 节点未被 Vue 重建。
- 运行时仍用 `MutationObserver` 复核挂载点；若容器或文本 textarea 未来被替换，扩展按钮和 AI 信息卡都会移除旧挂载并重新定位到新的“文本:”区域。
- 原生“自动标注”工具栏临时消失时，只有扩展按钮回退到文本字段旁；信息卡始终随文本字段。工具栏恢复后，按钮会重新迁回原生按钮右侧。
- 接收到新的语句身份时会取消进行中的请求并使旧快照失效，避免旧结果写到新条目。

## 可挂载点建议

- 仅在“文本:”标签的直接相邻容器区域挂载信息卡；扩展按钮优先放在原生“自动标注”右侧，缺失时才放在文本字段旁。
- 若页面结构不再满足该相邻关系，助手不挂载按钮，不进行猜测性回填。

## 页面区域与接口映射

| 页面区域 | 数据来源 | 助手动作 |
| --- | --- | --- |
| 当前条目 | `POST /annotation/get_utterance/` 的成功响应 | 只记录语句身份；主世界按需取得当前 WAV |
| 文本 textarea | AI jobs 成功的 `listenText` | 身份一致时原样回填，并只派发 `input` |
| 上海话 AI 信息卡 | 使用人校验、音频、jobs 与回填状态 | 只读显示当前步骤、结果和脱敏诊断；不触发平台写操作 |
| 拼音 textarea | 页面原有字段 | 不处理 |

## 写操作边界 / 未确认项

- 不调用平台文本写入接口，不点击保存、提交、领取、预留或下一条按钮。
- 不调用 `focus()`、`blur()` 或 `change` 事件；只允许 textarea 原生 `value` setter 和一个 `input` 事件。
- 文本框为空、禁用、只读、AI 结果为空、请求失败、用户取消或身份变化时均不写入。
- 未确认其他标注模板是否复用同一 DOM；当前实现只服务于本页的已采样结构。
