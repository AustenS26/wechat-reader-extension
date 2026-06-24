chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// Provider definitions
const PROVIDERS = {
  anthropic: {
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-haiku-4-5-20251001',
    type: 'anthropic'
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o-mini',
    type: 'openai'
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    type: 'openai'
  },
  moonshot: {
    name: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.cn',
    defaultModel: 'moonshot-v1-8k',
    type: 'openai'
  },
  zhipu: {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas',
    defaultModel: 'glm-4-flash',
    type: 'openai'
  },
  custom: {
    name: 'Custom',
    baseUrl: '',
    defaultModel: '',
    type: 'openai'
  }
};

async function callAnthropic({ baseUrl, apiKey, model, system, messages }) {
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, max_tokens: 2048, system, messages })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${data.error?.message || res.statusText}`);
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

async function callOpenAICompat({ baseUrl, apiKey, model, system, messages }) {
  const oaiMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, max_tokens: 2048, messages: oaiMessages })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`AI API ${res.status}: ${data.error?.message || data.message || res.statusText}`);
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.choices[0].message.content;
}

async function callAI({ system, messages }) {
  const { providers = {}, activeProvider = 'anthropic' } = await chrome.storage.sync.get(['providers', 'activeProvider']);

  const providerConfig = providers[activeProvider];
  if (!providerConfig?.apiKey) {
    throw new Error(`No API key for "${PROVIDERS[activeProvider]?.name || activeProvider}". Configure in ⚙ Settings.`);
  }

  const def = PROVIDERS[activeProvider] || {};
  const baseUrl = (activeProvider === 'custom' ? providerConfig.baseUrl : def.baseUrl) || '';
  const model = providerConfig.model || def.defaultModel;
  const type = def.type || 'openai';

  if (type === 'anthropic') {
    return callAnthropic({ baseUrl, apiKey: providerConfig.apiKey, model, system, messages });
  } else {
    return callOpenAICompat({ baseUrl, apiKey: providerConfig.apiKey, model, system, messages });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'getArticle') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) { sendResponse({ error: 'No active tab' }); return; }
      if (!tabs[0].url?.startsWith('https://mp.weixin.qq.com/')) {
        sendResponse({ error: 'Open a WeChat article (mp.weixin.qq.com) first.' });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { type: 'extractArticle' }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: 'Open a WeChat article (mp.weixin.qq.com) first.' });
        } else {
          sendResponse(response);
        }
      });
    });
    return true;
  }

  if (message.type === 'callAI') {
    callAI({ system: message.system, messages: message.messages })
      .then(result => sendResponse({ result }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === 'getProviders') {
    sendResponse({ PROVIDERS });
    return false;
  }

  if (message.type === 'saveNote') {
    (async () => {
      const { notes = [] } = await chrome.storage.local.get(['notes']);
      notes.unshift(message.note);
      await chrome.storage.local.set({ notes });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'getNotes') {
    chrome.storage.local.get(['notes'], ({ notes = [] }) => sendResponse({ notes }));
    return true;
  }
});
