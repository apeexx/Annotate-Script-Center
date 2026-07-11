# 闽南语助手详情页结构

## 页面标识 / 路由 / 前置条件

本文档记录 `roundOneCollect` 详情页的脱敏 DOM 结论。资料来自人工复制的页面 HTML 结构，未记录真实 token、cookie、完整音频 URL 或客户数据。

详情页路径：

```text
https://datafactory.data-baker.com/v2/#/quality/roundOneCollect?collectId=...&checkType=0
```

`collectId` 和 `checkType` 从 `location.hash` 中的查询参数读取：

```js
const hash = location.hash;
const query = hash.slice(hash.indexOf("?") + 1);
const params = new URLSearchParams(query);
```

“本句话文本”区域：

```text
.waver-page .text-box
  span: 本句话文本
  .el-textarea
    textarea.el-textarea__inner
```

当前可编辑文本框选择器：

```css
.waver-page .text-box textarea.el-textarea__inner
```

已确认 DOM 中该 textarea 没有 `disabled` 或 `readonly` 属性。运行时仍会在点击“填入推荐文本”前检查：

- 元素存在。
- 不是 `disabled`。
- 不是 `readOnly`。

写入方式：

1. 由用户点击“填入推荐文本”触发。
- 其余重复细节已省略；如需补充，只保留当前有效结论。

## 页面总览

“本句话文本”区域：

```text
.waver-page .text-box
  span: 本句话文本
  .el-textarea
    textarea.el-textarea__inner
```

当前可编辑文本框选择器：

```css
.waver-page .text-box textarea.el-textarea__inner
```

已确认 DOM 中该 textarea 没有 `disabled` 或 `readonly` 属性。运行时仍会在点击“填入推荐文本”前检查：

- 元素存在。
- 不是 `disabled`。
- 不是 `readOnly`。

写入方式：

1. 由用户点击“填入推荐文本”触发。
2. 设置 textarea `value`。
3. 派发 `input` 和 `change` 事件。

扩展不会自动保存、自动提交或自动点击合格 / 不合格。

## DOM 树 / 区域结构

- 当前文件未补充完整 DOM 树；后续仅记录稳定区域结构。

## 稳定选择器表

- 优先使用 route、标题文案、稳定输入框和原生按钮文本，不依赖 hash class。

## 动态区域 / 重渲染风险

- 当前页存在状态切换和局部重绘风险；避免依赖瞬时 class 和顺序定位。

## 可挂载点建议

- 如需挂载扩展 UI，优先选择宿主页面外层安全区域，不覆盖原生写操作控件。

## 页面区域与接口映射

- 当前文件未补充更细的接口映射；新增时只记录稳定区域与请求族对应关系。

## 写操作边界 / 未确认项

- 写操作默认维持人工确认边界；未确认链路不得按文案直接推断。
