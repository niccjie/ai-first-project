# niccjie AI Creator Studio · Version 0.3

AI Powered Prototype：从一个故事想法生成短剧、漫画或小说创作方案。保留米白、黑色和橙色卡片界面。

## 当前运行方式

默认 **Demo 模式**，可在 GitHub Pages 或直接打开 `index.html` 使用。无需后端、依赖或 API Key。Demo 使用本地示例模板，约 1.8 秒后生成结果，随机切换人物与标题；它不具备语义理解能力，不承诺每次重试都有不同内容。

**真实 AI 模式已实现前端请求与后端参考代码，但需要自行配置并运行服务。** 当前没有配置远程 API 地址，也没有进行真实付费模型调用。AI 模式失败时明确显示错误，不会偷偷退回模拟内容。

## 功能

- 三种类型、500 字限制、示例灵感、清空输入、重新生成、复制结果。
- 固定六字段 JSON：标题、故事简介（介绍与背景）、人物设定、三幕大纲、首集脚本和英文绘图提示词。
- 短剧输出场景对白，漫画输出分镜，小说输出章节。
- 分阶段加载文案、加载动画、重复提交保护、错误提示和请求超时。
- 成功创作保存在 `localStorage` 中，最多最近 5 次；按标题、时间、类型和来源展示，点击恢复。
- 历史读取损坏或容量不足不会阻止创作；支持清空历史。记录仅属于当前浏览器与域名，不跨设备同步。
- 输入及模型结果通过 `textContent` 展示，不执行 HTML。
- 手机与电脑响应式布局，支持键盘和减少动画偏好。

## 技术栈与结构

纯 HTML / CSS / JavaScript，无构建依赖。经典 defer 脚本按 api.js → script.js 加载，兼容 GitHub Pages 子目录。

```text
ai-story-studio/
├── index.html
├── style.css
├── script.js          # UI、生成状态、历史与复制
├── api.js             # 模拟生成、后端请求、结果校验、超时与错误
├── README.md
└── backend/           # 可选，GitHub Pages 不运行此目录
    ├── server.mjs     # Node.js 22+ 原生 HTTP + fetch，无依赖
    ├── .env.example   # 空环境变量模板
    └── .gitignore
```

## 本地体验 Demo

在仓库根目录运行：

```sh
python -m http.server 8000
```

访问 `http://localhost:8000/ai-story-studio/`。也可以直接打开 HTML。某些浏览器在 file:// 下限制存储与剪贴板；失败时会提示，推荐通过本地 HTTP 使用。

## 接通真实 GPT

架构：浏览器 → 自己的 `/api/generate` 服务 → OpenAI Responses API。

1. 安装 Node.js 22 或更新版本。复制 `backend/.env.example` 为 `backend/.env`，只在本机编辑。
2. 在 `.env` 设置 `OPENAI_API_KEY`，以及你的账户可用、支持 Responses Structured Outputs 的 `OPENAI_MODEL`。本项目不预设模型或费用。
3. `ALLOWED_ORIGIN` 设置为前端来源，例如 `http://localhost:8000`（不含路径或末尾斜杠）。
4. 在 `ai-story-studio` 目录运行：

```sh
node --env-file=backend/.env backend/server.mjs
```

5. 把 `api.js` 顶部的公开配置 `endpoint: ''` 改为 `endpoint: 'http://127.0.0.1:8787/api/generate'`。
6. 从本地 HTTP 页面选择「AI · 真实生成」，输入想法后生成。返回代码 503 表示环境变量不完整，429 表示限流，422 表示拒绝或输出未完成。

### GitHub Pages 部署

GitHub Pages 只托管静态文件，不能安全保存和执行服务端密钥。GitHub Actions 中的环境变量如果写入前端打包产物同样会暴露，不要这样做。

仅部署前端时保持 `endpoint: ''`，Demo 完整可用。要启用公网 AI，将后端独立部署到支持服务端环境变量的主机或 Serverless 服务，再将前端 endpoint 改为该服务的 HTTPS 地址。后端 `ALLOWED_ORIGIN` 设为 `https://niccjie.github.io`。

参考后端默认只监听本机 127.0.0.1，可通过受控 HTTPS 反向代理连接。内置单进程每分钟 10 次和并发 2 次的总量限制；这是本地原型，**CORS 不是身份认证**。公网发布前需在网关增加用户认证、分用户限流与预算控制，不要将此示例直接用作无限制公共代理。多实例需共享限流存储。

密钥只保存在后端环境变量，不能放入 HTML、api.js、localStorage 或提交到 Git。`.env` 已加入忽略规则。不要上传包含真实密钥的 `.env` 文件到静态站点。

## 接口约定

`POST /api/generate`，Content-Type 为 application/json：

```json
{"idea":"一个大学生获得未来AI系统","type":"drama"}
```

type 仅允许 drama / comic / novel。成功直接返回以下对象，所有字段都是非空字符串，使用换行组织内部内容：

```json
{
  "title":"作品标题",
  "summary":"一句话介绍：…\n\n故事背景：…",
  "characters":"主角\n姓名：…\n年龄：…\n身份：…\n性格：…\n能力：…\n\n配角\n姓名：…\n作用：…",
  "outline":"第一幕：…\n\n第二幕：…\n\n第三幕：…",
  "episode":"场景1：…\n地点：…\n人物：…\n对白：…\n\n场景2：…",
  "image_prompt":"cinematic anime style, young student, future city, dramatic lighting"
}
```

后端采用严格 JSON Schema 输出，并检查拒绝、未完成响应和字段有效性。前端独立校验非空字符串与长度。加载文案只是等待提示，不代表服务端真实阶段进度。请求失败保留上次结果，不写入失败历史。

实现依据：[OpenAI Structured Outputs 官方文档](https://developers.openai.com/api/docs/guides/structured-outputs)。

## 本地检查与后续计划

安装 Node.js 22+ 后，在 `ai-story-studio` 目录运行 `node tests/run.mjs`。测试包含模拟 DOM 的交互状态、存储与错误分支，以及本机 HTTP 接口联调；模型上游被替换为测试响应，不产生 API 费用。这不是浏览器视觉测试。

检查空输入、三种类型、重新生成、清空、复制、刷新后恢复历史、超过 5 次的淘汰行为，以及未配置 AI、接口错误和损坏存储的提示。

后续：配置真实模型联调；部署带认证与用量限制的后端；加入流式输出、角色一致性和作品导出。当前升级不自动部署或修改线上站点。
