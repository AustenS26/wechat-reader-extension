let article = null;
let articleText = '';
let currentAnalysis = null;
let chatHistory = [];
let commentLog = [];

const $ = id => document.getElementById(id);

const SECTION_HEADERS = [
  'SUMMARY',
  'CORE POINTS',
  'KEY INSIGHTS',
  'READER VALUE',
  'CORE CONCLUSION',
  'AUTHOR INTENT'
];

function showState(state) {
  ['state-no-article', 'state-detected', 'state-loading', 'state-error', 'main-content', 'chat-section', 'article-bar']
    .forEach(id => $(id).classList.add('hidden'));

  if (state === 'ready') {
    $('article-bar').classList.remove('hidden');
    $('main-content').classList.remove('hidden');
    $('chat-section').classList.remove('hidden');
  } else if (state === 'detected') {
    $('article-bar').classList.remove('hidden');
    $('state-detected').classList.remove('hidden');
  } else if (state === 'loading') {
    $('state-loading').classList.remove('hidden');
  } else if (state === 'error') {
    $('state-error').classList.remove('hidden');
  } else {
    $('state-no-article').classList.remove('hidden');
  }
}

function msg(type, payload = {}) {
  return new Promise(resolve => chrome.runtime.sendMessage({ type, ...payload }, resolve));
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatText(value = '') {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function slugify(value = 'wechat-note') {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'wechat-note';
}

function extractSection(text, header, nextHeaders) {
  const pattern = new RegExp(`${header}\\s*([\\s\\S]*?)(?=${nextHeaders.join('|')}|$)`, 'i');
  return text.match(pattern)?.[1]?.trim() || '';
}

function parseAnalysis(text) {
  return {
    raw: text,
    summary: extractSection(text, 'SUMMARY', SECTION_HEADERS.slice(1)),
    corePoints: extractSection(text, 'CORE POINTS', SECTION_HEADERS.slice(2)),
    insights: extractSection(text, 'KEY INSIGHTS', SECTION_HEADERS.slice(3)),
    readerValue: extractSection(text, 'READER VALUE', SECTION_HEADERS.slice(4)),
    conclusion: extractSection(text, 'CORE CONCLUSION', SECTION_HEADERS.slice(5)),
    authorIntent: extractSection(text, 'AUTHOR INTENT', [])
  };
}

function renderBullets(raw) {
  const items = raw.split('\n').filter(l => l.trim())
    .map(l => `<li>${escapeHtml(l.replace(/^[•\-\*①②③④⑤]\s*/, '').trim())}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function renderAnalysis(analysis) {
  currentAnalysis = analysis;
  $('summary-text').innerHTML = formatText(analysis.summary);
  $('conclusion-text').innerHTML = formatText(analysis.conclusion);
  $('author-text').innerHTML = formatText(analysis.authorIntent);
  $('structure-text').innerHTML = analysis.corePoints ? renderBullets(analysis.corePoints) : '';
  $('insights-text').innerHTML = analysis.insights ? renderBullets(analysis.insights) : '';
  $('reader-value-text').innerHTML = analysis.readerValue ? renderBullets(analysis.readerValue) : '';
}

function renderArticleBar() {
  $('article-title').textContent = article?.title || 'Untitled';
  $('article-meta').textContent = [article?.author, article?.date].filter(Boolean).join(' · ');
}

function friendlyError(error) {
  const text = String(error || '');
  if (/No API key/i.test(text)) {
    return `${text}\n\n处理方式：点右上角设置，保存 API Key，并确认当前 provider 显示 Using。`;
  }
  if (/WeChat article|mp\.weixin|Open a WeChat/i.test(text)) {
    return '当前页面不是可识别的微信公众号文章。\n\n处理方式：打开 mp.weixin.qq.com 文章正文页，再点击“识别当前文章”。';
  }
  if (/Could not read|empty|content/i.test(text)) {
    return '已经进入页面，但没有读到正文。\n\n可能原因：文章还没加载完、页面不是正文页、或微信改了 DOM。先刷新文章页，再点击重试。';
  }
  if (/Failed to fetch|NetworkError|timeout/i.test(text)) {
    return 'AI 请求失败，像是网络或代理问题。\n\n处理方式：确认 API 服务可访问，或者切换 provider 后重试。';
  }
  return `${text || 'Unknown error'}\n\n处理方式：刷新文章页后重试；如果仍失败，打开 Settings 检查 provider 和 API Key。`;
}

function showError(error) {
  showState('error');
  $('error-message').textContent = friendlyError(error);
}

function buildAnalysisSystem(extra = '') {
  return `You are a reading assistant. Analyze the article and respond in the same language as the article content (Chinese or English).

Format your response EXACTLY using these section headers in this order. Do not add extra headers or change the names.

Always prioritize substance over outline. The user does not need a simple article structure recap. Explain the core points clearly, extract a small number of strong insights, and evaluate the article from reader perspectives.

SUMMARY
[3-5 sentences: what is this article about, what does it really argue, and why it matters]

CORE POINTS
• [the author's main claim, in plain language]
• [the most important supporting argument or evidence]
• [the real tension, tradeoff, or problem the article is trying to resolve]
• [what the article implies but may not say directly]

KEY INSIGHTS
• [one synthesized, reusable insight. Do not list scattered facts.]
• [one deeper implication, pattern, or decision lens]
• [one practical takeaway or risk, if applicable]

READER VALUE
• [For reader type 1: who this is useful for, and what they can use it to decide or do]
• [For reader type 2: who this is useful for, and what they can use it to decide or do]
• [For reader type 3 if relevant: who may care less, and why]

CORE CONCLUSION
[1-2 sentences: the single most important takeaway]

AUTHOR INTENT
[What is the author trying to achieve? What is their angle, agenda, or goal? Is this a pitch, a warning, an opinion piece, or something else? Be candid.]

${extra}`.trim();
}

async function detectArticle({ silent = false } = {}) {
  if (!silent) {
    $('loading-message').textContent = '正在识别当前页面…';
    showState('loading');
  }

  const result = await msg('getArticle');
  if (result?.error || !result?.content) {
    article = null;
    articleText = '';
    if (silent) {
      showState('no-article');
    } else {
      showError(result?.error || 'Could not read article content.');
    }
    return false;
  }

  article = result;
  articleText = article.content.slice(0, 8000);
  renderArticleBar();
  $('detected-message').textContent = `已识别：${article.title || 'Untitled'}\n正文约 ${article.content.length.toLocaleString()} 字符`;
  showState('detected');
  return true;
}

async function analyzeArticle() {
  if (!article && !(await detectArticle({ silent: true }))) return;

  $('loading-message').textContent = '正在生成结构化阅读结果…';
  showState('loading');

  const res = await msg('callAI', {
    system: buildAnalysisSystem(),
    messages: [{
      role: 'user',
      content: `Title: ${article.title}\nAuthor: ${article.author}\nDate: ${article.date}\nURL: ${article.url}\n\n${articleText}`
    }]
  });

  if (res?.error) {
    showError(res.error);
    return;
  }

  renderAnalysis(parseAnalysis(res.result));
  chatHistory = [
    { role: 'user', content: `Article title: ${article.title}\n\n${articleText}` },
    { role: 'assistant', content: res.result }
  ];
  await loadCommentLog();
  showState('ready');
}

async function applyComment() {
  const comment = $('comment-input').value.trim();
  if (!comment || !currentAnalysis) return;

  $('btn-apply-comment').disabled = true;
  $('comment-status').textContent = 'Optimizing…';

  const res = await msg('callAI', {
    system: buildAnalysisSystem(`The user has given a comment about the current output. Treat the comment as structured product feedback.

Classify the comment internally as one of: EDIT, RESEARCH_REQUEST, STYLE, ACTIONABLE_NOTES, or AMBIGUOUS.
Then revise the six-section output directly. If the comment is ambiguous, make the most useful conservative improvement and mention uncertainty inside the relevant section, not as an extra header.
Do not invent facts beyond the article unless the user explicitly asks for broader interpretation.`),
    messages: [
      { role: 'user', content: `Article:\n${articleText}` },
      { role: 'assistant', content: currentAnalysis.raw },
      { role: 'user', content: `User comment to apply:\n${comment}` }
    ]
  });

  $('btn-apply-comment').disabled = false;

  if (res?.error) {
    $('comment-status').textContent = '';
    showError(res.error);
    return;
  }

  renderAnalysis(parseAnalysis(res.result));
  chatHistory.push({ role: 'user', content: `Please revise the analysis based on this comment: ${comment}` });
  chatHistory.push({ role: 'assistant', content: res.result });

  await saveCommentLog(comment);
  $('comment-input').value = '';
  $('comment-status').textContent = 'Applied ✓';
  setTimeout(() => $('comment-status').textContent = '', 1800);
}

async function loadCommentLog() {
  const key = `comments:${article?.url || ''}`;
  const stored = await chrome.storage.local.get([key]);
  commentLog = stored[key] || [];
  renderCommentLog();
}

async function saveCommentLog(comment) {
  const key = `comments:${article?.url || ''}`;
  commentLog.unshift({
    comment,
    status: 'applied',
    ts: new Date().toISOString()
  });
  commentLog = commentLog.slice(0, 6);
  await chrome.storage.local.set({ [key]: commentLog });
  renderCommentLog();
}

function renderCommentLog() {
  const el = $('comment-log');
  if (!commentLog.length) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  el.innerHTML = commentLog.map(item =>
    `<div class="comment-item">${escapeHtml(item.comment)}<br><span>${escapeHtml(item.status)} · ${escapeHtml(item.ts.slice(0, 10))}</span></div>`
  ).join('');
}

async function sendChat(userMsg) {
  const messagesEl = $('chat-messages');

  chatHistory.push({ role: 'user', content: userMsg });

  const userBubble = document.createElement('div');
  userBubble.className = 'msg user';
  userBubble.textContent = userMsg;
  messagesEl.appendChild(userBubble);

  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'msg ai thinking';
  loadingBubble.textContent = '思考中...';
  messagesEl.appendChild(loadingBubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  $('btn-send').disabled = true;

  const res = await msg('callAI', {
    system: 'You are a reading assistant. Answer questions concisely based on the article the user has read. Respond in the same language the user uses.',
    messages: chatHistory
  });

  loadingBubble.remove();
  $('btn-send').disabled = false;

  const reply = res?.result || res?.error || 'Error, please try again.';
  chatHistory.push({ role: 'assistant', content: reply });

  const aiBubble = document.createElement('div');
  aiBubble.className = 'msg ai';
  aiBubble.innerHTML = formatText(reply);
  messagesEl.appendChild(aiBubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function buildCurrentNote() {
  return {
    date: new Date().toISOString().slice(0, 10),
    title: article?.title || '',
    url: article?.url || '',
    author: article?.author || '',
    summary: $('summary-text').innerText,
    corePoints: $('structure-text').innerText,
    insights: $('insights-text').innerText,
    readerValue: $('reader-value-text').innerText,
    conclusion: $('conclusion-text').innerText,
    authorIntent: $('author-text').innerText,
    myNotes: $('my-notes').value.trim(),
    comments: commentLog.map(item => item.comment)
  };
}

function noteToMarkdown(n) {
  return [
    `# ${n.title || 'Untitled WeChat Note'}`,
    '',
    `> ${n.date}${n.author ? ' · ' + n.author : ''}`,
    n.url ? `> ${n.url}` : '',
    '',
    '## Summary',
    n.summary,
    n.corePoints ? `\n## Core Points\n${n.corePoints}` : '',
    n.insights ? `\n## Key Insights\n${n.insights}` : '',
    n.readerValue ? `\n## Reader Value\n${n.readerValue}` : '',
    n.conclusion ? `\n## Core Conclusion\n${n.conclusion}` : '',
    n.authorIntent ? `\n## Author Intent\n${n.authorIntent}` : '',
    n.myNotes ? `\n## My Notes\n${n.myNotes}` : '',
    n.comments?.length ? `\n## Applied Comments\n${n.comments.map(c => `- ${c}`).join('\n')}` : ''
  ].filter(Boolean).join('\n');
}

function downloadMarkdown(note) {
  const blob = new Blob([noteToMarkdown(note)], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `reading-notes/${note.date}-${slugify(note.title)}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('btn-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('btn-detect').addEventListener('click', () => detectArticle());
$('btn-analyze').addEventListener('click', analyzeArticle);
$('btn-retry').addEventListener('click', () => detectArticle());
$('btn-apply-comment').addEventListener('click', applyComment);

$('btn-clear-chat').addEventListener('click', () => {
  $('chat-messages').innerHTML = '';
  chatHistory = chatHistory.slice(0, 2);
});

$('btn-send').addEventListener('click', () => {
  const input = $('chat-input');
  const text = input.value.trim();
  if (text) {
    input.value = '';
    sendChat(text);
  }
});

$('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('btn-send').click();
  }
});

$('btn-save-note').addEventListener('click', async () => {
  await msg('saveNote', { note: buildCurrentNote() });

  const btn = $('btn-save-note');
  btn.textContent = 'Saved';
  btn.style.background = '#333';
  setTimeout(() => {
    btn.textContent = 'Save Note';
    btn.style.background = '';
  }, 2000);
});

$('btn-export-current').addEventListener('click', () => {
  downloadMarkdown(buildCurrentNote());
});

detectArticle({ silent: true }).catch(error => showError(error.message));
