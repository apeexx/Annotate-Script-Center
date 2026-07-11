# 01-整段标注模板专项网络

## 请求标识 / 目的

- 页面路由：`/mytask/mark?taskId=<taskId>&packageId=<packageId>`
- 适用脚本：`cn-en-short-drama`
- 目标模板：Aishell `/mytask/mark` 下的“整段标注 + 多维评分”变体
- 本页只记录脚本专属请求差异；平台共用初始化仍参考 `../../network/04-mytask-mark.md`

## 页面入口 / 触发动作

| 序号 | URL | 方法 | 触发动作 |
| --- | --- | --- | --- |
| 1 | `/api/mark/getLongWholeMark/<taskItemId>` | GET | 当前条初始化 / 完成标注切到下一条后回填整段表单 |
| 2 | `/api/mark/saveLongWholeMark` | POST | 点击 `保存整段` |
| 3 | `/api/mark/finishLongMark/<taskItemId>?duration=<duration>&scene=<scene>` | POST | 点击 `完成标注` |
| 4 | `/api/mark/setEffective/<taskItemId>` | POST | 点击 `设置为有效` |
| 5 | `/api/mark/setInvalid/<taskItemId>` | POST | 点击 `设置为无效` 后在确认框点击 `确定` |
| 6 | `/api/mark/GetMarkHistoryList/<taskItemId>` | GET | 点击 `查看历史标注记录` 后加载历史列表 |

## 请求摘要

- 当前模板的整段表单由 6 个必填评分 `textarea` 组成；页面将整段对象整体序列化，不走共享短标注模板的单字段 `text` 保存。
- `保存整段` 与 `完成标注` 分离：
  - `保存整段` 只写当前整段表单
  - `完成标注` 单独调用完成接口，并在成功后刷新列表、定位下一条
- `设置为无效` 不是直接写操作，先弹出确认框 `是否设置为无效音频?`，确认后才调用写接口。
- `查看历史标注记录` 会先拉起弹窗；当前 live 页面测试时同时观察到 `GetMarkHistoryList` 相关异常日志，需要把异常边界单独记住。
- 当前进一步直采时，历史弹窗表格头部正常渲染，内容区显示 `暂无数据`。

## 请求体摘要

- `POST /api/mark/saveLongWholeMark`
  - 请求体结构：
    - `taskItemId`
    - `mark`
  - `mark` 来自 `JSON.stringify(this.whole)`，对应整段表单对象；提交前页面会补写 `this.whole.taskItemId = this.taskItem.id`
- `POST /api/mark/finishLongMark/<taskItemId>?duration=<duration>&scene=<scene>`
  - 当前未见独立 JSON body
  - `duration` 来自播放器时长
  - `scene` 来自当前页面场景
- `POST /api/mark/setEffective/<taskItemId>`
  - 当前未见独立 JSON body
- `POST /api/mark/setInvalid/<taskItemId>`
  - 当前未见独立 JSON body
  - 只在确认框点击 `确定` 后真正发送
- `GET /api/mark/getLongWholeMark/<taskItemId>`
  - 仅路径参数
- `GET /api/mark/GetMarkHistoryList/<taskItemId>`
  - 仅路径参数

## 响应摘要

- `saveLongWholeMark`
  - 成功时页面 toast：`保存成功!`
  - 失败时页面 toast：`保存失败，请重试`
- `finishLongMark`
  - 成功时页面 toast：`保存成功!`
  - 成功后页面继续执行：
    - `getMarkTaskItem()`
    - `itemList.refresh()`
    - `getNext()`
    - `init(nextTaskItem)`
  - 当前 live 按钮测试已观察到 `taskItem` 从一条切到下一条
- `setEffective`
  - 成功时页面把本地 `effective` 切回 `true`
  - 当前 live 按钮测试已观察到按钮文案从 `设置为有效` 切回 `设置为无效`
- `setInvalid`
  - 成功时页面把本地 `effective` 切为 `false`
  - 当前 live 测试只验证到确认弹层，未继续确认写入
- `GetMarkHistoryList`
  - 当前 bundle 逻辑会把 `result` 赋给历史列表数据源
  - 当前 live 直采时弹窗正文显示：`标注人 / 是否有效 / 标注内容 / 标注时间`
  - 当前 live 直采时表格内容显示：`暂无数据`
  - 当前 live 按钮测试同时观察到运行时异常：`/api/mark/GetMarkHistoryList/ 后端接口 undefined 异常：undefined`

## 关键字段

- `taskItemId`
  - 当前整段读取、保存、完成、有效性切换、历史读取的共同锚点
- `mark`
  - 整段保存时的 JSON 字符串；不是共享短标注模板里的单文本值
- `duration`
  - 完成标注时附带的播放器时长
- `scene`
  - 完成标注时附带的页面场景参数
- `effective`
  - 页面本地状态位；决定按钮显示为 `设置为有效` 还是 `设置为无效`

## 前端接入建议

- 当前模板的写操作仍应优先复用页面真实按钮，不预设直接调用保存 / 完成接口。
- 如果后续要接入辅助面板，整段保存应围绕整段对象序列化做最小侵入，不要按共享 `{"text":"..."}` 契约误写。
- `完成标注` 会触发切条；任何自动化前都要把“当前条完成”和“切到下一条”的连带行为视为同一写操作。
- `设置为无效` / `设置为有效` 应保持人工确认边界，尤其 `设置为无效` 需要保留二次确认。
- `查看历史标注记录` 当前更适合作为只读辅助入口；正式依赖前需先补一次异常复核。

## 风险 / 未确认项

- 当前接口路径与参数结构来自 live 页面按钮测试和前端 bundle 静态分析交叉核验，仍未补完整 HAR。
- `GetMarkHistoryList` 当前 live 页面测试已出现异常日志，需后续确认是页面局部状态问题、接口缺参还是当前账号 / 任务数据边界。
- 当前运行时日志里出现的是 `/api/mark/GetMarkHistoryList/` 空路径尾巴，表现上更像请求参数未带上 `taskItemId`，但仍需后续补原始 headers/body 才能最终定性。
- 本页只沉淀脚本专属整段模板差异；平台共用初始化、列表和模板读取不要重复抄回本页。
- 不记录真实 `taskId`、`packageId`、token、cookie、完整资源 URL 或真实评分内容。
