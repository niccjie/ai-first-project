# AI Creator Portfolio · niccjie

一个大二学生的 AI 创作工具作品集。当前核心项目是 **AI Story Studio**：把一个故事想法整理为短剧分镜、漫画脚本或小说章节的结构化创作方案。

## 先看成果

- [个人主页](https://niccjie.github.io/ai-first-project/)
- [《未读消息》完整案例](https://niccjie.github.io/ai-first-project/ai-story-studio/examples/unread-messages/)
- [免费试用申请](https://niccjie.github.io/ai-first-project/trial.html)

## 这个项目解决什么问题

有故事想法的人，常常卡在“如何把一句设定变成可以继续写、画或拍的内容”。AI Story Studio 先帮助把创意整理成：

- 角色、关系与视觉一致性设定；
- 整季结构与分集悬念；
- 短剧的场景、对白和镜头清单；
- 漫画的画格脚本与提示词；
- 小说章节与后续衔接信息；
- 可复制、可审阅的客户阅读版文档。

## 当前状态

| 已完成 | 正在验证 | 暂不做 |
| --- | --- | --- |
| 三种内容形式的结构化创作原型 | 3 位免费试用用户的真实反馈 | 图像、视频、配音供应商接入 |
| 本地 Demo、保存与导出 | 哪种交付最有价值、用户愿意为何付费 | 未经预算确认的付费模型调用 |
| 校园悬疑案例与试用入口 | 小额服务包与第一单 | 无依据的大型平台功能 |

## 《未读消息》案例

案例以“失踪好友的定时消息”为创作命题，展示同一个故事如何被整理成 3 集短剧分镜、6 格漫画开场和小说第一章。它是**静态能力演示**，不假装为已成交客户项目，也不调用真实模型或外部媒体 API。

## 本地使用与测试

核心应用位于 [`ai-story-studio/`](./ai-story-studio/)。详细的启动方式、架构边界与测试说明见 [AI Story Studio README](./ai-story-studio/README.md)。

现有自动测试使用模拟响应，不读取 `.env`、不访问真实 DeepSeek，也不会产生模型费用。

## 反馈与合作

目前开放 3 个免费试用名额。你可以从 [试用页面](https://niccjie.github.io/ai-first-project/trial.html) 提交一个故事想法，或通过页面内的邮件入口联系我。

> 本仓库不应包含 API Key、密码或任何用户敏感信息。
