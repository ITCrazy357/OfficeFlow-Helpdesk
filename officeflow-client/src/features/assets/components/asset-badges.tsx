import {
  Archive,
  CircleCheck,
  CircleX,
  UserRoundCheck,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";

import {
  assetStatusMeta,
  getAssetTypeLabel,
} from "../constants";
import type { AssetStatus, AssetType } from "../types";

const statusIcons = {
  AVAILABLE: CircleCheck,
  ASSIGNED: UserRoundCheck,
  MAINTENANCE: Wrench,
  RETIRED: Archive,
  LOST: CircleX,
} satisfies Record<AssetStatus, typeof CircleCheck>;

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const meta = assetStatusMeta[status];
  const Icon = statusIcons[status];

  return (
    <Badge
      variant="outline"
      className={cn("motion-badge whitespace-nowrap", meta.className)}
    >
      <Icon className="size-3.5" />
      {meta.label}
    </Badge>
  );
}

export function AssetTypeBadge({ type }: { type: AssetType }) {
  return (
    <Badge variant="secondary" className="motion-badge whitespace-nowrap">
      {getAssetTypeLabel(type)}
    </Badge>
  );
}
