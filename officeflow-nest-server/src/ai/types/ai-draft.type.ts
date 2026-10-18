export enum AiTask {
  SUMMARY = 'SUMMARY',
  REPLY = 'REPLY',
  ARTICLE = 'ARTICLE',
}

export type AiDraftContent = {
  title: string;
  summary: string;
  content: string;
  sourceIds: number[];
};

export type AiSource = { id: number; title: string; updatedAt: Date };

export type AiDraft = AiDraftContent & {
  task: AiTask;
  ticketId: number;
  model: string;
  generatedAt: string;
  sources: AiSource[];
  context: {
    includedComments: number;
    totalComments: number;
    truncated: boolean;
  };
};
