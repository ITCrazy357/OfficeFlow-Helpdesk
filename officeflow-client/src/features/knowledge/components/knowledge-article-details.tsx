"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useDeleteKnowledgeArticle,
  usePublishKnowledgeArticle,
} from "@/features/knowledge/hooks";
import type { KnowledgeArticleDetail } from "@/features/knowledge/types";
import { CheckCircle2, Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { formatDateTime, parseTags } from "../article-presentation";
import type { FormMode } from "../knowledge-page-types";
import { KnowledgeStatusBadge } from "./knowledge-status-badge";

type Props = {
  selectedArticle: KnowledgeArticleDetail;
  formError: string | null;
  deleteError: string | null;
  selectedCanMutate: boolean;
  setFormMode: Dispatch<SetStateAction<FormMode>>;
  setFormError: Dispatch<SetStateAction<string | null>>;
  handlePublish: () => Promise<void>;
  publishArticle: ReturnType<typeof usePublishKnowledgeArticle>;
  setIsDeleteConfirmOpen: Dispatch<SetStateAction<boolean>>;
  deleteArticle: ReturnType<typeof useDeleteKnowledgeArticle>;
  isDeleteConfirmOpen: boolean;
  handleDelete: () => Promise<void>;
};
export function KnowledgeArticleDetails({
  selectedArticle,
  formError,
  deleteError,
  selectedCanMutate,
  setFormMode,
  setFormError,
  handlePublish,
  publishArticle,
  setIsDeleteConfirmOpen,
  deleteArticle,
  isDeleteConfirmOpen,
  handleDelete,
}: Props) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <KnowledgeStatusBadge isPublished={selectedArticle.isPublished} />
          <Badge variant="outline" className="motion-badge">
            <Eye className="size-3.5" />
            {selectedArticle.viewCount} lượt xem
          </Badge>
        </div>
        <CardTitle className="mt-3 text-xl leading-snug">
          {selectedArticle.title}
        </CardTitle>
        <CardDescription>
          {selectedArticle.summary || "Bài viết này chưa có phần tóm tắt."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 pt-0">
        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
            {selectedArticle.content}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {parseTags(selectedArticle.tags).length ? (
            parseTags(selectedArticle.tags).map((tag) => (
              <Badge key={tag} variant="secondary" className="motion-badge">
                {tag}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">Chưa có tag</Badge>
          )}
        </div>

        <div className="grid gap-3 rounded-lg border bg-card p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Người tạo</span>
            <span className="font-medium">
              {selectedArticle.createdBy?.name ?? "-"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Cập nhật</span>
            <span className="font-medium">
              {formatDateTime(selectedArticle.updatedAt)}
            </span>
          </div>
        </div>

        {formError ? (
          <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
            {formError}
          </div>
        ) : null}

        {deleteError ? (
          <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
            {deleteError}
          </div>
        ) : null}

        {selectedCanMutate ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormMode("edit");
                  setFormError(null);
                }}
              >
                <Pencil className="size-4" />
                Sửa
              </Button>
              {!selectedArticle.isPublished ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePublish}
                  disabled={publishArticle.isPending}
                >
                  {publishArticle.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Xuất bản
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleteConfirmOpen((value) => !value)}
                disabled={deleteArticle.isPending}
              >
                <Trash2 className="size-4" />
                Xóa
              </Button>
            </div>

            {isDeleteConfirmOpen ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 motion-toast">
                <p className="text-sm font-medium text-destructive">
                  Xóa bài viết này khỏi Knowledge Base?
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDeleteConfirmOpen(false)}
                    disabled={deleteArticle.isPending}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleteArticle.isPending}
                  >
                    {deleteArticle.isPending ? "Đang xóa..." : "Xác nhận"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
