# 02-我的任务列表 DOM 结构

## 页面标识 / 路由 / 前置条件

- 路由：`/mytask/index`
- 主容器：`.taskList-container`
- 框架：Vue 2 + Element UI（el-table + el-form + el-pagination）

## 页面总览

- 当前页主要记录稳定区域、可见文案和角色边界。

## DOM 树 / 区域结构

- 当前文件未补充完整 DOM 树；后续仅记录稳定区域结构。

## 稳定选择器表

| 目标 | 选择器 |
|------|--------|
| 所有行 | `tr.el-table__row` |
| 任务名称链接 | `a.el-link--primary.is-underline` |
| 任务名称文本 | `a.el-link--primary .el-link--inner` |
| 任务进度 | `.el-progress__text` |
| 任务状态标签 | `.el-tag--light` |

| 目标 | 选择器 |
|------|--------|
| 总条数 | `.el-pagination__total` |
| 当前页 | `li.number.active` |
| 每页条数下拉 | `.el-pagination__sizes .el-select` |
| 跳转输入 | `.el-pagination__editor input` |

## 动态区域 / 重渲染风险

- 当前页存在状态切换和局部重绘风险；避免依赖瞬时 class 和顺序定位。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- 当前文件未补充更细的接口映射；新增时只记录稳定区域与请求族对应关系。

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。
