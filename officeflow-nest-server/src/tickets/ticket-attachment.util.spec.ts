import { BadRequestException, FileTypeValidator } from '@nestjs/common';

import {
  ALLOWED_ATTACHMENT_FILE_TYPES,
  normalizeAttachmentFileName,
} from './ticket-attachment.util';

describe('ticket attachment utilities', () => {
  describe('ALLOWED_ATTACHMENT_FILE_TYPES', () => {
    const validator = new FileTypeValidator({
      fileType: ALLOWED_ATTACHMENT_FILE_TYPES,
    });

    it.each([
      [
        'JPEG',
        Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
        ]),
      ],
      [
        'PNG',
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x0d, 0x49, 0x48, 0x44, 0x52,
        ]),
      ],
      ['PDF', Buffer.from('%PDF-1.7\n')],
    ])('accepts a %s file from its magic number', async (_name, buffer) => {
      await expect(
        validator.isValid({
          buffer,
          mimetype: 'application/octet-stream',
        }),
      ).resolves.toBe(true);
    });

    it('rejects declared JPEG MIME when the file signature is invalid', async () => {
      await expect(
        validator.isValid({
          buffer: Buffer.from('plain text pretending to be an image'),
          mimetype: 'image/jpeg',
        }),
      ).resolves.toBe(false);
    });

    it('rejects an unsupported file detected from its signature', async () => {
      await expect(
        validator.isValid({
          buffer: Buffer.from('GIF89a'),
          mimetype: 'image/jpeg',
        }),
      ).resolves.toBe(false);
    });

    it.each([
      'image/jpeg-malicious',
      'image/pngfoo',
      'application/pdf-malicious',
      'video/mp4',
    ])('does not match the unsupported MIME value %s', (mimeType) => {
      expect(ALLOWED_ATTACHMENT_FILE_TYPES.test(mimeType)).toBe(false);
    });
  });

  describe('normalizeAttachmentFileName', () => {
    it('normalizes Unicode, path separators and control characters', () => {
      expect(
        normalizeAttachmentFileName(
          '  ..\\folder/\u0000\u001freport\u007f.pdf\n  ',
        ),
      ).toBe('.._folder_report.pdf');
      expect(normalizeAttachmentFileName('Ｒｅｐｏｒｔ.pdf')).toBe(
        'Report.pdf',
      );
    });

    it('rejects a name that is empty after normalization', () => {
      expect(() =>
        normalizeAttachmentFileName('\u0000\u001f\u007f\t\n'),
      ).toThrow(BadRequestException);
    });

    it('limits the stored name to 191 characters', () => {
      expect(normalizeAttachmentFileName('a'.repeat(200))).toHaveLength(191);
    });
  });
});
