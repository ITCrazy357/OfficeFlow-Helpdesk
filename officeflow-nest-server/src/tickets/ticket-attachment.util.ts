import { BadRequestException } from '@nestjs/common';

const MAX_ATTACHMENT_FILE_NAME_LENGTH = 191;

export const ALLOWED_ATTACHMENT_FILE_TYPES =
  /^(?:image\/jpeg|image\/png|application\/pdf)$/;

function removeControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0);

      return codePoint !== undefined && codePoint > 0x1f && codePoint !== 0x7f;
    })
    .join('');
}

export function normalizeAttachmentFileName(value: string): string {
  const normalized = removeControlCharacters(value.normalize('NFKC'))
    .replace(/[\\/]/g, '_')
    .trim();

  if (!normalized) {
    throw new BadRequestException('Attachment file name is invalid');
  }

  return normalized.slice(0, MAX_ATTACHMENT_FILE_NAME_LENGTH);
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function createAttachmentContentDisposition(fileName: string): string {
  const asciiFallback = fileName
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
    .trim();

  return `attachment; filename="${asciiFallback || 'attachment'}"; filename*=UTF-8''${encodeRfc5987Value(fileName)}`;
}
