export function snapToViewport(position, size, threshold = 14) {
  const result = { ...position };
  if (position.x < threshold) result.x = 0;
  if (position.y < threshold) result.y = 0;

  const right = window.innerWidth - (position.x + size.width);
  const bottom = window.innerHeight - (position.y + size.height);

  if (right < threshold) result.x = Math.max(0, window.innerWidth - size.width);
  if (bottom < threshold) result.y = Math.max(0, window.innerHeight - size.height);
  return result;
}
