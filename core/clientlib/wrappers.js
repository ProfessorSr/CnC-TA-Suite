export function safeCall(target, methodName, ...args) {
  const method = target?.[methodName];
  if (typeof method !== 'function') return undefined;
  try {
    return method.apply(target, args);
  } catch {
    return undefined;
  }
}

export function getMainData(clientLib = window.ClientLib) {
  return clientLib?.Data?.MainData?.GetInstance?.();
}
