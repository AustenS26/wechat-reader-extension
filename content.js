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
    if (contentEl) {
      const clone = contentEl.cloneNode(true);
      clone.querySelectorAll('img, video, iframe, script, style').forEach(el => el.remove());
      content = clone.innerText.trim();
    }

    if (!content || content.length < 80) {
      sendResponse({
        error: 'Could not read article content. The page may still be loading or it may not be a WeChat article body.'
      });
      return true;
    }

    sendResponse({ title, author, date, content, url: window.location.href });
  }
  return true;
});
