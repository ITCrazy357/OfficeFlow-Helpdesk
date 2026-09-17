import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = Readonly<{
  requestId: string;
}>;

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return storage.run(context, callback);
}

export function getCurrentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
