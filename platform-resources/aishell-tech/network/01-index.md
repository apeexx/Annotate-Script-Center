# 01-首页 网络请求

## 请求标识 / 目的

- 页面路由：`/index`
- 前端框架：Vue 2 + Element UI
- 访问方式：登录后默认跳转
- 鉴权格式：`Authorization: Bearer <JWT>`

首页加载时共发起 **3 个 XHR 请求**：

| 序号 | 方法 | URL | 说明 |
|------|------|-----|------|
| 1 | POST | `/api/account/info` | 当前用户信息与角色（同其他页） |
| 2 | **GET** | `/api/Statistics/GetIndexStatistics` | **首页专属** 统计总览 |
| 3 | GET | `/api/task/myMarkList?page=1&size=15` | 我的任务列表第一页（同任务列表页） |
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 页面入口 / 触发动作

- 当前文件未补充额外入口说明；默认按对应页面自然加载或用户显式操作触发。

## 请求摘要

- 当前文件未补充更细的请求摘要。

## 请求体摘要

- 当前记录未见独立 request body；以路径参数或 query 为主。

## 响应摘要

```json
{
  "data": {
    "result": {
      "total": [                        // 汇总统计（数组，仅 1 项）
        {
          "packagecount": "1",          // 分包总数
          "finishedpackagecount": "0",  // 已完成分包数
          "taskcount": "1",             // 任务总数
          "projectcount": "1",          // 项目总数
          "unfinisheditemcount": "0",   // 未完成条目数
          "workingitemcount": "0",      // 进行中条目数
          "finisheditemcount": "1"      // 已完成条目数
        }
      ],
      "latest30days": [                // 近 30 天每日标注量
        {
          "mdate": "2026-05-27",       // 日期
          "count": "1",                // 标注量
          "cdate": null,
          "passcount": null,           // 通过量
          "failcount": null            // 未通过量
        }
      ],
      "users": [                       // 标注员排行榜
        {
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 关键字段

- `total`：用户维度的全局聚合统计，部分字段使用字符串类型
- `latest30days`：按日期分组的近 30 天标注量趋势，`passcount`/`failcount` 当前为 null
- `users`：包含标注员和采集员的排行榜。标注员 `MarkUserName` 非空、`collectcount=0`；采集员 `markcount=0`、`collectcount` 非零；质检员单独一行，`MarkUserName` 为 null，`CheckUserName` 非空
- `citys`：当前为空数组，可能为按城市维度统计预留

---

## 前端接入建议

- 接入时优先复用当前页已有稳定锚点，只做只读监听或最小范围辅助。

## 风险 / 未确认项

- 文档只保留当前有效结论；新增缺口统一回写稳定参考页或 `log.md`。
