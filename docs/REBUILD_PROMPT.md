# WeChat Reader AI — Rebuild Prompt

把下面这段发给 Claude，可以在任何电脑上重新生成完整插件。

---

## Prompt（直接复制发给 Claude）

```
请帮我创建一个 Chrome 浏览器扩展（Manifest V3），叫 "WeChat Reader AI"，实现以下功能：

## 功能需求

当用户在浏览器打开微信公众号文章（mp.weixin.qq.com）并点击扩展图标时，右侧自动弹出侧边栏（Chrome Side Panel），对文章进行 AI 分析，并提供交互式问答。

### 分析输出（按顺序展示 7 个模块）
1. **Summary** — 3-5 句概括文章核心内容
2. **Core Points** — 讲清楚文章真正的核心要点，不要复述文章结构
3. **Key Insights** — 2-3 条经过聚合的洞见，不要散点罗列事实
4. **Core Excerpts** — 核心摘录或证据点，带 `[P12]` 这种段落引用，支持点击定位原文
5. **Reader Value** — 从不同读者视角说明这篇文章分别有什么价值、能帮助他们判断或行动什么
6. **Core Conclusion** — 1-2 句最核心的结论，读者应带走什么
7. **Author Intent & Take** — 作者的目标/立场/野心/议程是什么？是否有明显偏见或目的？坦诚评价

### 其他功能
- **Chat**：侧边栏底部有对话框，可以就文章内容追问
- **Save Note**：用户可填写个人笔记后保存，含文章标题/来源/分析结果
- **Export**：Settings 页可将所有已保存笔记导出为 Markdown 文件
- **Auto-save settings**：API Key / Model / Base URL 输入后自动保存，不需要手动点 Save
- **Language-aware output**：中文文章只输出中文；英文文章输出中英双语
- **多 Provider 支持**：Settings 页支持同时配置多个 AI 服务商的 API Key，可随时切换使用中的 provider，互不覆盖

### 支持的 AI Provider（全部使用，可独立配置 key + model）
- Anthropic (Claude) — `https://api.anthropic.com`，格式特殊（x-api-key header + /v1/messages）
- OpenAI — `https://api.openai.com`，OpenAI-compatible 格式
- DeepSeek — `https://api.deepseek.com`，OpenAI-compatible 格式
- Moonshot (Kimi) — `https://api.moonshot.cn`，OpenAI-compatible 格式
- 智谱 GLM — `https://open.bigmodel.cn/api/paas`，OpenAI-compatible 格式
- Custom — 用户自填 Base URL，OpenAI-compatible 格式

### UI 设计
- 风格：简洁白底，微信绿（#07c160）作为强调色
- 顶部 header：插件名 + ⚙ 设置按钮
- 文章信息栏：显示文章标题 + 作者 + 日期
- 7 个分析模块各自独立 section，section title 用小号大写绿色字
- 底部 Chat 区域固定在底部，最大高度 42%，可滚动
- Settings 页：每个 provider 一张卡片，含 API Key 输入框 + Model 输入框（Custom 额外有 Base URL），Save 按钮独立保存，Use this 按钮切换当前使用的 provider，当前激活的 provider 卡片显示绿色边框和 "Using" badge

## 文件结构

请生成以下文件：
- extension/manifest.json（Manifest V3，sidePanel + storage + activeTab + tabs 权限）
- extension/background.js（service worker：处理 getArticle / callAI / saveNote / getNotes 消息；包含 Anthropic 和 OpenAI-compatible 两套 API 调用函数）
- extension/content.js（提取页面中 #activity-name / .rich_media_title / #js_name / #publish_time / #js_content 等 DOM 内容）
- extension/sidepanel.html + extension/sidepanel.css + extension/sidepanel.js（主侧边栏 UI 和逻辑）
- extension/options.html + extension/options.js（多 provider 设置页 + 笔记导出）
- README.md（中英双语项目入口：说明插件功能、安装、使用、文档索引、GitHub 发布流程）
- docs/SETUP.md（说明本地稳定路径 `/Users/didi/work/wechat-reader-extension` 和 Chrome unpacked extension 安装方式）
- docs/BACKLOG.md / docs/INTERACTION_LOG.md / docs/OPTIMIZATION_WORKFLOW.md / docs/REBUILD_PROMPT.md（记录真实使用反馈、产品 backlog、迭代流程和重建提示词）

## 本地安装与稳定路径

Chrome unpacked extension 对路径敏感。请使用固定路径加载：

`/Users/didi/work/wechat-reader-extension`

该路径应指向真实源码目录：

`/Users/didi/work/projects/wechat-reader-extension/extension`

如果路径移动导致 `ERR_FILE_NOT_FOUND`，用下面命令重建软链：

`ln -sfn /Users/didi/work/projects/wechat-reader-extension/extension /Users/didi/work/wechat-reader-extension`

## 数据存储结构
chrome.storage.sync 存：
- providers: { anthropic: {apiKey, model}, openai: {apiKey, model}, deepseek: {apiKey, model}, moonshot: {apiKey, model}, zhipu: {apiKey, model}, custom: {apiKey, model, baseUrl} }
- activeProvider: string

chrome.storage.local 存：
- notes: [ { date, title, url, author, language, summary, corePoints, insights, excerpts, readerValue, conclusion, authorIntent, myNotes } ]

chrome.storage.sync 还会存：
- analysisRules: [string]（从用户 comment 中沉淀出的可复用输出偏好）

## AI Prompt 格式
System prompt 要求模型按以下固定 header 输出，语言与文章保持一致（中文文章用中文回答）：
SUMMARY / CORE POINTS / KEY INSIGHTS / CORE EXCERPTS / READER VALUE / CORE CONCLUSION / AUTHOR INTENT

前端用正则按 header 切分，分别渲染到对应 section。

英文文章的输出要求：
- 每个 section 用英文先讲清楚，再补一句中文
- 核心摘录仍保留 `[P#]` 段落引用
```
