(() => {
  const inject = (file, type = 'script') => {
    const el = document.createElement(type === 'style' ? 'link' : 'script');
    if (type === 'style') {
      el.rel = 'stylesheet';
      el.href = chrome.runtime.getURL(file);
    } else {
      el.src = chrome.runtime.getURL(file);
      el.onload = () => el.remove();
    }
    (document.head || document.documentElement).appendChild(el);
  };
  inject('suite.css', 'style');
  inject('suite.js');
})();
