# Haitian uTrans 平台资料

## 平台定位

- 平台标识：`haitian-utrans`
- 当前入口形态：`http://<host>:<port>/index.php?...`
- 当前脚本资料：
  - `audio-download-helper`

## 目录入口

- `audio-download-helper/README.md`
  - 当前最小 MVP 的目标页、接口规律和接入边界
  - 当前扩展设置入口只有一个开关：是否显示悬浮下载窗

## 当前边界

- 当前资料只覆盖任务详情页音频下载这个最小 MVP
- 不扩展到批量任务、自动提交流程或后端改造
- 不记录完整登录态、完整签名资源地址或敏感请求头
