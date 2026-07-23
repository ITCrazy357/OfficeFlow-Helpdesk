import { api } from "@/lib/axios";
import type { ApiResponse, Pagination } from "@/types/api";
import type {
  CreateKnowledgeArticleInput,
  DeleteKnowledgeArticleResponse,
  GetKnowledgeArticlesParams,
  KnowledgeArticle,
  KnowledgeArticleDetail,
  KnowledgeSuggestion,
  SuggestKnowledgeArticlesInput,
  UpdateKnowledgeArticleInput,
} from "./types";

type BackendKnowledgeArticlesData = {
  data?: KnowledgeArticle[];
  items?: KnowledgeArticle[];
  pagination: Pagination;
};

export async function getKnowledgeArticlesApi(
  params: GetKnowledgeArticlesParams = {},
) {
  const res = await api.get<ApiResponse<BackendKnowledgeArticlesData>>(
    "/knowledge",
    { params },
  );

  const payload = res.data.data;

  return {
    items: payload.items ?? payload.data ?? [],
    pagination: payload.pagination,
  };
}

export async function getKnowledgeArticleApi(id: number) {
  const res = await api.get<ApiResponse<KnowledgeArticleDetail>>(
    `/knowledge/${id}`,
  );

  return res.data.data;
}

export async function createKnowledgeArticleApi(
  input: CreateKnowledgeArticleInput,
) {
  const res = await api.post<ApiResponse<KnowledgeArticleDetail>>(
    "/knowledge",
    input,
  );

  return res.data.data;
}

export async function updateKnowledgeArticleApi(
  id: number,
  input: UpdateKnowledgeArticleInput,
) {
  const res = await api.patch<ApiResponse<KnowledgeArticleDetail>>(
    `/knowledge/${id}`,
    input,
  );

  return res.data.data;
}

export async function publishKnowledgeArticleApi(id: number) {
  const res = await api.patch<ApiResponse<KnowledgeArticleDetail>>(
    `/knowledge/${id}/publish`,
  );

  return res.data.data;
}

export async function deleteKnowledgeArticleApi(id: number) {
  const res = await api.delete<ApiResponse<DeleteKnowledgeArticleResponse>>(
    `/knowledge/${id}`,
  );

  return res.data.data;
}

export async function suggestKnowledgeArticlesApi(
  input: SuggestKnowledgeArticlesInput,
) {
  const res = await api.post<ApiResponse<KnowledgeSuggestion[]>>(
    "/knowledge/suggest-for-ticket",
    input,
  );

  return res.data.data;
}
