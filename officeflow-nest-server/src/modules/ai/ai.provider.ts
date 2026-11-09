import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { aiInstructions } from './ai-prompt';
import { AI_OUTPUT_SCHEMA, isRecord, parseAiDraft } from './ai-output';
import { AiTask } from './types/ai-draft.type';

@Injectable()
export class AiProvider {
  private readonly logger = new Logger(AiProvider.name);
  constructor(private readonly config: ConfigService) {}

  status() {
    const model = this.config.get<string>('OPENAI_MODEL')?.trim() || null;
    const enabled =
      this.config.get<boolean>('AI_ENABLED') === true &&
      Boolean(this.config.get<string>('OPENAI_API_KEY')?.trim()) &&
      model !== null;
    return { enabled, model: enabled ? model : null };
  }

  async generate(task: AiTask, context: unknown) {
    const { enabled, model } = this.status();
    if (!enabled || !model)
      throw new ServiceUnavailableException(
        'AI chưa được cấu hình trên máy chủ.',
      );
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.getOrThrow<string>('OPENAI_API_KEY').trim()}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(
          this.config.get<number>('OPENAI_TIMEOUT_MS') ?? 25_000,
        ),
        body: JSON.stringify({
          model,
          store: false,
          max_output_tokens:
            this.config.get<number>('OPENAI_MAX_OUTPUT_TOKENS') ?? 2500,
          instructions: aiInstructions(task),
          input: JSON.stringify(context),
          text: {
            format: {
              type: 'json_schema',
              name: 'officeflow_draft',
              strict: true,
              schema: AI_OUTPUT_SCHEMA,
            },
          },
        }),
      });
      if (!response.ok) {
        this.logger.warn({
          event: 'ai_provider_failed',
          status: response.status,
        });
        await response.body?.cancel();
        throw new ServiceUnavailableException(
          'Dịch vụ AI hiện chưa đáp ứng được yêu cầu. Vui lòng thử lại sau.',
        );
      }
      const body: unknown = await response.json();
      if (!isRecord(body) || !Array.isArray(body.output))
        throw new BadGatewayException('AI trả phản hồi không hợp lệ.');
      const text: string[] = [];
      for (const item of body.output as unknown[]) {
        if (
          !isRecord(item) ||
          item.type !== 'message' ||
          !Array.isArray(item.content)
        )
          continue;
        for (const part of item.content as unknown[]) {
          if (!isRecord(part)) continue;
          if (part.type === 'refusal')
            throw new UnprocessableEntityException(
              'AI không thể tạo bản nháp cho nội dung này. Vui lòng xử lý thủ công.',
            );
          if (part.type === 'output_text' && typeof part.text === 'string')
            text.push(part.text);
        }
      }
      if (body.status !== 'completed' || !text.length)
        throw new BadGatewayException(
          'AI chưa tạo xong bản nháp. Vui lòng thử lại hoặc nhập thủ công.',
        );
      const draft = parseAiDraft(text.join(''), task);
      const usage = isRecord(body.usage) ? body.usage : {};
      return {
        draft,
        model,
        inputTokens: this.tokenCount(usage.input_tokens),
        outputTokens: this.tokenCount(usage.output_tokens),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (
        isRecord(error) &&
        typeof error.name === 'string' &&
        ['TimeoutError', 'AbortError'].includes(error.name)
      )
        throw new GatewayTimeoutException(
          'AI phản hồi quá lâu. Vui lòng thử lại hoặc nhập thủ công.',
        );
      this.logger.warn({ event: 'ai_provider_unavailable' });
      throw new ServiceUnavailableException(
        'Không thể kết nối dịch vụ AI. Vui lòng thử lại sau.',
      );
    }
  }

  private tokenCount(value: unknown) {
    return typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? value
      : null;
  }
}
