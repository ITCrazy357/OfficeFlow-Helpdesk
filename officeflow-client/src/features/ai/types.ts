export type AiTask = "SUMMARY" | "REPLY" | "ARTICLE";

export type AiStatus = {
  enabled: boolean;
  model: string | null;
  reason: "DISABLED" | "UNAVAILABLE" | null;
};

export type AiDraft = {
  task: AiTask;
  ticketId: number;
  title: string;
  summary: string;
  content: string;
  sourceIds: number[];
  model: string;
  generatedAt: string;
  sources: Array<{ id: number; title: string; updatedAt: string }>;
  context: {
    includedComments: number;
    totalComments: number;
    truncated: boolean;
  };
};
