import { z } from "zod";
import type { CreateKnowledgeArticleInput } from "./types";

export const knowledgeArticleFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Tiêu đề ít nhất 3 ký tự")
    .max(150, "Tiêu đề tối đa 150 ký tự"),
  summary: z
    .string()
    .trim()
    .max(300, "Tóm tắt tối đa 300 ký tự")
    .optional(),
  content: z.string().trim().min(20, "Nội dung ít nhất 20 ký tự"),
  tags: z.string().trim().optional(),
  isPublished: z.boolean(),
});

export type KnowledgeArticleFormValues = z.infer<
  typeof knowledgeArticleFormSchema
>;

export function toKnowledgeArticlePayload(
  values: KnowledgeArticleFormValues,
): CreateKnowledgeArticleInput {
  const summary = values.summary?.trim();
  const tags = values.tags
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(",");

  return {
    title: values.title.trim(),
    summary: summary || undefined,
    content: values.content.trim(),
    tags: tags || undefined,
    isPublished: values.isPublished,
  };
}
