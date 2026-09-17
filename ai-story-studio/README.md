# niccjie AI Creator Studio

本地 AI 故事创作助手：输入创意、选择短剧 / 漫画 / 小说，生成标题、人物设定、故事简介、首集内容与英文绘图提示词。保留现有界面、Demo 模式、重新生成、复制和最近 5 次历史记录。

前端使用 HTML、CSS、JavaScript；后端使用 Node.js 22+ 与 Express；通过 OpenAI Responses API 的严格 JSON Schema 获取结构化结果。当前仅用于本地，不部署。

## 文件结构

```text
ai-story-studio/
├── index.html                 # 原有界面不变
├── style.css                  # 原有样式不变
├── script.js                  # 展示、历史记录及本地服务检测
├── api.js                     # POST /api/create-story、超时、JSON 适配
├── README.md
├── server/
│   ├── server.js              # Express 服务与 OpenAI 请求
│   ├── package.json
│   ├── package-lock.json      # 安装依赖后生成
│   ├── .env                   # 本地填写，不提交
│   ├── .env.example           # 空配置模板
│   ├── .gitignore
│   └── server.test.js         # 模拟 OpenAI 的本地 HTTP 测试
├── tests/run.mjs              # 前端回归测试
└── backend/                   # 旧版原生 HTTP 参考代码，不再作为启动入口
```

## 启动

安装 Node.js 22 或更新版本（包含 npm），在仓库根目录执行：

```powershell
cd ai-story-studio/server
npm install
```

编辑 `server/.env`，填写：

```dotenv
OPENAI_API_KEY=你的OpenAI密钥
OPENAI_MODEL=你的账户可用且支持Responses结构化输出的模型ID
PORT=3000
```

已创建 `.env`，密钥和模型默认留空，避免冒用配置。可从 `.env.example` 恢复模板。不要在聊天、前端脚本或 Git 中粘贴密钥。

```powershell
npm start
```

浏览器打开 **http://localhost:3000/ai-story-studio/**。服务会同时提供前端和 API，不需要另开 Python 静态服务器，也无需修改前端 URL。

页面检测到本地 Express 后默认选择真实 AI 模式；输入创意并点击「生成创作方案」。仍可切换 Demo。真实 AI 请求会消耗 OpenAI API 配额。修改 `.env` 后需重启；开发时可使用 `npm run dev`。

若端口占用，在 `.env` 修改 PORT，再访问对应端口。若出现 `node/npm 无法识别`，请安装 Node.js 并重新打开终端。

## API

### 健康检查

`GET /api/health` → `{"service":"ai-creator-studio","configured":true}`。

configured 只表示变量已填写，不代表密钥、模型或余额已验证。不会返回密钥。

### 创作

`POST /api/create-story`，Content-Type 为 `application/json`：

```json
{"idea":"一个大学生获得未来AI系统","type":"drama"}
```

- idea：去除首尾空格后 1–500 字。
- type：`drama`（短剧）、`comic`（漫画）、`novel`（小说）。

成功响应是五个非空字符串：

```json
{
  "title":"未来的选择",
  "characters":"姓名、年龄、身份、性格、能力与配角作用……",
  "summary":"一句话介绍：……\n故事背景：……\n剧情大纲：\n第一幕：……\n第二幕：……\n第三幕：……",
  "episode":"场景1：……\n地点：……\n人物：……\n对白：……",
  "image_prompt":"cinematic anime style, young student, futuristic city, dramatic lighting"
}
```

保留现有“剧情大纲”面板：前端从 summary 的独立 `剧情大纲：` 标记后提取内容，不新增 API 字段。模型未单列大纲时，面板显示提示，不编造内容。漫画生成分镜，小说生成首章。

错误响应为 `{"error":"说明"}`：400 输入/JSON 无效，401 密钥验证失败，403 跨站访问，413 请求过大，415 内容类型错误，422 拒绝或未完成，429 限流/配额，502 上游连接或格式错误，503 未配置环境变量，504 超时。失败不自动降级为模板生成。

## 测试 API

启动服务后，在另一个 PowerShell 窗口运行：

```powershell
Invoke-RestMethod http://localhost:3000/api/health

$storyPayload = @{ idea = '一个大学生获得未来AI系统'; type = 'drama' } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/create-story -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($storyPayload))
```

第二条请求调用真实 OpenAI，需要有效环境变量。切换 type 可验证漫画与小说。

在 `server` 目录运行离线模型测试（只发本机 HTTP 请求，不调用真实 OpenAI）：

```powershell
npm test
node ../tests/run.mjs
```

覆盖三种类型、参数校验、JSON 错误、静态资源、密钥文件不可访问、上游失败、超时与历史交互。

## 密钥与本地安全

- `.env` 只由 Node.js 在启动时读取，已在 `.gitignore` 忽略。
- Express 只向外提供明确列出的页面文件，不开放 server、backend、测试、依赖或 `.env`。
- 只监听 `127.0.0.1`，浏览器 API 调用限制为同源；含请求体上限、超时、每分钟 10 次和最多 2 个并发的本机进程限制。
- 不记录输入、密钥或原始上游错误。历史内容仅由现有前端保存在当前浏览器。
- 不要用通用静态服务器托管包含真实 `.env` 的整个目录。此版本不用于公网部署。

参考：[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)、[Express 5 API](https://expressjs.com/en/5x/api/)。
