let article = null;
let chatHistory = [];

const $ = id => document.getElementById(id);

function showState(state) {
  ['state-no-article', 'state-loading', 'state-error', 'main-content', 'chat-section', 'article-bar']
    .forEach(id => $(id).classList.add('hidden'));

  if (state === 'ready') {
    $('article-bar').classList.remove('hidden');
    $('main-content').classList.remove('hidden');
    $('chat-section').classList.remove('hidden');
  } else if (state === 'loading') {
    $('state-loading').classList.remove('hidden');
  } else if (state === 'error') {
    $('state-error').classList.remove('hidden');
  } else {
    $('state-no-article').classList.remove('hidden');
  }
}

function msg(type, payload) {
  return new Promise(resolve => chrome.runtime.sendMessage({ type, ...payload }, resolve));
}

async function loadAndSummarize() {
  showState('loading');

  const result = await msg('getArticle');

  if (result?.error || !result?.content) {
    showState('error');
    $('error-message').textContent = result?.error || 'Could not read article. Make sure you\'re on a WeChat article page.';
    return;
  }

  article = result;
  $('article-title').textContent = article.title || 'Untitled';
  $('article-meta').textContent = [article.author, article.date].filter(Boolean).join(' · ');

  const truncated = article.content.slice(0, 6000);

  const system = `You are a reading assistant. Analyze the article and respond in the same language as the article content (Chinese or English).

Format your response EXACTLY like this (use these exact headers):

SUMMARY
[3–5 sentences covering the core argument and main points]

KEY INSIGHTS
• [insight]
• [insight]
• [insight]
• [insight if applicable]`;

  const res = await msg('callAI', {
    system,
    messages: [{
      role: 'user',
      content: `Title: ${article.title}\nAuthor: ${article.author}\nDate: ${article.date}\n\n${truncated}`
    }]
  });

  if (res?.error) {
    showState('error');
    $('error-message').textContent = res.error;
    return;
  }

  const text = res.result;

  const summaryMatch = text.match(/SUMMARY\s*([\s\S]*?)(?=KEY INSIGHTS|$)/i);
  const insightsMatch = text.match(/KEY INSIGHTS\s*([\s\S]*?)$/i);

  const summaryText = summaryMatch?.[1]?.trim() || text;
  const insightsText = insightsMatch?.[1]?.trim() || '';

  $('summary-text').innerHTML = summaryText.replace(/\n/g, '<br>');

  if (insightsText) {
    const items = insightsText
      .split('\n')
      .filter(l => l.trim())
      .map(l => `<li>${l.replace(/^[•\-\*]\s*/, '').trim()}</li>`)
      .join('');
    $('insights-text').innerHTML = `<ul>${items}</ul>`;
  }

  chatHistory = [
    { role: 'user', content: `Article title: ${article.title}\n\n${truncated}` },
    { role: 'assistant', content: text }
  ];

  showState('ready');
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
  loadingBubble.textContent = '思考中…';
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
  aiBubble.innerHTML = reply.replace(/\n/g, '<br>');
  messagesEl.appendChild(aiBubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Listeners
$('btn-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

$('btn-retry').addEventListener('click', loadAndSummarize);

$('btn-clear-chat').addEventListener('click', () => {
  $('chat-messages').innerHTML = '';
  chatHistory = chatHistory.slice(0, 2);
});

$('btn-send').addEventListener('click', () => {
  const input = $('chat-input');
  const text = input.value.trim();
  if (text) { input.value = ''; sendChat(text); }
});

$('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('btn-send').click(); }
});

$('btn-save-note').addEventListener('click', async () => {
  const note = {
    date: new Date().toISOString().slice(0, 10),
    title: article?.title || '',
    url: article?.url || '',
    author: article?.author || '',
    summary: $('summary-text').innerText,
    insights: $('insights-text').innerText,
    myNotes: $('my-notes').value.trim()
  };

  await msg('saveNote', { note });

  const btn = $('btn-save-note');
  btn.textContent = 'Saved ✓';
  btn.style.background = '#333';
  setTimeout(() => { btn.textContent = 'Save Note'; btn.style.background = ''; }, 2000);
});

// Init
loadAndSummarize();
