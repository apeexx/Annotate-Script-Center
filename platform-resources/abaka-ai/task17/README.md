# Abaka AI Task17 项目资料

## 当前状态

Task17 当前作为 Abaka AI Task 页面公共结构对比项目。已确认 Task17 与 Task21 复用 Data 页、状态 Tab、`/items` 工作页初始化、资源加载、领取审核接口等公共能力。

## 资料文件

| 文件 | 职责 |
| --- | --- |
| `README.md` | Task17 项目入口。 |
| `network/README.md` | Task17 已确认网络差异和领取审核空池响应。 |
| `page-structure/README.md` | Task17 页面结构差异。 |

公共资料入口：

- 平台公共网络：`../network/platform.md`
- Task 页面公共网络：`../network/README.md`
- Task 页面公共结构：`../page-structure/platform.md`
- Task 页面公共动作边界：`../page-structure/actions.md`
- Task 页面公共多语言：`../page-structure/i18n.md`

## 边界

- Task17 默认只查看和对比。
- 本轮仅按用户授权测试 `领取审核` 空池失败响应。
- 不点击提交、通过、驳回、送审、放弃、跳过等会完成内审流转或改变真实审核结论的动作。

