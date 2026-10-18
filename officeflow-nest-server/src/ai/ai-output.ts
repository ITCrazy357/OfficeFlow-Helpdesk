import { BadGatewayException } from '@nestjs/common';
import { AiTask, type AiDraftContent } from './types/ai-draft.type';

export const AI_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    content: { type: 'string' },
    sourceIds: { type: 'array', items: { type: 'integer' } },
  },
  required: ['title', 'summary', 'content', 'sourceIds'],
  additionalProperties: false,
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAiDraft(text: string, task: AiTask): AiDraftContent {
  const invalid = () =>
    new BadGatewayException(
      'AI trả nội dung không hợp lệ. Vui lòng thử lại hoặc nhập thủ công.',
    );
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw invalid();
  }
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) => !['title', 'summary', 'content', 'sourceIds'].includes(key),
    )
  )
    throw invalid();
  const { title, summary, content, sourceIds } = value;
  if (
    typeof title !== 'string' ||
    typeof summary !== 'string' ||
    typeof content !== 'string' ||
    !Array.isArray(sourceIds)
  )
    throw invalid();
  if (
    title.trim().length > 150 ||
    summary.trim().length > 300 ||
    content.trim().length < 10 ||
    content.trim().length > 15_000 ||
    sourceIds.length > 3 ||
    sourceIds.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) < 1)
  )
    throw invalid();
  if (
    task === AiTask.ARTICLE &&
    (title.trim().length < 3 || content.trim().length < 20)
  )
    throw invalid();
  return {
    title: title.trim(),
    summary: summary.trim(),
    content: content.trim(),
    sourceIds: [...new Set(sourceIds as number[])],
  };
}
