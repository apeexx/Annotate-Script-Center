# 01-首页 DOM 结构

## 页面标识 / 路由 / 前置条件

- 路由：`/index`
- 主容器：`#app` → `.v-main.main-padding` → `.v-app-main` → `section` → `#data-view` → `#a-container`
- 框架：Vue 2 + Element UI（el-row/el-col 栅格 + el-card 卡片 + el-table 表格）+ x-vue-echarts（图表）

---

```
.v-main.main-padding
└─ .v-app-main
   └─ section
      └─ #data-view
         └─ #a-container
            ├─ [Row 1] el-row (el-col-12 + el-col-12, height:220px)
            │   ├─ 左侧：完成概况卡片（3 列数字统计）
            │   └─ 右侧：嵌套 el-row
            │       ├─ 近七日完成数量（ECharts 柱状图）
            │       └─ 近七日合格率（ECharts 图表）
            ├─ [Row 2] el-row (el-col-12 + el-col-12)
            │   ├─ 近30天数据统计（ECharts 折线图）
            │   └─ 团队成员榜（ECharts 横向柱状图）
            ├─ [Row 3] el-row (el-col-24)
            │   └─ 我进行中任务（el-table 表格，8 列）
            └─ [隐藏] el-loading-mask
```

---

## 页面总览

```
.v-main.main-padding
└─ .v-app-main
   └─ section
      └─ #data-view
         └─ #a-container
            ├─ [Row 1] el-row (el-col-12 + el-col-12, height:220px)
            │   ├─ 左侧：完成概况卡片（3 列数字统计）
            │   └─ 右侧：嵌套 el-row
            │       ├─ 近七日完成数量（ECharts 柱状图）
            │       └─ 近七日合格率（ECharts 图表）
            ├─ [Row 2] el-row (el-col-12 + el-col-12)
            │   ├─ 近30天数据统计（ECharts 折线图）
            │   └─ 团队成员榜（ECharts 横向柱状图）
            ├─ [Row 3] el-row (el-col-24)
            │   └─ 我进行中任务（el-table 表格，8 列）
            └─ [隐藏] el-loading-mask
```

---

## DOM 树 / 区域结构

- 当前文件未补充完整 DOM 树；后续仅记录稳定区域结构。

## 稳定选择器表

| 目标 | 选择器 |
|------|--------|
| 表格容器 | `.el-card[data-v-3b18574d] .el-table` |
| 所有行 | `.el-table .el-table__row` |
| 任务名称链接 | `.el-table__row a.el-link--primary` |
| 状态标签 | `.el-table__row .el-tag--light` |

## 动态区域 / 重渲染风险

- 当前页存在状态切换和局部重绘风险；避免依赖瞬时 class 和顺序定位。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- **图表数据源**：来自 `/api/Statistics/GetIndexStatistics` 响应（`latest30days` 和 `users` 字段）

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。
