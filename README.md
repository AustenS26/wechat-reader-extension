# WeChat Reader AI / 微信公众号阅读助手

## 中文

WeChat Reader AI 是一个本地 Chrome 插件，用来阅读微信公众号文章，并用 AI 生成结构化摘要、洞察和问答。

它不是 Chrome Web Store 上架插件，目前主要用于个人阅读和学习沉淀。

### 它能做什么

- 识别当前打开的微信公众号文章
- 提取文章标题、作者、发布时间和正文
- 生成 7 个阅读模块：
  - Summary / 摘要
  - Core Points / 核心要点
  - Key Insights / 关键洞察，不做散点罗列
  - Core Excerpts / 核心摘录，可点击定位原文段落
  - Reader Value / 不同读者视角下的价值
  - Core Conclusion / 核心结论
  - Author Intent / 作者意图
- 支持基于文章内容继续追问
- 支持用 comment 优化当前输出：输入反馈后，AI 会重写七段阅读结果
- 支持记住 API Key，不用每次重新输入
- 支持保存个人笔记
- 支持导出 Markdown 阅读笔记到 `reading-notes_YYYY-MM-DD-*.md`
- 支持多个 AI Provider：Anthropic、OpenAI、DeepSeek、Moonshot、Zhipu、Custom

### 本地安装

1. 打开 Chrome
2. 进入 `chrome://extensions`
3. 打开 `Developer mode`
4. 点击 `Load unpacked`
5. 选择这个稳定路径：

```text
/Users/didi/work/wechat-reader-extension
```

这个路径应该指向真实源码目录：

```text
/Users/didi/work/projects/wechat-reader-extension/extension
```

如果 Chrome 显示 `ERR_FILE_NOT_FOUND`，通常是插件目录移动了。重新建立软链即可：

```bash
ln -sfn /Users/didi/work/projects/wechat-reader-extension/extension /Users/didi/work/wechat-reader-extension
```

### 使用方式

1. 打开一篇微信公众号文章，URL 应该以 `https://mp.weixin.qq.com/` 开头
2. 打开 WeChat Reader AI 侧边栏
3. 先确认插件已经识别到文章
4. 点击“开始分析”生成结构化阅读结果
5. 如果输出不符合预期，在 `Optimize with Comment` 里写下你的反馈，让插件重写当前结果
6. 继续追问、保存笔记或导出 Markdown

### 项目结构

```text
wechat-reader-extension/
├── README.md              # 项目入口，中英双语说明
├── extension/             # Chrome Load unpacked 选择的真实插件目录
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── sidepanel.*
│   └── options.*
└── docs/                  # 安装说明、backlog、交互日志、重建 prompt
```

### 文档

- [本地安装与故障排查](./docs/SETUP.md)
- [产品迭代流程](./docs/OPTIMIZATION_WORKFLOW.md)
- [需求 Backlog](./docs/BACKLOG.md)
- [真实交互日志](./docs/INTERACTION_LOG.md)
- [从零重建插件的 Prompt](./docs/REBUILD_PROMPT.md)

### 当前状态

这个插件已经可以作为本地阅读助手使用。当前版本已经开始优化主体验：

- 更清晰的“识别文章 → 开始分析”流程
- 更具体的错误诊断和重试指引
- 基于 comment 的多轮输出优化
- 默认强调核心要点、聚合洞察和读者价值，而不是简单复述文章结构
- 中文文章默认中文输出；英文文章默认中英双语输出
- 更稳定的 Markdown 文件命名，方便沉淀到个人 reading-notes 文件夹

---

## English

WeChat Reader AI is a local Chrome extension for reading WeChat public-account articles with AI assistance.

It is not a Chrome Web Store extension. It is currently designed for personal reading, article analysis, and knowledge capture.

### What It Does

- Detects the current WeChat article page
- Extracts article title, author, publish time, and body text
- Generates seven structured reading sections:
  - Summary
  - Core Points
  - Key Insights
  - Core Excerpts
  - Reader Value
  - Core Conclusion
  - Author Intent
- Supports follow-up Q&A based on the article
- Supports comment-driven revision: write feedback and regenerate the seven-section analysis
- Remembers API keys so you do not re-enter them every time
- Saves personal reading notes
- Exports notes as Markdown with `reading-notes_YYYY-MM-DD-*.md`
- Supports multiple AI providers: Anthropic, OpenAI, DeepSeek, Moonshot, Zhipu, and Custom

### Local Installation

1. Open Chrome
2. Go to `chrome://extensions`
3. Enable `Developer mode`
4. Click `Load unpacked`
5. Select the stable local path:

```text
/Users/didi/work/wechat-reader-extension
```

This stable path should point to the actual source directory:

```text
/Users/didi/work/projects/wechat-reader-extension/extension
```

If Chrome shows `ERR_FILE_NOT_FOUND`, the unpacked extension path probably moved. Recreate the symlink:

```bash
ln -sfn /Users/didi/work/projects/wechat-reader-extension/extension /Users/didi/work/wechat-reader-extension
```

### How to Use

1. Open a WeChat article whose URL starts with `https://mp.weixin.qq.com/`
2. Open the WeChat Reader AI side panel
3. Confirm that the extension has detected the article
4. Click “Start analysis” to generate the structured reading output
5. If the output is not good enough, write feedback in `Optimize with Comment` and let the extension revise it
6. Ask follow-up questions, save notes, or export Markdown

### Repository Structure

```text
wechat-reader-extension/
├── README.md              # Project entry point, bilingual
├── extension/             # Actual Chrome unpacked extension directory
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── sidepanel.*
│   └── options.*
└── docs/                  # Setup, backlog, logs, rebuild prompt
```

### Documentation

- [Local setup and troubleshooting](./docs/SETUP.md)
- [Optimization workflow](./docs/OPTIMIZATION_WORKFLOW.md)
- [Backlog](./docs/BACKLOG.md)
- [Interaction log](./docs/INTERACTION_LOG.md)
- [Rebuild prompt](./docs/REBUILD_PROMPT.md)

### Current Status

The extension is usable as a local reading assistant. The current version has started improving the core workflow:

- clearer “detect article → start analysis” flow
- better diagnostics and retry guidance
- comment-driven multi-turn output revision
- default emphasis on core points, synthesized insights, and reader value instead of article-outline recap
- Chinese articles output in Chinese; English articles output bilingually in Chinese and English
- cleaner Markdown file naming for the personal reading-notes workflow
