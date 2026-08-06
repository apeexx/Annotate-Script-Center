# ego-annotation-gui 分段标注页参考

## 页面标识 / 路由 / 前置条件

- 页面：Pulse `ego-annotation-gui` 标注页。
- 路由：`/annotation/my/corrector/ego-annotation-gui/<任务标识>`。
- 前置条件：用户已进入任务页，并在脚本中心显式启用 Pulse 分段标注助手。

## 页面总览

- 左下时间线包含 `TIMELINE · N SEGMENTS` 标题、固定像素宽度的相对定位轨道，以及若干绝对定位分段。
- 页面可见帧信息形如 `f 1251 / 3980` 和 `30 fps`；右上角原生区域已显示当前片段的起止时间与秒数。
- 中文翻译组的标签文本精确为“中文翻译”，组内包含原平台 textarea。

## DOM 树 / 区域结构

    时间线标题父容器
      标题节点：TIMELINE · N SEGMENTS
      span[data-asr-edge-pulse-timeline-timer]
    div.relative[style*="width"]（时间线轨道）
      div.absolute.overflow-hidden[style*="left"][style*="width"]（分段）
    div.flex.flex-col.gap-1（中文翻译组）
      div（含“中文翻译”标签和“英译中”按钮）
      textarea.ant-input
      section[data-asr-edge-pulse-translation-panel]

## 稳定选择器表

| 目标 | 稳定规则 | 使用方式 |
| --- | --- | --- |
| 时间线轨道 | `div.relative` 具有效内联宽度，且直接子元素中至少一个同时有 `absolute`、`overflow-hidden`、`left` 和 `width` | 作为像素到帧的换算基准 |
| 当前分段 | 上述轨道直接子分段中 `z-index > 1` 的最高层节点 | 仅读取 `left / width`；按下时记为拖动基线 |
| 帧信息 | 页面可见文本精确匹配 `f 当前 / 总帧` 与 `fps` | 总帧和帧率均有效时只输出分段长度秒数及边界拖动变化值 |
| 中文翻译标签 | `span` 的 trim 后文本精确为“中文翻译” | 向上寻找第一个包含 textarea 的父组 |
| 任务模板按钮 | `button` 内含 `span.anticon-file-text` | 不依赖会变化的模板名称；仅在用户展开脚本的规则区且未出现步骤区块时临时点击 |
| 标注步骤区块 | `section` 内某个 `div` 的 trim 后文本精确为“标注步骤”，且包含 `ol > li` | 只读取每个列表项的纯文本；不复制其他模板区块、HTML 或交互控件 |
| 核查区 | `section[data-asr-edge-pulse-translation-panel]` | 防止 React 重绘后的重复挂载 |

## 动态区域 / 重渲染风险

- React 切换片段或任务时可能替换时间线、中文翻译组及 textarea。
- 任务模板区块可在点击文件图标后由 React 动态插入；助手最多等待 2500ms，未找到“标注步骤”时只显示可重试的失败状态，并恢复自己打开的模板。
- 分段拖动会直接改变分段的内联 `left / width`；样式观察器只重新计算展示，不向页面写入切点。
- 内容观察器重新扫描锚点；已有 `data-asr-edge-pulse-translation-panel` 时不创建第二个面板。

## 可挂载点建议

- 计时条追加到 `TIMELINE` 标题的父容器，不移动平台原有节点。
- 核查区仅插入精确“中文翻译”组内原 textarea 之后；规则区位于核查区之后，默认折叠。展开时只读取当前任务的“标注步骤”，不写入原 textarea。
- 任何稳定锚点缺失时不挂载，显示待加载或不展示，不猜测其他 textarea。

## 页面区域与接口映射

| 页面区域 | 数据来源 | 助手动作 |
| --- | --- | --- |
| 时间线轨道与分段 | 已渲染 DOM 内联样式 | 仅读取并换算时间 |
| 帧率与总帧 | 已渲染页面文本 | 仅读取；缺失时安全降级 |
| 中文翻译 textarea | 页面本地输入值 | 仅读取生成镜像，监听输入以清除旧检查结果 |
| 禁用词镜像 | 扩展内置 JSON | 本地标红；不写回 textarea |

## 写操作边界 / 未确认项

- 不调用平台接口，不改写 `left / width`、textarea、保存状态或任务状态。
- 不点击保存、提交、审核、领取或下一条按钮，不监听或修改 Network 请求。
- 仅以当前已采样的 DOM 结构为依据；若平台改变标题、分段层级、帧信息格式或中文翻译标签，助手应显示待加载或停止挂载，等待重新采样确认。
