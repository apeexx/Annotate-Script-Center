# Pulse 平台资料

## 平台定位

- 平台标识：`pulse`。
- 当前覆盖页面：`https://pulse.xdof.cn/annotation/my/corrector/ego-annotation-gui/*`。
- 当前只覆盖 `ego-annotation-gui` 的本地分段时间显示、中文翻译规则展示和禁用词只读核查。

## 目录入口

- `ego-annotation-helper/README.md`：功能边界、词表和验收说明。
- `ego-annotation-helper/page-structure/ego-annotation-gui.md`：目标页面的稳定 DOM 与挂载点参考。
- `ego-annotation-helper/reference/`：用户提供的禁用词 Excel 参考源和导入说明。

## 当前边界

- 扩展只读取 DOM、当前浏览器本地导入的词表和内置 JSON 回退词表；不向 Pulse 或其他外部地址请求词表，也不上传用户选择的 Excel。
- 不拦截页面 Network，不调用平台读写接口，不触发保存、提交、审核、领取或任务切换。
- 本平台未接入后端；时间基准只取页面可见的总帧数和帧率。
