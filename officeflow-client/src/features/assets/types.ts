import type { TicketPriority, TicketStatus } from "@/features/tickets/types";
import type { PaginatedData } from "@/types/api";

export type AssetType =
  | "LAPTOP"
  | "DESKTOP"
  | "MONITOR"
  | "PRINTER"
  | "PHONE"
  | "TABLET"
  | "NETWORK_DEVICE"
  | "ACCESSORY"
  | "OTHER";

export type AssetStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "MAINTENANCE"
  | "RETIRED"
  | "LOST";

export type ManualAssetStatus = Exclude<AssetStatus, "ASSIGNED">;

export type AssetUser = {
  id: number;
  name: string;
  email: string;
  department?: {
    id: number;
    name: string;
  } | null;
};

export type AssetTicketSummary = {
  id: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
};

export type Asset = {
  id: number;
  assetTag: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  notes?: string | null;
  assignedToId?: number | null;
  assignedTo?: AssetUser | null;
  tickets?: AssetTicketSummary[];
  _count?: {
    tickets?: number;
    assignments?: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type AssetAssignment = {
  id: number;
  assetId: number;
  assignedToId: number;
  assignedById: number;
  assignedAt: string;
  returnedAt?: string | null;
  returnNotes?: string | null;
  assignedTo: AssetUser;
  assignedBy: AssetUser;
};

export type AssetsList = PaginatedData<Asset>;

export type GetAssetsParams = {
  page?: number;
  limit?: number;
  type?: AssetType;
  status?: AssetStatus;
  assignedToId?: number;
  keyword?: string;
};

export type CreateAssetInput = {
  assetTag: string;
  name: string;
  type: AssetType;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  warrantyUntil?: string;
  notes?: string;
};

export type UpdateAssetInput = Partial<CreateAssetInput>;

export type AssignAssetInput = {
  userId: number;
};

export type AssignAssetResponse = {
  asset: Asset;
  assignment: AssetAssignment;
};

export type ReturnAssetInput = {
  notes?: string;
};

export type ChangeAssetStatusInput = {
  status: ManualAssetStatus;
};
