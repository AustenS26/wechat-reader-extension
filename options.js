const PROVIDER_DEFS = {
  anthropic: { name: 'Anthropic (Claude)', placeholder: 'sk-ant-…', modelPlaceholder: 'claude-haiku-4-5-20251001', showUrl: false },
  openai:    { name: 'OpenAI',             placeholder: 'sk-…',     modelPlaceholder: 'gpt-4o-mini',              showUrl: false },
  deepseek:  { name: 'DeepSeek',           placeholder: 'sk-…',     modelPlaceholder: 'deepseek-chat',            showUrl: false },
  moonshot:  { name: 'Moonshot (Kimi)',     placeholder: 'sk-…',     modelPlaceholder: 'moonshot-v1-8k',          showUrl: false },
  zhipu:     { name: '智谱 GLM',           placeholder: '…',        modelPlaceholder: 'glm-4-flash',             showUrl: false },
  custom:    { name: 'Custom',             placeholder: 'API Key',  modelPlaceholder: 'model name',              showUrl: true  }
};

let state = { providers: {}, activeProvider: 'anthropic' };

async function loadState() {
  const stored = await chrome.storage.sync.get(['providers', 'activeProvider']);
  state.providers = stored.providers || {};
  state.activeProvider = stored.activeProvider || 'anthropic';
}

async function saveProviderKey(id) {
  const keyInput = document.getElementById(`key-${id}`);
  const modelInput = document.getElementById(`model-${id}`);
  const urlInput = document.getElementById(`url-${id}`);
  const status = document.getElementById(`status-${id}`);

  const entry = {
    apiKey: keyInput?.value.trim() || '',
    model: modelInput?.value.trim() || '',
  };
  if (urlInput) entry.baseUrl = urlInput.value.trim();

  state.providers[id] = entry;
  await chrome.storage.sync.set({ providers: state.providers });

  status.textContent = 'Saved ✓';
  setTimeout(() => status.textContent = '', 2000);
}

async function setActive(id) {
  state.activeProvider = id;
  await chrome.storage.sync.set({ activeProvider: id });
  renderCards();
}

function renderCards() {
  const container = document.getElementById('providers-container');
  container.innerHTML = '';

  for (const [id, def] of Object.entries(PROVIDER_DEFS)) {
    const saved = state.providers[id] || {};
    const isActive = state.activeProvider === id;

    const card = document.createElement('div');
    card.className = `provider-card${isActive ? ' active' : ''}`;
    card.id = `card-${id}`;

    card.innerHTML = `
      <div class="card-header">
        <span class="provider-name">${def.name}</span>
        <span class="active-badge">Using</span>
      </div>

      ${def.showUrl ? `
      <div class="field">
        <label>Base URL</label>
        <input type="text" id="url-${id}" placeholder="https://your-api.com" value="${saved.baseUrl || ''}">
      </div>` : ''}

      <div class="field">
        <label>API Key</label>
        <input type="password" id="key-${id}" placeholder="${def.placeholder}" value="${saved.apiKey || ''}">
      </div>

      <div class="field">
        <label>Model</label>
        <input type="text" id="model-${id}" placeholder="${def.modelPlaceholder}" value="${saved.model || ''}">
      </div>

      <div class="card-footer">
        <button class="btn-use" id="use-${id}" ${isActive ? 'disabled' : ''}>${isActive ? 'Active' : 'Use this'}</button>
        <button class="btn-save-key" id="save-${id}">Save</button>
        <span class="save-status" id="status-${id}"></span>
      </div>
    `;

    container.appendChild(card);

    card.querySelector(`#save-${id}`).addEventListener('click', () => saveProviderKey(id));
    if (!isActive) {
      card.querySelector(`#use-${id}`).addEventListener('click', () => setActive(id));
    }
  }
}

// Notes
chrome.storage.local.get(['notes'], ({ notes = [] }) => {
  document.getElementById('notes-count').textContent =
    `${notes.length} note${notes.length !== 1 ? 's' : ''} saved`;
});

document.getElementById('btn-export').addEventListener('click', () => {
  chrome.storage.local.get(['notes'], ({ notes = [] }) => {
    if (!notes.length) { alert('No notes saved yet.'); return; }

    const md = notes.map(n => [
      `## ${n.title}`,
      `> ${n.date}${n.author ? ' · ' + n.author : ''}`,
      n.url ? `> ${n.url}` : '',
      '',
      '### Summary',
      n.summary,
      n.structure ? `\n### Article Structure\n${n.structure}` : '',
      '',
      '### Key Insights',
      n.insights,
      n.conclusion ? `\n### Core Conclusion\n${n.conclusion}` : '',
      n.authorIntent ? `\n### Author Intent\n${n.authorIntent}` : '',
      n.myNotes ? `\n### My Notes\n${n.myNotes}` : '',
      '\n---'
    ].filter(l => l !== null).join('\n')).join('\n\n');

    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wechat-notes-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
  });
});

// Init
loadState().then(renderCards);
