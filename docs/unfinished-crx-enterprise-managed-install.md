# 未完成模块：CRX 企业托管自动安装

## 当前状态

`annotation-script-center` 已完成 CRX 发布三件套能力：

- `annotation-script-center-v<version>.crx`
- `annotation-script-center-update.xml`
- `annotation-script-center-crx-latest.json`

当前脚本已同步生成每版本 ZIP：

- `annotation-script-center-v<version>.zip`

`ops_monitor` 侧已具备写入 Chrome / Edge `ExtensionSettings` 策略的能力。

当前阻塞点不是策略写入代码失败，而是测试环境中的普通 Windows 电脑不属于企业托管设备，浏览器会拦截自托管 CRX 的 `force_installed` 自动安装。

## 当前观察到的现象

- 在 `chrome://policy` 或 `edge://policy` 中出现 `ExtensionSettings` 警告。
- 扩展条目显示 `[BLOCKED]extension_id`。
- 浏览器提示当前计算机不是企业管理设备，拒绝按企业托管策略安装该自托管扩展。

## 结论

该问题属于网络与终端企业管理工程，不是单纯脚本代码任务。  
本模块暂时挂起，不阻塞 `0.3.0` 发布。

企业部署完成前，临时采用手工双文件分发：

1. `annotation-script-center-v<version>.crx`
2. `annotation-script-center-v<version>.zip`

`update.xml` 与 `crx-latest.json` 继续保留为企业自动更新预留。  
后续企业托管路径打通后，仍以 CRX 三件套作为正式自动更新基础，ZIP 仅为过渡分发产物。

## 后续路线 A（企业托管路径）

1. 搭建企业管理环境（例如 AD 域控 / Entra ID / Intune / 其他 MDM）。
2. 员工电脑加入企业管理体系。
3. 通过 GPO 或 `ops_monitor` 写入 `ExtensionSettings`。
4. 浏览器通过 `update.xml` 自动安装并更新 CRX。

## 当前用户环境信息（已确认）

- 各基地在同一局域网。
- `ops_monitor` 依赖局域网运行。
- 基地服务器一般为 Windows 11 专业工作站版本。
- Windows 11 专业工作站适合远程控制和业务服务，但不作为 AD DS 域控。
- 若后续推进 AD 域控，建议准备 Windows Server 2022/2025 或其他企业管理方案。

## DNS 规划说明

- 不建议逐台电脑手动配置 DNS。
- 后续优先在 DHCP 服务器 / 路由器 / 三层交换机统一下发域控 DNS。
- 普通二层交换机不能下发 DNS。

## 恢复推进时测试 Checklist

1. 服务器 CRX 三件套可访问：
   - `annotation-script-center-v<version>.crx`
   - `annotation-script-center-update.xml`
   - `annotation-script-center-crx-latest.json`
2. `reg query` 可查到目标 `ExtensionSettings` 注册表项。
3. `chrome://policy` / `edge://policy` 中策略状态不再是警告。
4. `chrome://extensions` / `edge://extensions` 自动出现扩展。
5. 版本升级回归：验证 `0.3.0 -> 0.3.1` 自动更新链路。
6. `extension_id` 保持不变（确认仍使用同一 `.pem` 打包）。
