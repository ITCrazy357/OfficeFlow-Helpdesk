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
  "AVAILABLE" | "ASSIGNED" | "MAINTENANCE" | "RETIRED" | "LOST";

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
  supplierName?: string | null;
  supplierContact?: string | null;
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
  warranty?: "EXPIRING" | "EXPIRED";
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
  supplierName?: string;
  supplierContact?: string;
  notes?: string;
};

export type UpdateAssetInput = Partial<
  Omit<
    CreateAssetInput,
    | "brand"
    | "model"
    | "serialNumber"
    | "notes"
    | "supplierName"
    | "supplierContact"
  >
> & {
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
  supplierName?: string | null;
  supplierContact?: string | null;
};

export type MaintenanceKind = "MAINTENANCE" | "REPAIR" | "WARRANTY";
export type MaintenanceStatus = "PLANNED" | "COMPLETED" | "CANCELLED";
export type AssetMaintenance = {
  id: number;
  assetId: number;
  title: string;
  kind: MaintenanceKind;
  status: MaintenanceStatus;
  scheduledFor: string;
  performedOn: string | null;
  vendor: string | null;
  cost: string | null;
  notes: string | null;
  version: number;
  createdById: number;
  completedById: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type MaintenanceParams = {
  page?: number;
  limit?: number;
  status?: MaintenanceStatus;
};
export type MaintenanceInput = {
  title: string;
  kind: MaintenanceKind;
  scheduledFor: string;
  vendor?: string | null;
  notes?: string | null;
};
export type MaintenanceCommand =
  | { action: "create"; input: MaintenanceInput }
  | {
      action: "update";
      id: number;
      input: MaintenanceInput & { version: number };
    }
  | {
      action: "complete";
      id: number;
      input: {
        version: number;
        performedOn: string;
        cost: string | null;
        vendor: string | null;
        notes: string | null;
      };
    }
  | { action: "cancel"; id: number; input: { version: number } };
export type MaintenanceList = PaginatedData<AssetMaintenance>;
export type AssetCareOverview = {
  today: string;
  reminderDays: number;
  warrantySoon: number;
  warrantyExpired: number;
  maintenanceDue: number;
  warrantyAssets: Array<
    Pick<Asset, "id" | "assetTag" | "name" | "warrantyUntil" | "supplierName">
  >;
  maintenances: Array<
    AssetMaintenance & { asset: Pick<Asset, "id" | "assetTag" | "name"> }
  >;
};

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
