# niccjie AI Creator Studio · 生产工作台 V0.2

一个创意 → 作品 Bible → 整季结构 → 多集大纲 → 按需生成单集。

这是已有 AI Story Studio 的增量升级。保留原有米白、橙色卡片界面、Demo、复制、历史记录和旧版快速创作；继续使用已验证可用的 **DeepSeek `/v1/responses`**。本轮不更改现有密钥、模型配置或接入其他媒体 API。

## 本地启动

环境要求：Node.js 22+，已安装的 Express。已有配置不需要重建，也不要覆盖 `.env`。

在仓库根目录打开 PowerShell：

```powershell
cd ai-story-studio/server
npm.cmd start
```

如果旧服务仍在运行，先在它所属的终端按 Ctrl+C 停止，再运行上述命令。访问：

**http://localhost:3000/ai-story-studio/**

页面脚本有更新，请刷新浏览器；必要时 Ctrl+F5。仅全新安装、缺少依赖时才需运行 `npm.cmd ci`。旧版 `backend/` 不是当前启动入口。

服务仍由原有启动逻辑读取已有 `server/.env` 中的 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`PORT`。无需新增环境变量。不要把密钥粘贴到聊天、源码、前端或 Git 中。

## 操作流程

1. 输入创意，选择短剧 / 漫画 / 小说及题材。
2. 选择 20、30、50 集，默认 30 集；短剧和漫画选择 30、60、90 秒。小说隐藏时长，按章节生产。
3. 点击 **生成整季策划**，先得到作品概览、核心设定、人物 Bible、五阶段结构和严格对应数量的每集大纲。
4. 同时建立 0–12 个跨集关键道具的资产表，记录归属、外观标识、剧情作用与当前状态；旧历史会自动兼容为空资产表。
5. 集数列表每页 10 集，展开卡片查看开场钩子、事件、冲突、反转及悬念。
5. 点击 **生成本集**，在单集工作区查看结果。短剧为场景、对白、配音、节奏和镜头；漫画强调画格与分镜；小说输出叙事章节正文。
6. 已生成单集可再次查看或重新生成。建议按集数顺序生产：前集已有正文时发送其连续性摘要；未生成时使用前集大纲。

作品生成后使用保存在作品中的类型、时长、集数和人物设定。修改左侧表单不会悄悄改变当前作品；需要点击重新生成整季建立一份新作品。

重新生成前集会把后续已生成内容标记为 **旧稿待更新**，原文保留，可打开或复制。旧稿不会作为新的前集上下文。按顺序更新可重新建立连续性。

**复制完整方案** 会复制整季 JSON、参数及已生成单集；**下载生产 JSON** 会在浏览器本地生成同一份可交接给后续图片、视频或剪辑流程的文件。单集工作区另有复制按钮。最近 5 份作品保存在浏览器 localStorage 中，旧版记录仍可查看。存储满或被禁用时显示明确提示，当前页面内容仍保留；可复制导出后自行清理历史。没有云端存储。

“快速创作方案（旧版）”保留原有 `/api/create-story` 功能，不使用新的整季参数。

## 请求规模与费用控制

- 整季先请求一次作品 Bible，再每批请求 10 集大纲：20 / 30 / 50 集分别为 3 / 4 / 6 次顺序模型调用。
- 每次上游输出上限仍为 6000 tokens；规划阶段不生成任何整季正文。
- “生成本集”每次只调用一次模型，发送整季设定、当前与相邻大纲，以及可用的前集连续性摘要，不发送所有已生成剧本。
- 不自动重试付费请求；拒绝、截断、少集、重复编号或非法结果都会提示错误，旧作品保留。
- 支持取消。取消会中断后续批次及请求，但服务商已经处理的部分可能仍产生费用。
- 单次模型调用最多等待 90 秒，新工作台请求总上限 9 分钟。旧版请求超时仍为 55 秒。分页加载只操作本地内容，不调用模型。
- 整季中途失败不会保存半成品，下次重试会重新规划，已执行批次仍可能计费。

## API

所有接口同源、本机访问；密钥仅由服务端使用。

### POST /api/create-series

```json
{
  "idea": "一个普通大学生发现自己的记忆被修改",
  "type": "drama",
  "genre": "悬疑",
  "total_episodes": 30,
  "duration": 60
}
```

type：drama / comic / novel。题材：悬疑、都市、校园、爱情、科幻、逆袭、重生、其他。小说的 duration 可为 null，服务端统一忽略视频时长。

返回 `title, genre, logline, target_audience, tone, world_setting, core_conflict, main_mystery, selling_points, characters, season_arc, episode_outlines`。

- characters：name、age（字符串）、identity、personality、motivation、weakness、secret、relationship、visual_identity。
- season_arc：五阶段，每个阶段包含 stage、start_episode、end_episode、goal、escalation、key_twist；必须无重叠、无遗漏覆盖整季。
- episode_outlines：必须恰好为选定集数且连续编号，每集含 episode_number、title、opening_hook、main_event、conflict、twist、cliffhanger。

### POST /api/create-episode

```text
{
  options: 原始作品参数,
  series: create-series 返回的完整作品对象,
  episode_number: 2,
  previous_episode: 前一集已生成对象或 null
}
```

返回共同字段：episode_number、title、opening_hook、pacing、twist、cliffhanger、continuity_summary。

短剧 / 漫画额外返回：

- scenes：scene_number、location、time、characters（姓名数组）、action、dialogue。
- voiceover：可复制的配音文本。
- shot_list：shot_number、shot_type、visual、action、dialogue、duration（秒）、image_prompt、video_prompt。
- 镜头总时长必须与作品目标时长一致（允许 1 秒舍入差），英文提示词不能含中文。

小说额外返回 `chapter_text`，没有强行套用场景脚本、分镜或配音字段。

### 兼容接口

- `POST /api/create-story`：保留原有快速创作请求和五字段返回。
- `GET /api/health`：只返回服务名与是否已配置的布尔值，不返回配置内容。

错误为 `{ "error": "说明" }`。主要状态码：400 输入或前集信息错误；401 鉴权失败；403 跨站请求；413 请求过大；415 非 JSON；422 输出拒绝、未完成或结构校验失败；429 限流；502 上游异常；503 未配置；504 超时。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| index.html / style.css | 策划参数、人物与道具资产分区、折叠集数卡片、移动端布局 |
| script.js | 新旧创作流程、状态、取消、历史兼容、旧稿标记 |
| api.js | 保留旧版创作请求，不改原有适配逻辑 |
| production-contract.js | 浏览器与服务端共用 JSON Schema、人物/道具资产、集数、阶段、单集结构校验 |
| production-api.js | 新接口请求、超时 / 取消及本地 Demo 模板 |
| production-view.js | 人物 / 阶段折叠、10 集分页、单集与小说正文展示 |
| server/server.js | 原有 Express 与 DeepSeek 生成路径，挂载新路由、共享限流 |
| server/production.js | 作品 Bible、分批大纲、上下文衔接与单集请求 |
| server/production-diagnostics.js | 阶段日志、上游错误分类与 token 用量的安全白名单 |
| server/production.test.js | 新 API 结构、批次、时长、错误与费用控制测试 |
| tests/workspace.mjs | 新工作台分页、历史、取消、旧稿与三类型交互测试 |

## 自动测试

在 `server` 目录：

```powershell
npm.cmd test
node ../tests/run.mjs
node ../tests/workspace.mjs
```

测试使用注入的虚构配置和模拟模型响应，不读取 `.env`，不访问真实 DeepSeek，也不产生模型费用。`npm.cmd start` 与真实生成应由你在正常本地环境人工验证。

## 真实生成故障诊断

重启 `npm.cmd start` 后，终端会输出以 `[production]` 开头的 JSON 日志。相同 `request_id` 属于一次页面生成操作；`request_index` 是实际发出的上游请求序号，`total_requests` 是预计请求总数。

- 第 1 次请求是 `series_bible`，同时生成 Bible 与五阶段 `season_arc`。
- 后续请求是 `episode_outline_batch`，每次 10 集。`outline_batch` 从 1 开始；`range_start` / `range_end` 标记集数范围，`previous_outlines_count` 表示携带的已生成大纲数量。20 / 30 / 50 集分别最多请求 3 / 4 / 6 次。
- `http_response` 记录 HTTP 状态；`upstream_response` 记录 DeepSeek 状态、`incomplete_reason` 与数值 token 用量（包括 `reasoning_tokens`）。
- `validation_failed` 记录本地 Schema 字段路径或连续性检查原因；`request_failed` / `generation_failed` 记录失败阶段及原因。失败后不自动重试，不继续下一批，也不保存半成品。
- 非 2xx 会读取错误 JSON，记录白名单中的 `error_type` / `error_code`；`error_message` 只记录从上游 message 提取的固定类别，例如 `structured_output_parameter`。未知内容标记为 `unrecognized` 或 `provider_message_redacted`，绝不原样输出 message。

日志不包含请求头、配置值、用户创意、生成正文、思考内容或原始响应。JSON 解析异常也只记录固定原因，因为原始异常可能包含正文片段。

本次诊断保留 `max_output_tokens: 6000`、现有 Schema、模型与思考配置。该 token 上限同时覆盖思考与可见正文；只有下一次人工日志出现 `incomplete_reason: "max_output_tokens"` 才能确认额度截断。若出现 `content_filter`、`failed` 或结构校验错误，应按对应原因处理，不应盲目提高额度。

人工复测：重启服务，打开 `http://localhost:3000/ai-story-studio/`，选择真实 AI、短剧、20 集，点击一次「生成整季策划」。若失败，查看同一 `request_id` 的 `request_start` 到 `generation_failed` 日志；若成功，再由你决定是否测试单集。日志中 `request_index: 1` 且 `stage: "series_bible"` 表示首批失败，后续批次尚未发出。此次测试未连接真实 DeepSeek，不能据此认定真实生成问题已经解决。

## 人工验收建议

1. 先用 Demo + 短剧 + 30 集确认五个分区、精确 30 集、3 页列表，初始没有生成正文。
2. 生成第 1、2 集，检查人物、配音、英文镜头提示词和总时长；查看模式是否正确标注 Demo。
3. 重生成第 1 集，确认第 2 集原文仍在但标为旧稿。更新第 2 集后继续生成第 3 集。
4. 分别检查 20、50 集列表，切换漫画和小说；小说应隐藏时长并输出章节正文。
5. 刷新恢复历史，复制整季及单集；点击旧版快速创作确认原功能还可用。
6. 选择真实 AI，先以 20 集测试策划，再生成第 1、2 集；注意这会产生真实费用。
7. 生成期间测试取消或断网，确认保留旧作品、不写入半成品、按钮可再次操作。
8. 手机宽度检查选择控件、分页与长英文提示词换行。

## 当前边界

本阶段不接图片、视频和配音 API，不做多人协作或云端保存。Demo 只验证流程，模板内容不等于真实创作。结构校验可以阻止少集、非法字段和错误时长，无法完全判断故事逻辑与重复情节的语义质量；真实模型对长篇连续性的表现仍需人工审稿。

本轮没有读取、修改或复制 `.env`，没有改变现有 DeepSeek URL、鉴权变量、模型配置或响应格式。真实接口已经由用户在此前验证；本轮新增嵌套 Schema 和多批次流程尚需在真实模型上人工验收。

## 开源调研与实测记录

本项目未复制或整仓引入第三方代码；下列项目仅用于核对许可、借鉴架构边界与能力规划：

| 项目 | 许可 | 可借鉴能力 | 本项目的取舍 |
| --- | --- | --- | --- |
| [weeduon/ai-short-drama-studio](https://github.com/weeduon/ai-short-drama-studio) | MIT | Agent 工作流、作品资产与视频任务边界 | 保留当前轻量 Express 架构；后续以独立 provider 接口接入媒体任务，避免整仓迁移。 |
| [hyyyyyyz/dramai](https://github.com/hyyyyyyz/dramai) | Apache-2.0 | 文本到分镜、角色一致性、剪映草稿导出 | 已采用“先结构、后按需单集”的思路；导出与媒体生成留待有明确目标平台时实现。 |
| [Y-w1234/ai-short-drama-pipeline](https://github.com/Y-w1234/ai-short-drama-pipeline) | MIT | 角色 / 场景 / 道具 / 分镜的分阶段管线、JSON 容错、离线 Demo | 当前 Bible、阶段大纲、单集结构与 Demo 已覆盖核心链路；道具资产表可作为下一阶段 Schema 扩展。 |
| [EvoLinkAI/ai-short-drama](https://github.com/EvoLinkAI/ai-short-drama) | Apache-2.0 | 从剧本分析到分镜、图像、视频、配音的模块化生产链 | 只作为产品路线参考，不接入其多模型或媒体 API，避免扩大密钥与供应商范围。 |

2026-09-17 已在独立本机端口完成一次真实 DeepSeek 验证：短剧、悬疑、20 集、60 秒。单一 `request_id` 内依次完成 `series_bible`、1–10 集与 11–20 集大纲，共 3 次上游请求，均为 HTTP 200 / `completed`；`incomplete_reason` 均为空，`reasoning_tokens` 均为 0，输出 token 分别为 1697、1562、1768，均显著低于 6000 上限。结论：维持 `reasoning: { effort: 'none' }`、6000 输出上限、10 集分批和“失败不自动重试”策略；当前没有证据支持调高额度或增加续写/重试付费请求。
