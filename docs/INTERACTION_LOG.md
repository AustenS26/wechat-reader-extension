# WeChat Reader AI · Interaction Log

> Purpose: record real user chats and identify which parts should become product / interaction improvements for the extension.
> Source: local Codex session with user, 2026-06-22.

---

## 2026-06-22 · Activation and First-Use Friction

### User Chat Inputs

| Time Context | User Message | What It Reveals |
|---|---|---|
| After workspace cleanup | “reading-notes这个folder作为personal里的project子文件夹里的一个下级文件夹，这个是自己做着好玩的；现在针对 https://mp.weixin.qq.com/s/YZgBZW6589GIjsOvYUZ1fg 这个文章，在帮我起用下这个阅读插件” | User expects the extension to be easy to activate for a specific WeChat article, and expects reading notes to be treated as a personal side project. |
| After opening extension | “不行，打开这个extension显示无法访问您的文件 该文件可能已被移至别处、修改或删除。ERR_FILE_NOT_FOUND” | The extension breaks when its local unpacked-extension path changes. Current UX gives a browser-level file error, not an actionable extension-level fix. |
| After path symlink fix | “再来一次” | User wants a one-shot retry / relaunch flow, not a multi-step manual explanation every time. |
| After extension launches | “OK，这个页面现在根据我的chat应该优化，请记录一个log文件去记录我提的chat内容是哪些，哪些可以被识别成该优话的交互，进一步升级这个extension” | User wants chats to be converted into product iteration logs and upgrade requirements. The extension project needs an explicit feedback-to-backlog loop. |

---

## Identified Interaction Problems

### 1. Local Extension Path Is Fragile

**Observed behavior**
- The extension was originally loaded from `/Users/didi/work/wechat-reader-extension`.
- Workspace cleanup moved it to `/Users/didi/work/projects/wechat-reader-extension`.
- Chrome still remembered the old unpacked-extension path and showed `ERR_FILE_NOT_FOUND`.

**Product implication**
- Unpacked Chrome extensions are path-sensitive.
- If the project folder is moved, the browser gives a generic file-not-found error.
- The user should not have to understand symlinks or extension internals.

**Upgrade idea**
- Add a `SETUP.md` / in-extension setup note explaining the stable install path.
- Keep a stable symlink path:
  - `/Users/didi/work/wechat-reader-extension`
  - points to `/Users/didi/work/projects/wechat-reader-extension`
- Add a visible “If extension fails after folder cleanup” troubleshooting section.

**Priority**
- P0 for local usability.

---

### 2. No First-Run / Reload Guidance

**Observed behavior**
- The assistant had to repeatedly tell the user:
  1. Open `chrome://extensions`
  2. Enable Developer Mode
  3. Load unpacked extension
  4. Select extension folder
  5. Reload extension
  6. Return to WeChat article
  7. Click extension icon

**Product implication**
- First-run setup is too procedural and not encoded anywhere in the project.
- The extension assumes it is already installed and working.

**Upgrade idea**
- Create `SETUP.md` with exact local install steps.
- Add this text to `REBUILD_PROMPT.md` so future rebuilds include setup guidance.
- Add an options-page “Setup / Troubleshooting” section:
  - current provider status
  - current active provider
  - supported page status: `mp.weixin.qq.com`
  - reload instructions

**Priority**
- P1.

---

### 3. Article-Specific Launch Is Not Smooth Enough

**Observed behavior**
- User gave a specific article URL and expected the plugin to be activated for that article.
- Current extension only works after user manually opens the article and clicks extension icon.

**Product implication**
- The “activate for this article” flow is still browser-operation-heavy.
- For repeat use, the desired workflow is: paste URL / open article / analyze.

**Upgrade idea**
- Add side panel field: “Analyze current tab” with clearer state.
- Add optional input field in side panel: paste WeChat article URL, then open/analyze.
- Add a browser action behavior that:
  - opens side panel
  - checks whether current tab is supported
  - if unsupported, shows a button to open target WeChat URL or explains exact next step.

**Priority**
- P1.

---

### 4. Error Messages Are Browser-Level, Not Product-Level

**Observed behavior**
- User saw Chrome’s `ERR_FILE_NOT_FOUND`, which did not explain the real cause: unpacked extension path had moved.
- Current extension also only returns generic errors like “Open a WeChat article first” or API errors.

**Product implication**
- The tool needs friendly, specific diagnosis for the most common failure modes:
  - extension path moved
  - content script not injected
  - not on `mp.weixin.qq.com`
  - provider API key missing
  - provider request failed
  - article extraction returned empty content

**Upgrade idea**
- Add a `diagnostics` message in `background.js`.
- Add a diagnostics panel in `sidepanel.html`:
  - page URL
  - article extraction status
  - active provider
  - API key configured yes/no
  - last error
- Make error copy action-oriented:
  - “This looks like the extension folder moved. Reload it from chrome://extensions.”
  - “This page is not a WeChat article. Open mp.weixin.qq.com article first.”
  - “No API key configured. Open Settings → choose provider → save key.”

**Priority**
- P1.

---

### 5. Reading Notes Are Not Integrated With Personal Knowledge Folder

**Observed behavior**
- User explicitly classified `reading-notes` as a personal side project.
- Current extension saves notes only in `chrome.storage.local`.
- Export is manual Markdown download.

**Product implication**
- Saved notes are trapped in browser storage unless exported.
- User’s desired long-term home is now:
  - `/Users/didi/work/work-hub/personal/projects/reading-notes/`

**Upgrade idea**
- Short term: add export naming convention and instructions to save into reading-notes.
- Medium term: add a native helper script outside the extension to import exported Markdown into `reading-notes`.
- Long term: use Chrome File System Access API where available to let user choose a local notes folder and write Markdown directly.

**Priority**
- P2.

---

### 6. Feedback Should Become Product Backlog Automatically

**Observed behavior**
- User asked to record chat content and identify which parts can become extension improvements.

**Product implication**
- The project needs a lightweight product feedback loop.

**Upgrade idea**
- Maintain this `INTERACTION_LOG.md`.
- Add a `BACKLOG.md` with status fields:
  - `P0/P1/P2`
  - `Problem`
  - `Evidence from chat`
  - `Proposed change`
  - `Status`
- When the user says “这个页面应该优化” or reports friction, append a dated entry here before changing code.

**Priority**
- P1.

---

## Upgrade Backlog Extracted From This Chat

| Priority | Upgrade | Files Likely Touched | Status |
|---|---|---|---|
| P0 | Stabilize extension install path and document symlink path | `SETUP.md`, `REBUILD_PROMPT.md` | Proposed |
| P1 | Add setup / troubleshooting guide | `SETUP.md`, `options.html`, `options.js` | Proposed |
| P1 | Add diagnostics panel for page/provider/extraction status | `sidepanel.html`, `sidepanel.js`, `background.js`, `content.js` | Proposed |
| P1 | Improve error messages with actionable recovery steps | `sidepanel.js`, `background.js` | Proposed |
| P1 | Add article-specific launch helper / unsupported-page state | `sidepanel.html`, `sidepanel.js`, `background.js` | Proposed |
| P1 | Create structured product backlog from interaction log | `BACKLOG.md` | Proposed |
| P2 | Integrate exported notes with `personal/projects/reading-notes` | `options.js`, possible helper script | Proposed |

---

## Current Stable Paths

| Purpose | Path |
|---|---|
| Extension source | `/Users/didi/work/projects/wechat-reader-extension` |
| Stable Chrome unpacked-extension path | `/Users/didi/work/wechat-reader-extension` |
| Personal reading notes | `/Users/didi/work/work-hub/personal/projects/reading-notes` |
| Test article | `https://mp.weixin.qq.com/s/YZgBZW6589GIjsOvYUZ1fg` |

---

## Next Recommended Implementation Order

1. Add `SETUP.md` and update `REBUILD_PROMPT.md` with stable local setup.
2. Add a diagnostics state in side panel:
   - current tab URL
   - supported page yes/no
   - article extracted yes/no
   - active provider
   - API key configured yes/no
3. Improve error messages for missing API key, unsupported page, and empty article extraction.
4. Add `BACKLOG.md` so future chat-derived improvements have a clean tracking surface.
5. Later: improve note export/import into `personal/projects/reading-notes`.

---

## 2026-06-22 · Automatic Log Prompt and Optimization Flow

### User Chat Inputs

| Time Context | User Message | What It Reveals |
|---|---|---|
| After confirming chat expectations can be captured | “你建立一个自动问询，是否记录到阅读插件log吧。之后对于这个小插件有一个自动化的优化流程” | User wants future plugin-related feedback to trigger an explicit capture question, and wants a repeatable optimization workflow rather than ad hoc fixes. |

### Interaction Rule Added

Workspace rule added to `/Users/didi/work/work-hub/AGENTS.md`:

> When the user mentions the WeChat reading plugin, ask whether to record it to the reading plugin log and convert it into a backlog item.

### Product Process Added

- `BACKLOG.md` created for prioritized plugin improvements.
- `OPTIMIZATION_WORKFLOW.md` created for the feedback-to-implementation loop.

### Backlog Impact

- WR-007 tracks the product-feedback loop itself.
- Future plugin feedback should follow:

```text
chat feedback → interaction log → backlog → implementation → reload extension → verify on a real WeChat article
```

## 2026-06-24 · GitHub Repository and README Consolidation

### User Chat Inputs

| Time Context | User Message | What It Reveals |
|---|---|---|
| After building local extension workflow | “我在本地的wechat-reader-extension看下怎么链接到我的GitHub仓库里去，如果不能上传你可以用我的浏览器权限去在网页操作我的GitHub，主要是沉淀read_me和实际这个小插件怎么做” | User wants the local extension project connected to GitHub, with a clear README explaining what the extension does, how to install it, how to recover from path issues, and how future product iteration should work. |
| After first GitHub upload | “上传了，但是你现在结构也太乱了，根本看不明白，能不能梳理清楚” | Repository needs a clearer information architecture: root should be the entry point, process/history documents should move into a docs folder, and README should make the structure self-evident. |
| Same cleanup request | “然后read me x中英双语” | README should be bilingual so both Chinese-first personal workflow and English GitHub readers can understand the plugin. |

### Product / Repository Implication

- The extension already has a GitHub remote: `https://github.com/AustenS26/wechat-reader-extension.git`.
- The repository initially lacked a `README.md`, making the project hard to understand from GitHub.
- The first documentation pass left too many operational files in the root directory, making the repo visually noisy.
- Setup instructions should document the stable local path and Chrome unpacked-extension workflow.

### Backlog Impact

- WR-001 and WR-002 are addressed by setup guidance under `docs/SETUP.md`.
- WR-008 is addressed by adding a bilingual root `README.md`, moving process documents under `docs/`, and pushing the cleaned structure to GitHub.

## 2026-06-24 · Core Reading Workflow and Comment Revision

### User Chat Inputs

| Time Context | User Message | What It Reveals |
|---|---|---|
| After README cleanup | “下一步重点不是继续堆功能，而是改善使用体验：更清晰的首次安装引导 / 更具体的错误诊断 / 更顺畅的‘打开文章 → 识别 → 分析’流程 / 更好地把导出的笔记沉淀到个人 reading-notes 文件夹” | User wants the plugin optimized around the main reading workflow, not feature sprawl. |
| Same request | “我的下载文件夹里有一个html-comment-skiil你也可以参考那个思路，去思考我的这个extension怎么能够更好的支持多轮交互，我提一些comment你怎么优化输出？” | User wants comments to become structured feedback that can revise the output, similar to html-comment's comment-processing loop. |

### Product Implication

- The extension should not auto-jump from page open to AI generation without making extraction status visible.
- Errors should explain what failed and what to do next.
- Chat is not enough for output improvement; the user needs a comment-to-revision workflow.
- Markdown export should use stable reading-notes naming so local automation can ingest it later.

### Implementation Added

- Added explicit `识别当前文章 → 开始分析` flow.
- Added more specific unsupported-page, empty-content, missing-key, and API/network error guidance.
- Added `Optimize with Comment`, storing applied comments per article and regenerating the six-section analysis.
- Added current-note Markdown export with `reading-notes/YYYY-MM-DD-title.md` naming.

### Backlog Impact

- WR-003, WR-004, WR-005, WR-006 moved to Verify.
- WR-009 added for comment-driven output revision.

## 2026-06-24 · Output Philosophy: Core Points, Synthesized Insights, Reader Value

### User Chat Inputs

| Time Context | User Message | What It Reveals |
|---|---|---|
| After trying the improved workflow direction | “OK，我有一个整体的修改意见：always 更讲清楚核心要点，insight而不是输出结构，光了解结构没有意义，现在的insight讲的很散乱。其次在思考输出文章内容的时候，思考读者的视角，这个文章对什么样的人分别有什么样的价值” | The default analysis should move away from outline-style article structure and toward a reader-useful interpretation: core points, fewer but stronger insights, and value by reader type. |

### Product Implication

- `Article Structure` is not a high-value default section for this reading assistant.
- `Key Insights` should synthesize patterns, implications, and decision lenses instead of listing scattered facts.
- The assistant should explicitly ask: useful to whom, and for what decision or action?

### Implementation Added

- Replaced the visible `Article Structure` section with `Core Points`.
- Added `Reader Value`.
- Updated the system prompt so every analysis prioritizes substance over outline.
- Updated Markdown export and rebuild prompt to preserve the new output model.

### Backlog Impact

- WR-010 added and moved to Verify.
