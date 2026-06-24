chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'extractArticle') {
    if (!location.hostname.includes('mp.weixin.qq.com')) {
      sendResponse({ error: 'Open a WeChat article (mp.weixin.qq.com) first.' });
      return true;
    }

    const title = (
      document.querySelector('#activity-name') ||
      document.querySelector('.rich_media_title')
    )?.innerText?.trim() || document.title;

    const author = (
      document.querySelector('#js_name') ||
      document.querySelector('.profile_nickname')
    )?.innerText?.trim() || '';

    const date = (
      document.querySelector('#publish_time') ||
      document.querySelector('.rich_media_meta_text')
    )?.innerText?.trim() || '';

    const contentEl = (
      document.querySelector('#js_content') ||
      document.querySelector('.rich_media_content')
    );

    let content = '';
    let paragraphs = [];
    if (contentEl) {
      const clone = contentEl.cloneNode(true);
      clone.querySelectorAll('img, video, iframe, script, style').forEach(el => el.remove());
      content = clone.innerText.trim();

      paragraphs = Array.from(contentEl.querySelectorAll('p, section, blockquote, li'))
        .map((el, index) => {
          const text = el.innerText?.replace(/\s+/g, ' ').trim() || '';
          if (!text || text.length < 12) return null;
          el.dataset.wraiParagraph = String(index + 1);
          return { id: index + 1, text };
        })
        .filter(Boolean)
        .slice(0, 180);

      if (!paragraphs.length) {
        paragraphs = content
          .split(/\n{2,}/)
          .map(text => text.replace(/\s+/g, ' ').trim())
          .filter(text => text.length >= 12)
          .map((text, index) => ({ id: index + 1, text }))
          .slice(0, 180);
      }
    }

    const languageBase = `${title}\n${content}`;
    const cjk = (languageBase.match(/[\u4e00-\u9fff]/g) || []).length;
    const latin = (languageBase.match(/[A-Za-z]/g) || []).length;
    const language = cjk >= latin ? 'zh' : 'en';

    if (!content || content.length < 80) {
      sendResponse({
        error: 'Could not read article content. The page may still be loading or it may not be a WeChat article body.'
      });
      return true;
    }

    sendResponse({ title, author, date, content, paragraphs, language, url: window.location.href });
  }

  if (message.type === 'scrollToParagraph') {
    const id = String(message.paragraphId || '').replace(/\D/g, '');
    const target = document.querySelector(`[data-wrai-paragraph="${id}"]`);
    if (!target) {
      sendResponse({ error: `Paragraph P${id} was not found on the page.` });
      return true;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.transition = 'background 0.2s ease';
    target.style.background = 'rgba(7, 193, 96, 0.16)';
    setTimeout(() => {
      target.style.background = '';
    }, 1800);
    sendResponse({ ok: true });
  }
  return true;
});
