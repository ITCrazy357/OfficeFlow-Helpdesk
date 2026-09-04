import { createHash } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';

type ThrottledRequest = {
  ip?: unknown;
  body?: {
    email?: unknown;
  };
};

export function isLoginRequest(context: ExecutionContext) {
  return (
    context.getClass().name === 'AuthController' &&
    context.getHandler().name === 'login'
  );
}

//lấy IP của client làm tracker.
export function getIpTracker(request: ThrottledRequest) {
  return typeof request.ip === 'string' && request.ip.length > 0
    ? request.ip
    : 'unknown';
}

//lấy email account đang đăng nhập làm tracker.
export function getLoginAccountTracker(request: ThrottledRequest) {
  const email =
    typeof request.body?.email === 'string'
      ? request.body.email.trim().toLowerCase()
      : 'invalid';

  return createHash('sha256').update(email).digest('hex');
}

//lấy cặp IP và email account làm tracker.
export function getLoginPairTracker(request: ThrottledRequest) {
  return `${getIpTracker(request)}:${getLoginAccountTracker(request)}`;
}

export function createRateLimitKeyGenerator(keyPrefix: string) {
  return (
    context: ExecutionContext,
    tracker: string,
    throttlerName: string,
  ) => {
    const route = `${context.getClass().name}:${context.getHandler().name}`;
    const digest = createHash('sha256')
      .update(`${route}:${throttlerName}:${tracker}`)
      .digest('hex');

    return `${keyPrefix}:${digest}`;
  };
}
