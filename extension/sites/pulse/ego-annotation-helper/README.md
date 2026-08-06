# Pulse 分段标注助手运行时

## 适用范围

- 脚本 ID：`pulseEgoAnnotationHelper`；默认关闭，需在脚本中心手动启用。
- 仅匹配 `https://pulse.xdof.cn/annotation/my/corrector/ego-annotation-gui/*`。
- 不注册后端路由、不调用 Pulse API，也不读取或写入平台保存、提交、审核接口。

## 当前能力

- 在 `TIMELINE` 标题行右侧只显示当前选中分段的长度，例如“分段长度 4.7s”。以轨道直接子分段的 `left / width`、页面 `f 当前帧 / 总帧数` 与 `fps` 文本换算秒数；任一数据缺失时显示“时间信息待加载”，不猜测结果。
- 指针按下分段框的左、右边界或其相邻拖拽柄后记住当前几何与时长；每次 `pointermove` 都按切点位移预览“分段长度 Ns · 变化 ±Ns”，不依赖 Pulse 先写回 `left / width`。分段框中间和普通进度条不触发预览；指针松开后再以页面最终 DOM 值显示。
- 通过精确“中文翻译”标签定位其父组，在原 textarea 下方追加只读核查区和默认折叠的“标注规则”。展开规则区时，助手只读取当前任务模板中标题精确为“标注步骤”的列表；模板原本关闭时会临时打开、读取后恢复关闭，原本已打开时不改变。切换任务后清空旧规则，等待下次展开再读取；原 textarea 不被改写。
- 点击“检查禁用词”后，优先读取当前浏览器本地导入的词表，不存在时回退扩展内置 JSON；按字面子串、区分大小写、最长词优先核查，命中内容在只读镜像条中标红。文本变化后清除旧结果并提示重新检查。

## 词表与重绘

- 在脚本中心的 Pulse 脚本详情页可拖入或选择普通 `.xlsx` 文件，预览后点击“确认替换当前词表”才保存。解析第一个工作表的首个有内容列，按 `,`、`，`、`、` 拆分、去引号并保序去重；仅保存词项、文件名和导入时间，不保存原 Excel 文件。
- 自定义词表只保存在当前 Chrome/Edge 扩展配置中，不上传、不同步其他电脑；“恢复内置默认词表”会删除自定义词表并回退 `data/forbidden-terms.json` 的 84 个词。
- `chrome.storage` 中词表变化后，已打开的 Pulse 页面会清除旧核查状态并提示重新检查；`MutationObserver` 用于处理 React 重绘、片段切换和分段样式变化，重复挂载会复用已有面板，停用、离开目标路由或卸载时会删除本助手 UI 和观察器。

## 验证

- `node --test extension/sites/pulse/ego-annotation-helper/*.test.js`
- `node --check extension/sites/pulse/ego-annotation-helper/forbidden-terms.js`
- `node --check extension/sites/pulse/ego-annotation-helper/forbidden-terms-xlsx.js`
- `node --check extension/sites/pulse/ego-annotation-helper/forbidden-terms-import.js`
- `node --check extension/sites/pulse/ego-annotation-helper/timeline-timer.js`
- `node --check extension/sites/pulse/ego-annotation-helper/ui-panel.js`
- `node --check extension/sites/pulse/ego-annotation-helper/content.js`

真实登录页面仍需在 Chrome 中手动启用脚本后验收：拖动分段、禁用词标红、关闭脚本后 UI 消失，并确认没有触发平台保存、审核、提交或外部请求。
