# 资源文件请求

## 请求标识 / 目的

记录 Task21 页面资源加载类型，不记录完整资源 URL。

## 页面入口 / 触发动作

- 打开 Data 页。
- 打开 `/items` 查看页或标注页。
- 切换到内审 `/items` 页。

页面加载静态 assets、图片查看器资源、captcha 资源和 Task21 业务图片。

资源区显示：

- `image_a`
- `image_b`
- `image_b_removed`
- 图片查看器按钮：Zoom In、Zoom Out、One to One、Reset、Previous、Play、Next、Rotate Left、Rotate Right、Flip Horizontal、Flip Vertical、Enter Full Screen。

## 请求摘要

- Method：`GET`
- URL 类型：
  - `/assets/{name}-{hash}.svg`
  - `/assets/{name}-{hash}.png`
  - `https://<OBJECT_STORAGE_HOST>/<masked>/images/{masked}.webp`
  - `https://<CAPTCHA_HOST>/<masked>.jpg`
  - `data:image/{ext};base64,<masked>`
- Status：`200` 或 `304`
- Query keys：资源 URL 不记录完整 query。

## 请求体摘要

GET 资源请求无业务请求体。

## 响应摘要

{
      "resourceType": "image | static-asset | captcha | data-url",
      "method": "GET",
      "pathnamePattern": "/assets/{name}-{hash}.{ext}",
      "extension": ".svg | .png | .webp | .jpg",
      "masked": true,
      "status": "number"
    }

## 关键字段

- `.webp` 为 Task21 图片主资源。
- `/assets/*` 为前端静态图标。
- captcha 图片与登录/安全策略有关，不属于 Task21 业务数据。

## 前端接入建议

只记录资源类型、扩展名和 masked pathname 模式；禁止保存完整对象存储 URL、完整 query、base64 内容或图片文件。

## 风险 / 未确认项

- 音频或其他文件类型在 Task21 中未观察到，待补。
