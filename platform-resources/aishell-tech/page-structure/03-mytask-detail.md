# 03-任务详情 DOM 结构

## 页面标识 / 路由 / 前置条件

- 路由：`/mytask/detail/<taskId>`
- 主容器：`.taskDetail-container`
- 框架：Vue 2 + Element UI
- 入口：我的任务列表 → 点击任务名称

- 容器：`.el-page-header`
- 返回：`i.el-icon-back` + "返回"
- 标题：`.el-page-header__content` = "标注任务详情"

点击"查看" → `/mytask/mark?taskId=<taskId>&packageId=<packageId>`

## 页面总览

- 容器：`.el-page-header`
- 返回：`i.el-icon-back` + "返回"
- 标题：`.el-page-header__content` = "标注任务详情"

点击"查看" → `/mytask/mark?taskId=<taskId>&packageId=<packageId>`

## DOM 树 / 区域结构

- 当前文件未补充完整 DOM 树；后续仅记录稳定区域结构。

## 稳定选择器表

| 目标 | 选择器 |
|------|--------|
| 返回按钮 | `.el-page-header i.el-icon-back` |
| 基本信息行 | `.line.el-row` |
| 分包行 | `.el-table__body tr.el-table__row` |
| 查看按钮 | `button.el-button--text` 含"查看" |
| 进度文本 | `.el-progress__text` |
| 标注状态 | `.el-tag--light` |
| 总包数 | 含 `（N / M）` 的 `<span>` |

## 动态区域 / 重渲染风险

- 当前页存在状态切换和局部重绘风险；避免依赖瞬时 class 和顺序定位。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- 当前文件未补充更细的接口映射；新增时只记录稳定区域与请求族对应关系。

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。
