import { IsEnum } from 'class-validator';
import { AiTask } from '../types/ai-draft.type';

export class GenerateAiDraftDto {
  @IsEnum(AiTask)
  task!: AiTask;
}
