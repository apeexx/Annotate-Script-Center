# docs 导航

`docs/` 只保留少量需要长期查阅的扁平化文档，不再继续扩展子目录。

## 当前保留文件

- [`docs/platforms-index.md`](platforms-index.md)
  - 平台与脚本入口索引
  - 处理具体平台前先看这里
- [`docs/external-docs-aliyun-bailian.md`](external-docs-aliyun-bailian.md)
  - 阿里云百炼官方文档入口
  - 涉及模型、参数、thinking、结构化输出、Qwen-Omni、Web Search 时先看这里
- [`docs/unfinished-crx-enterprise-managed-install.md`](unfinished-crx-enterprise-managed-install.md)
  - CRX 企业托管自动安装的当前阻塞、结论和后续路线

## 使用顺序

1. 先读 [`AGENTS.md`](../AGENTS.md)
2. 处理具体平台时再读 [`docs/platforms-index.md`](platforms-index.md)
3. 涉及百炼能力时再读 [`docs/external-docs-aliyun-bailian.md`](external-docs-aliyun-bailian.md)
4. 遇到企业托管自动安装问题时再读 [`docs/unfinished-crx-enterprise-managed-install.md`](unfinished-crx-enterprise-managed-install.md)
5. 历史过程统一查看 [`log.md`](../log.md)

## 当前原则

- 项目级规则统一写在 `AGENTS.md`
- 项目首页导航统一写在根 `README.md`
- 平台细则继续写在各平台 / 脚本 README
- 历史流水不再写回 `docs/`，统一收口到 `log.md`
