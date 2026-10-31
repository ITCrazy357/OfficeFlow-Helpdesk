// Web Locks coordinates tabs without persisting or broadcasting credentials.
const SESSION_LOCK = "officeflow-auth-session-v1";
let localQueue: Promise<void> = Promise.resolve();

export function withSessionLock<T>(work: () => Promise<T>): Promise<T> {
  const pending = localQueue.then(async () => {
    if (typeof window !== "undefined" && window.navigator.locks) {
      return await window.navigator.locks.request(SESSION_LOCK, work);
    }
    return await work();
  });
  localQueue = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}

export function assertRefreshCoordination() {
  if (typeof window !== "undefined" && !window.navigator.locks) {
    throw new Error(
      "Trình duyệt chưa hỗ trợ khôi phục phiên an toàn. Hãy cập nhật trình duyệt hoặc đăng nhập lại.",
    );
  }
}
