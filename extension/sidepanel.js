let article = null;
let articleText = '';
let articleLanguage = 'zh';
let currentAnalysis = null;
let chatHistory = [];
let commentLog = [];
let analysisRules = [];
let selectedExcerpts = [];
const RULES_KEY = 'wechatReaderAnalysisRules';

const $ = id => document.getElementById(id);

const SECTION_HEADERS = [
  'SUMMARY',
  'CORE POINTS',
  'KEY INSIGHTS',
  'CORE EXCERPTS',
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

function stripMarkdownNoise(value = '') {
  return String(value)
    .replace(/\r/g, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .trim();
}

function formatText(value = '') {
  return escapeHtml(stripMarkdownNoise(value)).replace(/\n/g, '<br>');
}

function detectLanguage(text = '') {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return cjk >= latin ? 'zh' : 'en';
}

function slugify(value = 'wechat-note') {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'wechat-note';
}

function extractSection(text, header, nextHeaders) {
  const normalized = stripMarkdownNoise(text);
  if (!nextHeaders.length) {
    const pattern = new RegExp(String.raw`(?:^|\n)\s*(?:#{1,6}\s*)?${header}\s*([\s\S]*)$`, 'i');
    return normalized.match(pattern)?.[1]?.trim() || '';
  }
  const escapedNext = nextHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    String.raw`(?:^|\n)\s*(?:#{1,6}\s*)?${header}\s*([\s\S]*?)(?=(?:^|\n)\s*(?:#{1,6}\s*)?(?:${escapedNext.join('|')})\s*|$)`,
    'i'
  );
  return normalized.match(pattern)?.[1]?.trim() || '';
}

function parseAnalysis(text) {
  const cleaned = stripMarkdownNoise(text);
  return {
    raw: cleaned,
    summary: extractSection(cleaned, 'SUMMARY', SECTION_HEADERS.slice(1)),
    corePoints: extractSection(cleaned, 'CORE POINTS', SECTION_HEADERS.slice(2)),
    insights: extractSection(cleaned, 'KEY INSIGHTS', SECTION_HEADERS.slice(3)),
    excerpts: extractSection(cleaned, 'CORE EXCERPTS', SECTION_HEADERS.slice(4)),
    readerValue: extractSection(cleaned, 'READER VALUE', SECTION_HEADERS.slice(5)),
    conclusion: extractSection(cleaned, 'CORE CONCLUSION', SECTION_HEADERS.slice(6)),
    authorIntent: extractSection(cleaned, 'AUTHOR INTENT', [])
  };
}

function renderBullets(raw) {
  const items = stripMarkdownNoise(raw)
    .split('\n')
    .map(line => line.replace(/^\s*(?:[•\-\*①②③④⑤]|[0-9]+[.)])\s*/, '').trim())
    .filter(Boolean)
    .map(l => `<li>${linkParagraphRefs(escapeHtml(stripMarkdownNoise(l)))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function linkParagraphRefs(html) {
  return html.replace(/\[P([^\]]+)\]/g, (match, rawIds) => {
    const ids = String(rawIds)
      .split(/[\/,，\-—~]+/)
      .map(id => id.trim().replace(/\D/g, ''))
      .filter(Boolean);
    if (!ids.length) return match;
    const first = ids[0];
    const label = ids.length > 1 ? ids.map(id => `P${id}`).join('/') : `P${first}`;
    const extra = ids.length > 1 ? ` data-pids="${ids.join(',')}"` : '';
    return `<button class="para-ref" data-pid="${first}"${extra} title="Jump to paragraph ${label}">${label}</button>`;
  });
}

function extractFirstParagraphNumber(text = '') {
  const match = String(text).match(/\[P(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function parseParagraphIds(text = '') {
  const match = String(text).match(/\[P([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(/[\/,，\-—~]+/)
    .map(id => id.trim().replace(/\D/g, ''))
    .filter(Boolean);
}

function buildPreferenceBlock() {
  if (!analysisRules.length) return '';
  return `Standing user preferences:
${analysisRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}

These preferences are always on unless the user explicitly overrides them.`;
}

function buildChatSystem() {
  const preferenceBlock = buildPreferenceBlock();
  const languageRule = articleLanguage === 'en'
    ? 'Respond bilingually: English first, then Chinese.'
    : 'Respond in Chinese unless the user explicitly asks for English.';
  return `You are a reading assistant. Answer questions based on the article the user has read. Be concise, specific, and useful.
${languageRule}
${preferenceBlock ? `\n${preferenceBlock}\n` : '\n'}`.trim();
}

function renderAnalysis(analysis) {
  currentAnalysis = analysis;
  $('summary-text').innerHTML = formatText(analysis.summary);
  $('conclusion-text').innerHTML = formatText(analysis.conclusion);
  $('author-text').innerHTML = formatText(analysis.authorIntent);
  $('structure-text').innerHTML = analysis.corePoints ? renderBullets(analysis.corePoints) : '';
  $('insights-text').innerHTML = analysis.insights ? renderBullets(analysis.insights) : '';
  $('excerpts-text').innerHTML = renderExcerptCards(buildExcerptItems(analysis.excerpts, selectedExcerpts));
  $('reader-value-text').innerHTML = analysis.readerValue ? renderBullets(analysis.readerValue) : '';
}

function buildExcerptItems(aiExcerpts = '', userExcerpts = []) {
  const groups = new Map();

  const ensureGroup = (key, ids, sortKey, source = 'ai') => {
    const existing = groups.get(key);
    if (existing) {
      existing.sortKey = Math.min(existing.sortKey, sortKey);
      existing.sourceTypes.add(source);
      return existing;
    }
    const created = {
      key,
      sortKey,
      order: groups.size,
      paragraphIds: ids,
      sourceTypes: new Set([source]),
      aiSnippets: [],
      userEntries: []
    };
    groups.set(key, created);
    return created;
  };

  stripMarkdownNoise(aiExcerpts).split('\n').forEach(line => {
    const trimmed = stripMarkdownNoise(line).replace(/^\s*(?:[•\-\*①②③④⑤]|[0-9]+[.)])\s*/, '').trim();
    if (!trimmed) return;
    const paragraphIds = parseParagraphIds(trimmed);
    const key = paragraphIds.length ? paragraphIds.join('/') : `ai:${trimmed.toLowerCase()}`;
    const group = ensureGroup(key, paragraphIds, extractFirstParagraphNumber(trimmed), 'ai');
    const body = trimmed
      .replace(/^\[P[^\]]+\]\s*/, '')
      .replace(/^\s*"(.+)"\s*$/, '$1')
      .trim();
    if (!group.aiSnippets.includes(body)) group.aiSnippets.push(body);
  });

  userExcerpts.forEach(item => {
    const text = stripMarkdownNoise(String(item.text || '')).trim();
    if (!text) return;
    const ids = String(item.paragraphId || '')
      .split(/[\/,，\-—~]+/)
      .map(id => id.trim().replace(/\D/g, ''))
      .filter(Boolean);
    const key = ids.length ? ids.join('/') : `user:${text.toLowerCase()}`;
    const group = ensureGroup(key, ids, ids.length ? Number(ids[0]) : Number.POSITIVE_INFINITY, 'user');
    const note = stripMarkdownNoise(String(item.note || '')).trim();
    const exists = group.userEntries.some(entry =>
      entry.text.trim().toLowerCase() === text.toLowerCase() &&
      entry.note.trim().toLowerCase() === note.toLowerCase()
    );
    if (!exists) group.userEntries.push({ text, note });
  });

  return Array.from(groups.values())
    .sort((a, b) => a.sortKey - b.sortKey || a.order - b.order)
    .map(item => ({
      ...item,
      source: item.sourceTypes.has('user') ? 'user' : 'ai'
    }));
}

function renderExcerptCards(items = []) {
  if (!items.length) return '';
  return `<div class="excerpt-list">${items.map(item => {
    const ids = item.paragraphIds || [];
    const refLabel = ids.length ? ids.map(id => `P${id}`).join('/') : '';
    const refBtn = ids.length
      ? `<button class="para-ref" data-pid="${ids[0]}"${ids.length > 1 ? ` data-pids="${ids.join(',')}"` : ''} title="Jump to paragraph ${refLabel}">${refLabel}</button>`
      : '';
    const aiSnippets = (item.aiSnippets || []).map(s => escapeHtml(stripMarkdownNoise(s))).filter(Boolean);
    return `
      <div class="excerpt-card">
        <div class="excerpt-card-head">
          ${refBtn || ''}
          ${item.source === 'user' ? '<span class="excerpt-tag">Your note</span>' : '<span class="excerpt-tag muted">AI</span>'}
        </div>
        ${aiSnippets.length ? `<div class="excerpt-text">${aiSnippets.join('<br><br>')}</div>` : ''}
        ${(item.userEntries || []).map(entry => {
          const entryNote = escapeHtml(stripMarkdownNoise(entry.note || ''));
          return `
            <div class="excerpt-user-entry"
                 data-excerpt-text="${escapeHtml(entry.text)}"
                 data-excerpt-paragraph="${escapeHtml(ids.join('/'))}">
              <div class="excerpt-text user">${escapeHtml(entry.text)}</div>
              ${entryNote ? `<div class="excerpt-note"><span class="excerpt-note-label">Note</span>${entryNote}</div>` : '<div class="excerpt-note excerpt-note-empty">No note yet</div>'}
              <div class="excerpt-actions">
                <button class="excerpt-action excerpt-edit" data-excerpt-text="${escapeHtml(entry.text)}" data-excerpt-paragraph="${escapeHtml(ids.join('/'))}">Edit note</button>
                <button class="excerpt-action excerpt-delete" data-excerpt-text="${escapeHtml(entry.text)}" data-excerpt-paragraph="${escapeHtml(ids.join('/'))}">Delete</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }).join('')}</div>`;
}

function serializeExcerptItems(items = []) {
  if (!items.length) return '';
  const lines = [];

  items.forEach(item => {
    const ids = item.paragraphIds || [];
    const ref = ids.length ? `[P${ids.join('/')}] ` : '';
    const aiSnippets = (item.aiSnippets || []).map(s => stripMarkdownNoise(s)).filter(Boolean);
    const userEntries = item.userEntries || [];

    aiSnippets.forEach(snippet => {
      lines.push(`- ${ref}"${snippet}"`);
    });

    userEntries.forEach(entry => {
      const text = stripMarkdownNoise(entry.text || '').trim();
      if (!text) return;
      lines.push(`- ${ref}"${text}"`);
      const note = stripMarkdownNoise(entry.note || '').trim();
      if (note) lines.push(`  - Note: ${note}`);
    });
  });

  return lines.join('\n');
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
  const languageRule = articleLanguage === 'en'
    ? `The source article is English. Output every section bilingually: first English, then Chinese. Keep the Chinese concise but complete.`
    : `The source article is Chinese. Output in Chinese only unless a direct English translation helps clarify a proper noun or technical term.`;
  const preferenceBlock = buildPreferenceBlock();
  return `You are a reading assistant. Analyze the article and respond in the same language as the article content (Chinese or English).

Format your response EXACTLY using these section headers in this order. Do not add extra headers or change the names.
Inside the body of each section, avoid markdown decoration such as ###, **, __, or nested bullets unless the content absolutely requires a list.

Always prioritize substance over outline. The user does not need a simple article structure recap. Explain the core points clearly, extract a small number of strong insights, and evaluate the article from reader perspectives.
The article text is numbered by paragraph as [P1], [P2], etc. Use these paragraph ids when citing evidence. Keep excerpts short; do not quote long passages.
${languageRule}
${preferenceBlock ? `\n${preferenceBlock}\n` : '\n'}

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

CORE EXCERPTS
• [P12] [short excerpt or paraphrased evidence] — [why this part matters]
• [P23] [short excerpt or paraphrased evidence] — [what claim or insight it supports]
• [P31] [short excerpt or paraphrased evidence] — [why a reader should notice it]

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
  articleLanguage = result.language || detectLanguage(result.content || '');
  articleText = (article.paragraphs?.length
    ? article.paragraphs.map(p => `[P${p.id}] ${p.text}`).join('\n\n')
    : article.content
  ).slice(0, 10000);
  renderArticleBar();
  $('detected-message').textContent = `已识别：${article.title || 'Untitled'}\n正文约 ${article.content.length.toLocaleString()} 字符`;
  showState('detected');
  return true;
}

async function analyzeArticle() {
  if (!article && !(await detectArticle({ silent: true }))) return;
  if (!analysisRules.length) await loadAnalysisRules();

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
  await loadAnalysisRules();
  await loadSelectedExcerpts();
  showState('ready');
}

async function applyComment() {
  const comment = $('comment-input').value.trim();
  if (!comment || !currentAnalysis) return;
  if (!analysisRules.length) await loadAnalysisRules();

  $('btn-apply-comment').disabled = true;
  $('comment-status').textContent = 'Optimizing…';

  const res = await msg('callAI', {
    system: buildAnalysisSystem(`The user has given a comment about the current output. Treat the comment as structured product feedback.

Classify the comment internally as one of: EDIT, RESEARCH_REQUEST, STYLE, ACTIONABLE_NOTES, or AMBIGUOUS.
Then revise the seven-section output directly. If the comment is ambiguous, make the most useful conservative improvement and mention uncertainty inside the relevant section, not as an extra header.
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
  await maybeSaveAnalysisRule(comment);
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

async function loadAnalysisRules() {
  const stored = await chrome.storage.sync.get([RULES_KEY]);
  analysisRules = Array.isArray(stored[RULES_KEY]) ? stored[RULES_KEY] : [];
}

async function loadSelectedExcerpts() {
  if (!article?.url) {
    selectedExcerpts = [];
    return;
  }
  const key = `selectedExcerpts:${article.url}`;
  const stored = await chrome.storage.local.get([key]);
  selectedExcerpts = Array.isArray(stored[key]) ? stored[key] : [];
  renderCurrentExcerpts();
}

function renderCurrentExcerpts() {
  if (!currentAnalysis) return;
  $('excerpts-text').innerHTML = renderExcerptCards(buildExcerptItems(currentAnalysis.excerpts, selectedExcerpts));
}

function getExcerptIdentity(target) {
  return {
    text: String(target?.dataset.excerptText || '').trim(),
    paragraphId: String(target?.dataset.excerptParagraph || '').trim()
  };
}

async function updateExcerptNote(target) {
  const { text, paragraphId } = getExcerptIdentity(target);
  if (!text) return;
  const current = selectedExcerpts.find(item =>
    String(item.text || '').trim() === text && String(item.paragraphId || '').trim() === paragraphId
  );
  const next = window.prompt('Edit note', current?.note || '');
  if (next === null) return;
  const res = await msg('updateExcerptNote', {
    url: article?.url || '',
    text,
    paragraphId,
    note: next
  });
  if (res?.error) {
    showError(res.error);
  }
}

async function deleteExcerpt(target) {
  const { text, paragraphId } = getExcerptIdentity(target);
  if (!text) return;
  const ok = window.confirm('Delete this excerpt?');
  if (!ok) return;
  const res = await msg('deleteExcerpt', {
    url: article?.url || '',
    text,
    paragraphId
  });
  if (res?.error) {
    showError(res.error);
  }
}

function normalizeRule(rule) {
  return rule.replace(/\s+/g, ' ').trim();
}

function looksLikeStandingRule(comment) {
  const text = comment.toLowerCase();
  return /(^always\b|^default\b|^when\b|^prefer\b|^use\b|^don'?t\b|^never\b|^keep\b|^make\b|^ensure\b|默认|一直|以后|每次|不要|保持|优先|规则|输出)/i.test(text);
}

async function maybeSaveAnalysisRule(comment) {
  if (!looksLikeStandingRule(comment)) return;
  const rule = normalizeRule(comment);
  if (!rule || rule.length < 8) return;
  if (analysisRules.some(existing => existing.toLowerCase() === rule.toLowerCase())) return;
  analysisRules = [rule, ...analysisRules].slice(0, 20);
  await chrome.storage.sync.set({ [RULES_KEY]: analysisRules });
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
    system: buildChatSystem(),
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
  const excerptItems = buildExcerptItems(currentAnalysis?.excerpts || '', selectedExcerpts);
  return {
    date: new Date().toISOString().slice(0, 10),
    title: article?.title || '',
    url: article?.url || '',
    author: article?.author || '',
    language: articleLanguage,
    summary: $('summary-text').innerText,
    corePoints: $('structure-text').innerText,
    insights: $('insights-text').innerText,
    excerpts: serializeExcerptItems(excerptItems),
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
    n.language ? `> Language: ${n.language === 'en' ? 'English' : 'Chinese'}` : '',
    '',
    '## Summary',
    n.summary,
    n.corePoints ? `\n## Core Points\n${n.corePoints}` : '',
    n.insights ? `\n## Key Insights\n${n.insights}` : '',
    n.excerpts ? `\n## Core Excerpts\n${n.excerpts}` : '',
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
  a.download = `reading-notes_${note.date}-${slugify(note.title)}.md`;
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

$('comment-input').addEventListener('focus', () => {
  if (!analysisRules.length) loadAnalysisRules().catch(() => {});
});

$('main-content').addEventListener('click', async event => {
  const ref = event.target.closest('.para-ref');
  if (ref) {
    const pids = String(ref.dataset.pids || '').split(',').map(v => v.trim()).filter(Boolean);
    const res = await msg('scrollToParagraph', { paragraphId: ref.dataset.pid });
    if (res?.error) {
      $('comment-status').textContent = res.error;
      setTimeout(() => $('comment-status').textContent = '', 2400);
      return;
    }
    if (pids.length > 1) {
      showExcerptToast(`Jumped to P${ref.dataset.pid}; also referenced ${pids.slice(1).map(id => `P${id}`).join(', ')}`);
    }
    return;
  }

  const editBtn = event.target.closest('.excerpt-edit');
  if (editBtn) {
    await updateExcerptNote(editBtn);
    return;
  }

  const deleteBtn = event.target.closest('.excerpt-delete');
  if (deleteBtn) {
    await deleteExcerpt(deleteBtn);
    return;
  }
});

chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'selectedExcerptUpdated' && message.url === article?.url) {
    selectedExcerpts = Array.isArray(message.list) ? message.list : [];
    renderCurrentExcerpts();
    showExcerptToast('✦ Excerpt added');
  }
});

function showExcerptToast(text) {
  const toast = document.createElement('div');
  toast.textContent = text;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '16px', left: '50%',
    transform: 'translateX(-50%)',
    background: '#07c160', color: '#fff',
    padding: '5px 16px', borderRadius: '20px',
    fontSize: '12px', zIndex: '9999', pointerEvents: 'none'
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

Promise.all([loadAnalysisRules(), detectArticle({ silent: true })]).catch(error => showError(error.message));
