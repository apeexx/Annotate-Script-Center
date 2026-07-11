# Magic Data 平台资料

Magic Data 当前保留客家话助手与闽南语助手。两个脚本使用各自独立运行时、资料目录和后端接口，并在脚本中心保持互斥启用。

## 当前目录

- `hakka-helper/`：客家话助手资料与后端。
- `minnan-helper/`：闽南语助手资料与后端。
- `backend/`：平台共享后端能力。
- `network/`：当前有效 Network 参考。
- `page-structure/`：当前有效页面结构参考。

## 运行时入口

- 扩展运行时代码：`extension/sites/magic-data/`
- 共享 AI 客户端：`extension/sites/magic-data/shared/`