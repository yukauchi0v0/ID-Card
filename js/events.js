const listeners = new Map();

export function on(name, handler) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(handler);
  return () => listeners.get(name)?.delete(handler);
}

export function emit(name, detail) {
  const handlers = listeners.get(name);
  if (!handlers) return;
  for (const handler of [...handlers]) handler(detail);
}
