import {
  AssetStatus,
  AssetType,
  type Asset,
  type PrismaClient,
  type User,
} from '@prisma/client';
import { createRecordMap, shiftDays } from './seed.utils';

const assetSeeds = [
  {
    assetTag: 'LAP-0001',
    name: 'Dell Latitude 5440',
    type: AssetType.LAPTOP,
    status: AssetStatus.ASSIGNED,
    brand: 'Dell',
    model: 'Latitude 5440',
    serialNumber: 'DL5440-OF-001',
    assignedTo: 'employee-binh',
  },
  {
    assetTag: 'LAP-0002',
    name: 'HP EliteBook 840 G9',
    type: AssetType.LAPTOP,
    status: AssetStatus.AVAILABLE,
    brand: 'HP',
    model: 'EliteBook 840 G9',
    serialNumber: 'HP840G9-OF-002',
  },
  {
    assetTag: 'LAP-0003',
    name: 'MacBook Air M2',
    type: AssetType.LAPTOP,
    status: AssetStatus.ASSIGNED,
    brand: 'Apple',
    model: 'MacBook Air M2 13-inch',
    serialNumber: 'MBA-M2-OF-003',
    assignedTo: 'employee-thao',
  },
  {
    assetTag: 'LAP-0004',
    name: 'Lenovo ThinkPad T14 Gen 3',
    type: AssetType.LAPTOP,
    status: AssetStatus.MAINTENANCE,
    brand: 'Lenovo',
    model: 'ThinkPad T14 Gen 3',
    serialNumber: 'LNT14G3-OF-004',
  },
  {
    assetTag: 'LAP-0005',
    name: 'Dell Latitude 5420',
    type: AssetType.LAPTOP,
    status: AssetStatus.ASSIGNED,
    brand: 'Dell',
    model: 'Latitude 5420',
    serialNumber: 'DL5420-OF-005',
    assignedTo: 'manager-operations',
  },
  {
    assetTag: 'LAP-0006',
    name: 'ASUS ExpertBook B5',
    type: AssetType.LAPTOP,
    status: AssetStatus.AVAILABLE,
    brand: 'ASUS',
    model: 'ExpertBook B5',
    serialNumber: 'ASB5-OF-006',
  },
  {
    assetTag: 'LAP-0007',
    name: 'HP ProBook 450 G6',
    type: AssetType.LAPTOP,
    status: AssetStatus.RETIRED,
    brand: 'HP',
    model: 'ProBook 450 G6',
    serialNumber: 'HPP450-OF-007',
  },
  {
    assetTag: 'LAP-0008',
    name: 'Lenovo ThinkPad X1 Carbon',
    type: AssetType.LAPTOP,
    status: AssetStatus.LOST,
    brand: 'Lenovo',
    model: 'ThinkPad X1 Carbon Gen 8',
    serialNumber: 'LNX1C-OF-008',
  },
  {
    assetTag: 'DESK-0001',
    name: 'Dell OptiPlex 7090',
    type: AssetType.DESKTOP,
    status: AssetStatus.ASSIGNED,
    brand: 'Dell',
    model: 'OptiPlex 7090',
    serialNumber: 'DLOP7090-OF-009',
    assignedTo: 'employee-hung',
  },
  {
    assetTag: 'DESK-0002',
    name: 'HP ProDesk 400 G7',
    type: AssetType.DESKTOP,
    status: AssetStatus.AVAILABLE,
    brand: 'HP',
    model: 'ProDesk 400 G7',
    serialNumber: 'HPPD400-OF-010',
  },
  {
    assetTag: 'DESK-0003',
    name: 'Apple Mac mini M2',
    type: AssetType.DESKTOP,
    status: AssetStatus.ASSIGNED,
    brand: 'Apple',
    model: 'Mac mini M2',
    serialNumber: 'MACMINI-M2-011',
    assignedTo: 'employee-duc',
  },
  {
    assetTag: 'MON-0001',
    name: 'Dell P2422H 24 inch',
    type: AssetType.MONITOR,
    status: AssetStatus.ASSIGNED,
    brand: 'Dell',
    model: 'P2422H',
    serialNumber: 'DLP2422H-012',
    assignedTo: 'employee-binh',
  },
  {
    assetTag: 'MON-0002',
    name: 'LG 24MP60G 24 inch',
    type: AssetType.MONITOR,
    status: AssetStatus.AVAILABLE,
    brand: 'LG',
    model: '24MP60G',
    serialNumber: 'LG24MP60-013',
  },
  {
    assetTag: 'MON-0003',
    name: 'Dell U2422H 24 inch',
    type: AssetType.MONITOR,
    status: AssetStatus.ASSIGNED,
    brand: 'Dell',
    model: 'U2422H',
    serialNumber: 'DLU2422H-014',
    assignedTo: 'employee-lan',
  },
  {
    assetTag: 'MON-0004',
    name: 'Samsung S24R350',
    type: AssetType.MONITOR,
    status: AssetStatus.MAINTENANCE,
    brand: 'Samsung',
    model: 'S24R350',
    serialNumber: 'SMS24R350-015',
  },
  {
    assetTag: 'MON-0005',
    name: 'ASUS VA24EHE',
    type: AssetType.MONITOR,
    status: AssetStatus.AVAILABLE,
    brand: 'ASUS',
    model: 'VA24EHE',
    serialNumber: 'ASVA24-016',
  },
  {
    assetTag: 'PRN-0001',
    name: 'HP LaserJet Pro M404dn',
    type: AssetType.PRINTER,
    status: AssetStatus.AVAILABLE,
    brand: 'HP',
    model: 'LaserJet Pro M404dn',
    serialNumber: 'HPM404-017',
  },
  {
    assetTag: 'PRN-0002',
    name: 'Canon imageRUNNER 2425',
    type: AssetType.PRINTER,
    status: AssetStatus.MAINTENANCE,
    brand: 'Canon',
    model: 'imageRUNNER 2425',
    serialNumber: 'CNIR2425-018',
  },
  {
    assetTag: 'PHN-0001',
    name: 'iPhone 13 128GB',
    type: AssetType.PHONE,
    status: AssetStatus.ASSIGNED,
    brand: 'Apple',
    model: 'iPhone 13',
    serialNumber: 'IP13-OF-019',
    assignedTo: 'manager-it',
  },
  {
    assetTag: 'PHN-0002',
    name: 'Samsung Galaxy A54',
    type: AssetType.PHONE,
    status: AssetStatus.AVAILABLE,
    brand: 'Samsung',
    model: 'Galaxy A54',
    serialNumber: 'SMA54-OF-020',
  },
  {
    assetTag: 'TAB-0001',
    name: 'iPad Air Gen 5',
    type: AssetType.TABLET,
    status: AssetStatus.ASSIGNED,
    brand: 'Apple',
    model: 'iPad Air Gen 5',
    serialNumber: 'IPADAIR5-021',
    assignedTo: 'employee-mai',
  },
  {
    assetTag: 'NET-0001',
    name: 'Cisco CBS350-24T-4G',
    type: AssetType.NETWORK_DEVICE,
    status: AssetStatus.AVAILABLE,
    brand: 'Cisco',
    model: 'CBS350-24T-4G',
    serialNumber: 'CSCBS350-022',
  },
  {
    assetTag: 'NET-0002',
    name: 'UniFi U6 Pro Access Point',
    type: AssetType.NETWORK_DEVICE,
    status: AssetStatus.MAINTENANCE,
    brand: 'Ubiquiti',
    model: 'UniFi U6 Pro',
    serialNumber: 'UFU6PRO-023',
  },
  {
    assetTag: 'ACC-0001',
    name: 'Logitech MX Keys',
    type: AssetType.ACCESSORY,
    status: AssetStatus.AVAILABLE,
    brand: 'Logitech',
    model: 'MX Keys',
    serialNumber: 'LGMXKEYS-024',
  },
  {
    assetTag: 'ACC-0002',
    name: 'Logitech Zone Vibe 100',
    type: AssetType.ACCESSORY,
    status: AssetStatus.ASSIGNED,
    brand: 'Logitech',
    model: 'Zone Vibe 100',
    serialNumber: 'LGZV100-025',
    assignedTo: 'employee-phuong',
  },
] as const;

const historicalAssignments = [
  {
    id: 6101,
    assetTag: 'LAP-0001',
    assignedTo: 'employee-nam',
    assignedBy: 'it-linh',
    assignedDaysAgo: 240,
    returnedDaysAgo: 120,
    notes: 'Thu hồi để nâng cấp máy cho bộ phận Operations.',
  },
  {
    id: 6102,
    assetTag: 'LAP-0002',
    assignedTo: 'employee-lan',
    assignedBy: 'it-minh',
    assignedDaysAgo: 300,
    returnedDaysAgo: 45,
    notes: 'Nhân viên chuyển sang sử dụng máy khác.',
  },
  {
    id: 6103,
    assetTag: 'MON-0002',
    assignedTo: 'employee-thao',
    assignedBy: 'it-ha',
    assignedDaysAgo: 180,
    returnedDaysAgo: 30,
    notes: 'Thu hồi màn hình sau khi thay đổi vị trí làm việc.',
  },
  {
    id: 6104,
    assetTag: 'PRN-0001',
    assignedTo: 'employee-hung',
    assignedBy: 'admin',
    assignedDaysAgo: 360,
    returnedDaysAgo: 150,
    notes: 'Chuyển máy in về kho thiết bị dùng chung.',
  },
  {
    id: 6105,
    assetTag: 'PHN-0002',
    assignedTo: 'manager-operations',
    assignedBy: 'admin',
    assignedDaysAgo: 200,
    returnedDaysAgo: 80,
    notes: 'Thu hồi điện thoại dự án sau khi nghiệm thu.',
  },
  {
    id: 6106,
    assetTag: 'ACC-0001',
    assignedTo: 'employee-mai',
    assignedBy: 'it-quang',
    assignedDaysAgo: 120,
    returnedDaysAgo: 20,
    notes: 'Thiết bị đã được vệ sinh và nhập lại kho.',
  },
] as const;

export async function seedAssets(
  prisma: PrismaClient,
  users: Record<string, User>,
  now: Date,
) {
  const assets: Array<[string, Asset]> = [];

  for (const [index, seed] of assetSeeds.entries()) {
    const assignedToId =
      'assignedTo' in seed ? users[seed.assignedTo].id : null;
    const data = {
      name: seed.name,
      type: seed.type,
      status: seed.status,
      brand: seed.brand,
      model: seed.model,
      serialNumber: seed.serialNumber,
      purchaseDate: shiftDays(now, -(900 - index * 17)),
      warrantyUntil: shiftDays(now, 180 + index * 12),
      notes:
        seed.status === AssetStatus.MAINTENANCE
          ? 'Thiết bị đang được IT kiểm tra và bảo trì.'
          : 'Thiết bị thuộc danh mục quản lý nội bộ OfficeFlow.',
      assignedToId,
      createdAt: shiftDays(now, -(400 - index * 7)),
    };
    const asset = await prisma.asset.upsert({
      where: { assetTag: seed.assetTag },
      update: data,
      create: {
        assetTag: seed.assetTag,
        ...data,
      },
    });

    assets.push([seed.assetTag, asset]);
  }

  const assetMap = createRecordMap(assets);
  const assignedAssets = assetSeeds.filter(
    (seed) => seed.status === AssetStatus.ASSIGNED && 'assignedTo' in seed,
  );

  for (const [index, seed] of assignedAssets.entries()) {
    const data = {
      assetId: assetMap[seed.assetTag].id,
      assignedToId: users[seed.assignedTo].id,
      assignedById: users[index % 2 === 0 ? 'admin' : 'it-linh'].id,
      assignedAt: shiftDays(now, -(35 + index * 4)),
      returnedAt: null,
      returnNotes: null,
    };

    await prisma.assetAssignment.upsert({
      where: { id: 6001 + index },
      update: data,
      create: {
        id: 6001 + index,
        ...data,
      },
    });
  }

  for (const seed of historicalAssignments) {
    const data = {
      assetId: assetMap[seed.assetTag].id,
      assignedToId: users[seed.assignedTo].id,
      assignedById: users[seed.assignedBy].id,
      assignedAt: shiftDays(now, -seed.assignedDaysAgo),
      returnedAt: shiftDays(now, -seed.returnedDaysAgo),
      returnNotes: seed.notes,
    };

    await prisma.assetAssignment.upsert({
      where: { id: seed.id },
      update: data,
      create: {
        id: seed.id,
        ...data,
      },
    });
  }

  return assetMap;
}
