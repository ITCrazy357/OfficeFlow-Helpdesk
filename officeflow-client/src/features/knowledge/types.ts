import type { PaginatedData } from "@/types/api";
import type { TicketUser } from "@/features/tickets/types";

export type KnowledgeArticle = {
  id: number;
  title: string;
  slug: string;
  summary?: string | null;
  content?: string;
  tags?: string | null;
  isPublished: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  createdById?: number;
  createdBy?: TicketUser;
};

export type KnowledgeArticleDetail = KnowledgeArticle & {
  content: string;
  createdById: number;
};

export type GetKnowledgeArticlesParams = {
  page?: number;
  limit?: number;
  keyword?: string;
  tag?: string;
  isPublished?: boolean;
};

export type KnowledgeArticlesList = PaginatedData<KnowledgeArticle>;

export type CreateKnowledgeArticleInput = {
  title: string;
  summary?: string;
  content: string;
  tags?: string;
  isPublished?: boolean;
};

export type UpdateKnowledgeArticleInput =
  Partial<CreateKnowledgeArticleInput>;

export type SuggestKnowledgeArticlesInput = {
  title: string;
  description?: string;
};

export type KnowledgeSuggestion = Pick<
  KnowledgeArticle,
  "id" | "title" | "slug" | "summary" | "tags" | "viewCount" | "updatedAt"
>;

export type DeleteKnowledgeArticleResponse = {
  id: number;
};
