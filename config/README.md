# 配置说明

`config/` 存放可提交的非敏感配置模板和运行环境示例。私钥、真实口令、token、cookie、完整签名 URL 和未脱敏客户数据不得写入仓库。

## 目录职责

- `config/package-crx-release.json`：public CRX 打包配置。
- `config/aliyun-bailian-model-pricing.json`：模型价格配置。
- `config/env/`：运行时环境变量示例和本地环境文件位置。
- `config/secrets/`：本地私有配置目录，默认不提交真实内容。

## CRX 打包配置

当前发布脚本只支持 public 通道。默认配置示例：

```json
{
  "channel": "public",
  "downloadBaseUrl": "https://script.xiangtianzhen.store/downloads/"
}
```

执行打包：

```powershell
node scripts/package-crx-release.js
```

默认产物：

- `dist/annotation-script-center-v<version>.crx`
- `dist/annotation-script-center-v<version>.zip`
- `dist/annotation-script-center-update.xml`
- `dist/annotation-script-center-crx-latest.json`

## 后端环境

本地可从示例文件复制环境变量：

```powershell
Copy-Item config\env\backend.env.example config\env\backend.env
```

环境文件中不得提交真实密钥或生产口令。