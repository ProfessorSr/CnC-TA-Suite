export function element(tag, {
  className,
  text,
  html,
  attributes = {},
  children = []
} = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (html !== undefined) node.innerHTML = html;
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) node.setAttribute(name, String(value));
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

export function ensureRoot() {
  let root = document.getElementById('cnc-ta-suite-root');
  if (!root) {
    root = element('div', { attributes: { id: 'cnc-ta-suite-root' } });
    document.body.append(root);
  }
  return root;
}
