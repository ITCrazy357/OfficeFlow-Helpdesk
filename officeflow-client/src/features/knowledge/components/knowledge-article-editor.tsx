"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KnowledgeArticleForm } from "@/features/knowledge/components/knowledge-article-form";
import {
  useCreateKnowledgeArticle,
  useKnowledgeArticle,
  useUpdateKnowledgeArticle,
} from "@/features/knowledge/hooks";
import { type KnowledgeArticleFormValues } from "@/features/knowledge/schemas";
import type { KnowledgeArticleDetail } from "@/features/knowledge/types";
import type { Dispatch, SetStateAction } from "react";
import type { FormMode } from "../knowledge-page-types";

type Props = {
  formMode: Exclude<FormMode, null>;
  detailQuery: ReturnType<typeof useKnowledgeArticle>;
  selectedArticle: KnowledgeArticleDetail | undefined;
  createArticle: ReturnType<typeof useCreateKnowledgeArticle>;
  updateArticle: ReturnType<typeof useUpdateKnowledgeArticle>;
  formError: string | null;
  setFormMode: Dispatch<SetStateAction<FormMode>>;
  setFormError: Dispatch<SetStateAction<string | null>>;
  handleFormSubmit: (values: KnowledgeArticleFormValues) => Promise<void>;
};
export function KnowledgeArticleEditor({
  formMode,
  detailQuery,
  selectedArticle,
  createArticle,
  updateArticle,
  formError,
  setFormMode,
  setFormError,
  handleFormSubmit,
}: Props) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <CardTitle>
          {formMode === "create" ? "Tạo bài viết" : "Sửa bài viết"}
        </CardTitle>
        <CardDescription>
          Nội dung càng rõ thì nhân viên càng tự xử lý nhanh hơn.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {formMode === "edit" && detailQuery.isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-12 rounded-lg bg-muted motion-shimmer"
              />
            ))}
          </div>
        ) : (
          <KnowledgeArticleForm
            key={
              formMode === "edit" ? (selectedArticle?.id ?? "edit") : "create"
            }
            defaultValues={
              formMode === "edit" && selectedArticle
                ? {
                    title: selectedArticle.title,
                    summary: selectedArticle.summary ?? "",
                    content: selectedArticle.content,
                    tags: selectedArticle.tags ?? "",
                    isPublished: selectedArticle.isPublished,
                  }
                : undefined
            }
            submitLabel={
              formMode === "create" ? "Tạo bài viết" : "Lưu thay đổi"
            }
            isSubmitting={createArticle.isPending || updateArticle.isPending}
            error={formError}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
            onSubmit={handleFormSubmit}
          />
        )}
      </CardContent>
    </Card>
  );
}
