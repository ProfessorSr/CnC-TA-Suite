export function injectStyle(cssText, id = 'cnc-ta-suite-inline-style') {
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.append(style);
  }
  style.textContent = cssText;
  return style;
}
