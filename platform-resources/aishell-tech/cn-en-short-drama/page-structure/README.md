# Aishell Tech 中英短剧脚本页面结构差异

## 页面标识 / 路由 / 前置条件

- 路由：`/mytask/mark?taskId=<taskId>&packageId=<packageId>`
- 平台：`https://mark.aishelltech.com/`
- 当前参考基于已登录且可访问目标任务分包的标注页。
- 当前页面识别关键点：
  - `.mark-container` 存在
  - `.floating-mark-area.is-docked` 存在
  - `.mark-form` 存在
  - 页面内存在双通道波形区与多评分项表单

## 页面总览

- 当前页仍属于 Aishell 共享 `/mytask/mark` 路由，但页面形态已不同于现有闽南语 / 越南语 / 泰语助手使用的单文本短标注模板。
- 当前更接近“左侧条目列表 + 中部多通道波形 + 右侧悬浮整段评分表单”的整段标注工作页。
- 当前页面已确认的原生动作包括：
  - `上一条`
  - `下一条`
  - `取消选中`
  - `查看历史标注记录`
  - `设置为无效`
  - `保存整段`
  - `完成标注`

## DOM 树 / 区域结构

```text
body
└─ #app
   └─ .mark-container
      ├─ .list
      │  ├─ 顶部返回与进度区
      │  ├─ 条目状态列表
      │  └─ 上一条 / 下一条
      ├─ 通道波形工作区
      │  ├─ .channel-toolbar
      │  ├─ .channel-label（通道 1 / 通道 2）
      │  └─ .channel-waveform
      └─ .floating-mark-area.is-docked
         └─ .floating-mark
            ├─ .form-toolbar
            └─ .form-scroll-area
               └─ .mark-form-content
                  └─ .mark-form
                     ├─ 6 个评分 textarea
                     └─ 保存整段
```

## 稳定选择器表

| 目标 | 建议选择器 | 说明 |
| --- | --- | --- |
| 页面根容器 | `.mark-container` | 当前页最外层稳定工作区 |
| 左侧条目列表 | `.list` | 负责进度、条目状态与切题 |
| 当前选中条目 | `.list-item-selected` | 当前焦点条目 |
| 已完成条目 | `.list-item-finshed` | 已完成状态类 |
| 无效条目 | `.list-item-invalid` | 无效状态类 |
| 通道工具条 | `.channel-toolbar` | 含折叠 / 展开 / 重置宽度等原生动作 |
| 通道标签 | `.channel-label` | 当前已采到 `通道 1`、`通道 2` |
| 波形区 | `.channel-waveform` | 每个通道各自波形与播放控制 |
| 悬浮表单根层 | `.floating-mark-area.is-docked` | 当前整段标注模板关键锚点 |
| 表单容器 | `.floating-mark` | 当前脚本表单主容器 |
| 表单内容区 | `.mark-form-content` | 表单主体包装层 |
| 表单根节点 | `.mark-form` | 6 个评分项所在表单 |
| 表单顶部工具区 | `.form-toolbar` | 含 `完成标注` |
| 表单滚动区 | `.form-scroll-area` | 评分项滚动区域 |
| 评分输入框 | `.mark-form textarea.el-textarea__inner` | 当前评分项都为 `textarea` |
| 评分标签 | `.mark-form .el-form-item__label` | 当前已采到 6 个固定评分项 |
| 历史标注按钮 | `button` 含 `查看历史标注记录` | 只作只读参考，不推断弹窗结构 |
| 无效按钮 | `button` 含 `设置为无效` | 视为原生写操作入口 |
| 保存按钮 | `button` 含 `保存整段` | 视为原生写操作入口 |
| 完成按钮 | `button` 含 `完成标注` | 视为原生写操作入口 |

## 动态区域 / 重渲染风险

- 左侧条目列表会随保存结果切换 `selected / finshed / invalid` 状态。
- 波形区包含下拉、倍速、缩放和播放器控制，属于高频重绘区。
- `.floating-mark-area` 当前带 `is-docked` 状态；后续真实页面可能存在吸附 / 取消吸附切换，不应把单一视觉状态当成唯一契约。
- 下拉浮层、tooltip 和历史记录弹层可能挂在工作区外层，不应依赖临时 popper 节点或 tooltip id。
- 当前页面未出现共享短标注模板里的 `.mark-area` 区块；后续实现时不能把两个模板混为一套 DOM 契约。

## 可挂载点建议

- 如后续需要挂辅助 UI，优先选择宿主页面外层安全区域，不覆盖 `保存整段`、`完成标注` 等原生写操作控件。
- 若必须贴近表单区域，优先考虑：
  - `.floating-mark` 内独立的说明区
  - `.channel-waveform` 组末尾的非写操作区域
- 不建议：
  - 覆盖左侧条目按钮
  - 覆盖波形原生播放控件
  - 直接侵入 `.mark-form` 的原生输入框和提交按钮区域

## 页面区域与接口映射

- 当前脚本仍共享 Aishell 平台 `/mytask/mark` 的公共初始化链路；已知平台级参考继续查看 `platform-resources/aishell-tech/network/04-mytask-mark.md`。
- 当前脚本专属资料只确认页面结构，不单独确认保存接口契约。
- `查看历史标注记录`、`设置为无效`、`保存整段`、`完成标注` 当前都视为需要后续独立补采的动作边界。

## 写操作边界 / 未确认项

- 当前所有原生写操作都必须保持人工触发，不预设自动保存、自动完成或自动设置无效。
- 当前未确认：
  - `保存整段` 的真实请求路径与 payload 结构
  - `完成标注` 是否附带额外校验或流转
  - 历史标注弹窗的结构与只读边界
  - 是否存在更多角色视图或更多于 2 个音频通道的模板变体
- 当前已确认的 6 个评分项只作为页面结构事实记录，不写入真实标注文本样例。
