import { BadRequestException } from '@nestjs/common';
import { IsByteLength } from 'class-validator';

const MAX_NEW_PASSWORD_BYTES = 72;
const MESSAGE = 'New password must not exceed 72 UTF-8 bytes';

export function NewPasswordByteLength() {
  return IsByteLength(0, MAX_NEW_PASSWORD_BYTES, { message: MESSAGE });
}

// Services also enforce this for callers that do not pass through DTO pipes.
export function assertNewPasswordBytes(password: string) {
  if (Buffer.byteLength(password, 'utf8') > MAX_NEW_PASSWORD_BYTES) {
    throw new BadRequestException(MESSAGE);
  }
}
