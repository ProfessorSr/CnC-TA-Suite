export function snapToViewport(position, size, root, threshold = 14) {
  const bounds = root?.getBounds?.();

  if (!bounds) {
    return position;
  }

  const result = { ...position };

  if (position.x < threshold) result.x = 0;
  if (position.y < threshold) result.y = 0;

  const right = bounds.width - (position.x + size.width);
  const bottom = bounds.height - (position.y + size.height);

  if (right < threshold) {
    result.x = Math.max(0, bounds.width - size.width);
  }

  if (bottom < threshold) {
    result.y = Math.max(0, bounds.height - size.height);
  }

  return result;
}