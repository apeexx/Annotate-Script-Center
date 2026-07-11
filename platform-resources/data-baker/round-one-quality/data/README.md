# DataBaker Data 目录

`platform-resources/data-baker/round-one-quality/data/` 是脚本级数据逻辑目录。

当前阶段先固定边界，不直接迁移现有导出运行目录：

- `data/adapter.js` 负责 DataBaker 脚本级下载 adapter：
  - 统一定义 `data-baker-round-one-export` 数据集元数据
  - 统一定义共享下载轨道使用的默认文件名
  - 统一定义当前 `export/download` 兼容路径继续返回的 `latest.csv` 目标
- `data/field-mappings.js` 负责 DataBaker 导出字段口径：
  - 统一定义 canonical CSV 列
  - 统一定义旧表头兼容 alias
  - 统一定义 `文本编号 / 文件名 / 段编号 / 采集人 / 手机号` 的唯一键优先级
- `data/scripts/download.js` 负责 DataBaker 下载脚本 helper：
  - 把 `latest.csv` 转成共享下载 core 可直接消费的 target
- `data/scripts/upload.js` 负责 DataBaker 上传字段归一 helper：
  - 统一 `export/upload` 的 payload 字段校验与 legacy alias 兼容
- `data/scripts/csv.js` 负责 DataBaker CSV helper：
  - 统一 legacy 表头归一
  - 统一 CSV 解析、行数统计和写出
- `data/scripts/merge.js` 负责 DataBaker merge helper：
  - 统一 CSV 唯一键计算
  - 统一 CSV merge 统计
  - 统一 rawRecords merge
- `data/scripts/persist.js` 负责 DataBaker latest/history/events 持久化 helper：
  - 统一 latest.csv / latest-raw.json / latest.json 写入
  - 统一 history CSV / raw.json 写入
  - 统一 upload event JSONL 追加
  - 统一 latest meta 与 upload event payload 组装
- `data/scripts/fetch.js` 负责 DataBaker 导出读取 helper：
  - 统一读取 latest 快照存在性
  - 统一读取 `latest.json`
  - 统一列出 history 下可下载的 CSV 文件，并补充对应 `*.raw.json` 信息
  - 统一读取 `upload-events.jsonl`
- `data/assets/` 当前已落：
  - `mappings/export-columns.md`
  - `mappings/upload-payload.md`
  - `samples/latest-sample.csv`
  - `samples/latest-raw-sample.json`
  - `samples/upload-payload-sample.json`
  - `samples/latest-meta-sample.json`
  - `samples/upload-events-sample.jsonl`
- `data/runtime/.gitkeep` 作为运行时占位目录，真实运行数据仍不提交 Git。
- 上传统计与导出聚合逻辑仍由 `backend/export-routes.js`、`backend/export-store.js` 负责。
- `backend/export-store.js` 当前继续负责旧 latest 读取和总体编排；CSV 解析/写出、merge、latest/history/events 持久化都已开始下沉到 `data/scripts/*.js`。
- `GET/HEAD /api/data-baker/round-one-quality/export/download` 现在内部已接到 `platform-resources/backend/project-data-download/` 的共享下载 core，但外部 API path 不变。
- 真实运行数据仍在被忽略的 `backend/export-data/` 下。

后续会逐步把下面几类内容收口到这里：

- 更多下载脚本
- 更完整的 upload / history 读取脚本
- 更完整的 merge / write 分层
- 更清晰的 data adapter / script helper 边界
- 更完整的数据字段映射
- 更多脱敏样例
- runtime 目录说明与边界
