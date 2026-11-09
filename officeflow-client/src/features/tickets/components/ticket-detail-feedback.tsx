import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";

export function DetailSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="h-8 w-48 rounded-full bg-muted motion-shimmer" />
      <Card>
        <CardContent className="grid gap-4 pt-0">
          <div className="h-8 w-2/3 rounded-full bg-muted motion-shimmer" />
          <div className="h-28 rounded-lg bg-muted motion-shimmer" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-20 rounded-lg bg-muted motion-shimmer" />
            <div className="h-20 rounded-lg bg-muted motion-shimmer" />
            <div className="h-20 rounded-lg bg-muted motion-shimmer" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ErrorCard({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardContent className="flex items-start gap-3 pt-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <div className="grid gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{message}</CardDescription>
          </div>
          {onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              Thử lại
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
