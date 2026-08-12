import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createKnowledgeArticleApi,
  deleteKnowledgeArticleApi,
  getKnowledgeArticleApi,
  getKnowledgeArticlesApi,
  publishKnowledgeArticleApi,
  suggestKnowledgeArticlesApi,
  updateKnowledgeArticleApi,
} from "./api";
import type {
  CreateKnowledgeArticleInput,
  GetKnowledgeArticlesParams,
  SuggestKnowledgeArticlesInput,
  UpdateKnowledgeArticleInput,
} from "./types";

export const knowledgeQueryKeys = {
  all: ["knowledge"] as const,
  lists: () => [...knowledgeQueryKeys.all, "list"] as const,
  list: (params: GetKnowledgeArticlesParams) =>
    [...knowledgeQueryKeys.lists(), params] as const,
  detail: (id: number) => [...knowledgeQueryKeys.all, "detail", id] as const,
  suggestionLists: () => [...knowledgeQueryKeys.all, "suggestions"] as const,
  suggestions: (input: SuggestKnowledgeArticlesInput) =>
    [...knowledgeQueryKeys.suggestionLists(), input] as const,
};

function invalidateKnowledgeConsumers(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.lists() });
  queryClient.invalidateQueries({
    queryKey: knowledgeQueryKeys.suggestionLists(),
  });
}

export function useKnowledgeArticles(
  params: GetKnowledgeArticlesParams = {},
) {
  return useQuery({
    queryKey: knowledgeQueryKeys.list(params),
    queryFn: () => getKnowledgeArticlesApi(params),
  });
}

export function useKnowledgeArticle(id: number, enabled = true) {
  return useQuery({
    queryKey: knowledgeQueryKeys.detail(id),
    queryFn: () => getKnowledgeArticleApi(id),
    enabled,
    retry: false,
  });
}

export function useCreateKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateKnowledgeArticleInput) =>
      createKnowledgeArticleApi(input),
    onSuccess: (article) => {
      invalidateKnowledgeConsumers(queryClient);
      queryClient.setQueryData(knowledgeQueryKeys.detail(article.id), article);
    },
  });
}

export function useUpdateKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateKnowledgeArticleInput;
    }) => updateKnowledgeArticleApi(id, input),
    onSuccess: (article) => {
      invalidateKnowledgeConsumers(queryClient);
      queryClient.setQueryData(knowledgeQueryKeys.detail(article.id), article);
    },
  });
}

export function usePublishKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => publishKnowledgeArticleApi(id),
    onSuccess: (article) => {
      invalidateKnowledgeConsumers(queryClient);
      queryClient.setQueryData(knowledgeQueryKeys.detail(article.id), article);
    },
  });
}

export function useDeleteKnowledgeArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteKnowledgeArticleApi(id),
    onSuccess: (deleted) => {
      invalidateKnowledgeConsumers(queryClient);
      queryClient.removeQueries({
        queryKey: knowledgeQueryKeys.detail(deleted.id),
      });
    },
  });
}

export function useSuggestKnowledgeArticles(
  input: SuggestKnowledgeArticlesInput,
  enabled = true,
) {
  return useQuery({
    queryKey: knowledgeQueryKeys.suggestions(input),
    queryFn: () => suggestKnowledgeArticlesApi(input),
    enabled,
    retry: false,
  });
}
