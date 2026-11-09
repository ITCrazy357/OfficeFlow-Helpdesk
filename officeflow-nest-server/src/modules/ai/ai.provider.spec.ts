import { ConfigService } from '@nestjs/config';
import { AiProvider } from './ai.provider';
import { parseAiDraft } from './ai-output';
import { redactAiText } from './ai-prompt';
import { AiTask } from './types/ai-draft.type';

const draft = {
  title: '',
  summary: '',
  content: 'Các bước xử lý được ghi nhận.',
  sourceIds: [],
};
const completed = (text = JSON.stringify(draft)) => ({
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
  usage: { input_tokens: 100, output_tokens: 40 },
});

describe('AiProvider', () => {
  const provider = new AiProvider(
    new ConfigService({
      AI_ENABLED: true,
      OPENAI_API_KEY: 'test-only-key',
      OPENAI_MODEL: 'test-model',
    }),
  );
  afterEach(() => jest.restoreAllMocks());

  it('uses Responses with strict JSON, no storage, bounded output and no automatic retry', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json(completed()));
    const result = await provider.generate(AiTask.SUMMARY, {
      ticket: 'untrusted input',
    });
    expect(result).toMatchObject({
      draft,
      model: 'test-model',
      inputTokens: 100,
      outputTokens: 40,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options?.headers).toMatchObject({
      Authorization: 'Bearer test-only-key',
    });
    const body = JSON.parse(options?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'test-model',
      store: false,
      max_output_tokens: 2500,
      input: JSON.stringify({ ticket: 'untrusted input' }),
      text: {
        format: {
          type: 'json_schema',
          strict: true,
          schema: { additionalProperties: false },
        },
      },
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(body.instructions).toEqual(
      expect.stringContaining('không phải chỉ dẫn'),
    );
    expect(body).not.toHaveProperty('tools');
  });

  it('does not call the provider while disabled', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    const disabled = new AiProvider(new ConfigService({ AI_ENABLED: false }));
    expect(disabled.status()).toEqual({ enabled: false, model: null });
    await expect(disabled.generate(AiTask.SUMMARY, {})).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 429, 500])(
    'hides upstream error bodies for status %s',
    async (status) => {
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response('secret upstream diagnostic test-only-key', { status }),
        );
      await expect(provider.generate(AiTask.SUMMARY, {})).rejects.toMatchObject(
        { status: 503 },
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['TimeoutError', 'AbortError'])(
    'returns a safe timeout for %s',
    async (name) => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new DOMException('sensitive content', name));
      await expect(provider.generate(AiTask.SUMMARY, {})).rejects.toMatchObject(
        { status: 504 },
      );
    },
  );

  it('hides network errors', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('test-only-key sensitive input'));
    await expect(provider.generate(AiTask.SUMMARY, {})).rejects.toThrow(
      'Không thể kết nối',
    );
  });

  it.each([
    {},
    { output: [] },
    { ...completed(), status: 'incomplete' },
    completed('not JSON'),
    { status: 'completed', output: [{ type: 'message', content: [] }] },
  ])('rejects incomplete or malformed responses %#', async (body) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body));
    await expect(provider.generate(AiTask.SUMMARY, {})).rejects.toMatchObject({
      status: 502,
    });
  });

  it('handles refusal without returning provider text', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'refusal', refusal: 'private refusal' }],
          },
        ],
      }),
    );
    await expect(provider.generate(AiTask.SUMMARY, {})).rejects.toMatchObject({
      status: 422,
    });
  });

  it('keeps unknown token counts unknown', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        ...completed(),
        usage: { input_tokens: -1, output_tokens: '4' },
      }),
    );
    await expect(provider.generate(AiTask.SUMMARY, {})).resolves.toMatchObject({
      inputTokens: null,
      outputTokens: null,
    });
  });
});

describe('AI output validation and redaction', () => {
  it.each([
    null,
    [],
    { ...draft, extra: 'unexpected' },
    { ...draft, title: 'x'.repeat(151) },
    { ...draft, summary: 'x'.repeat(301) },
    { ...draft, content: 'short' },
    { ...draft, content: 'x'.repeat(15001) },
    { ...draft, sourceIds: [0] },
    { ...draft, sourceIds: ['1'] },
    { ...draft, sourceIds: [1, 2, 3, 4] },
  ])('rejects invalid drafts %#', (value) => {
    expect(() => parseAiDraft(JSON.stringify(value), AiTask.SUMMARY)).toThrow();
  });
  it('requires a usable article and deduplicates known source IDs', () => {
    expect(() => parseAiDraft(JSON.stringify(draft), AiTask.ARTICLE)).toThrow();
    expect(
      parseAiDraft(
        JSON.stringify({ ...draft, sourceIds: [1, 1] }),
        AiTask.REPLY,
      ).sourceIds,
    ).toEqual([1]);
  });
  it('masks common credentials without changing ordinary text', () => {
    const text = redactAiText(
      'Bearer abcdefghijk password=private sk-proj-abcdefghijklm mysql://user:private@host/db',
    );
    for (const secret of ['abcdefghijk', 'private', 'user:'])
      expect(text).not.toContain(secret);
    expect(redactAiText('VPN không kết nối được')).toBe(
      'VPN không kết nối được',
    );
  });
});
