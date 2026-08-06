# Pulse 分段标注助手运行时

## 适用范围

- 脚本 ID：`pulseEgoAnnotationHelper`；默认关闭，需在脚本中心手动启用。
- 仅匹配 `https://pulse.xdof.cn/annotation/my/corrector/ego-annotation-gui/*`。
- 不注册后端路由、不调用 Pulse API，也不读取或写入平台保存、提交、审核接口。

## 当前能力

- 在 `TIMELINE` 标题行右侧显示当前选中分段的起点、终点和时长。以轨道直接子分段的 `left / width`、页面 `f 当前帧 / 总帧数` 与 `fps` 文本换算时间码；任一数据缺失时显示“时间信息待加载”，不猜测结果。
- 指针按下分段后记住当前时长；拖动时实时显示 `变化 ±时间码`，指针松开后只保留最终时间。
- 通过精确“中文翻译”标签定位其父组，在原 textarea 下方追加只读核查区和默认折叠的“标注规则”。原 textarea 不被改写。
- 点击“检查禁用词”后，从扩展内置 JSON 读取词表，按字面子串、区分大小写、最长词优先核查；命中内容在只读镜像条中标红。文本变化后清除旧结果并提示重新检查。

## 词表与重绘

- 运行时只读取 `data/forbidden-terms.json`；该文件包含从平台资料参考 Excel 一次性导入的 84 个去重词。
- `MutationObserver` 用于处理 React 重绘、片段切换和分段样式变化；重复挂载会复用已有面板，停用、离开目标路由或卸载时会删除本助手 UI 和观察器。

## 验证

- `node --test extension/sites/pulse/ego-annotation-helper/*.test.js`
- `node --check extension/sites/pulse/ego-annotation-helper/forbidden-terms.js`
- `node --check extension/sites/pulse/ego-annotation-helper/timeline-timer.js`
- `node --check extension/sites/pulse/ego-annotation-helper/ui-panel.js`
- `node --check extension/sites/pulse/ego-annotation-helper/content.js`

真实登录页面仍需在 Chrome 中手动启用脚本后验收：拖动分段、禁用词标红、关闭脚本后 UI 消失，并确认没有触发平台保存、审核、提交或外部请求。
