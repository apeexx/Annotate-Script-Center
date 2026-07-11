# DataBaker Upload Payload

`POST /api/data-baker/round-one-quality/export/upload` 当前统一接收以下字段：

- `schemaVersion`
- `source`
- `project`
- `exportedAt`
- `fileName`
- `csvText`
- `rawRecords`
- `rawJson`
- `rowCount`
- `taskId`
- `route`
- `summary`

归一规则：

- `rawRecords` 为主字段，`rawJson` 作为 legacy alias 继续兼容。
- `route` 与 `summary` 统一要求对象；非对象会回落为空对象。
- `taskId` 统一转成字符串，`rowCount` 与 `schemaVersion` 统一转成数字。
- `csvText` 为空时直接拒绝；`rawRecords/rawJson` 超过大小限制时直接拒绝。

当前 `summary` 推荐至少保留：

- `projectName`
- `taskName`
- `teamName`
- `collectCount`

当前 `route` 推荐至少保留：

- `hash`
- `pathname`
