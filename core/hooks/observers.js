export function observeElement(selector, callback, root = document.documentElement) {
  const existing = document.querySelector(selector);
  if (existing) callback(existing);

  const observer = new MutationObserver(() => {
    const element = document.querySelector(selector);
    if (element) callback(element);
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
