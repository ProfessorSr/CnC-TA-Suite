export function getGameVersion() {
  const candidates = [
    window.ClientLib?.Data?.MainData?.GetInstance?.()?.get_Server?.()?.get_Version?.(),
    document.querySelector('meta[name="version"]')?.content
  ];
  return candidates.find(Boolean) || 'unknown';
}
