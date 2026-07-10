import {
  TicketPriority,
  TicketStatus,
  UserRole,
  type Ticket,
  type User,
} from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma";

const DEFAULT_PASSWORD = "123456";

type SeedUser = {
  name: string;
  email: string;
  role: UserRole;
  department: string;
};

type SeedTicket = {
  title: string;
  legacyTitle?: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdByEmail: string;
  assignedToEmail?: string;
  category: string;
  dueDate?: string;
};

function getRequiredId(map: Map<string, number>, key: string, label: string) {
  const id = map.get(key);

  if (!id) {
    throw new Error(`${label} not found: ${key}`);
  }

  return id;
}

async function upsertTicket(ticket: SeedTicket, userIds: Map<string, number>, categoryIds: Map<string, number>) {
  const existingTicket = await prisma.ticket.findFirst({
    where: {
      OR: [
        { title: ticket.title },
        ...(ticket.legacyTitle ? [{ title: ticket.legacyTitle }] : []),
      ],
    },
  });

  const data = {
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    createdById: getRequiredId(userIds, ticket.createdByEmail, "Creator"),
    assignedToId: ticket.assignedToEmail
      ? getRequiredId(userIds, ticket.assignedToEmail, "Assignee")
      : null,
    categoryId: getRequiredId(categoryIds, ticket.category, "Category"),
    dueDate: ticket.dueDate ? new Date(ticket.dueDate) : null,
  };

  if (existingTicket) {
    return prisma.ticket.update({
      where: { id: existingTicket.id },
      data,
    });
  }

  return prisma.ticket.create({
    data,
  });
}

async function main() {
  const departments = ["IT", "HR", "Finance", "Marketing", "Operations", "Sales"];
  const departmentIds = new Map<string, number>();

  for (const name of departments) {
    const department = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    departmentIds.set(name, department.id);
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const seedUsers: SeedUser[] = [
    {
      name: "Admin An",
      email: "admin@officeflow.com",
      role: UserRole.ADMIN,
      department: "IT",
    },
    {
      name: "Manager Mai",
      email: "manager.mai@officeflow.com",
      role: UserRole.MANAGER,
      department: "Operations",
    },
    {
      name: "IT Nam",
      email: "it.nam@officeflow.com",
      role: UserRole.IT_STAFF,
      department: "IT",
    },
    {
      name: "IT Linh",
      email: "it.linh@officeflow.com",
      role: UserRole.IT_STAFF,
      department: "IT",
    },
    {
      name: "HR Hoa",
      email: "hr.hoa@officeflow.com",
      role: UserRole.EMPLOYEE,
      department: "HR",
    },
    {
      name: "Finance Minh",
      email: "finance.minh@officeflow.com",
      role: UserRole.EMPLOYEE,
      department: "Finance",
    },
    {
      name: "Marketing Lan",
      email: "marketing.lan@officeflow.com",
      role: UserRole.EMPLOYEE,
      department: "Marketing",
    },
    {
      name: "Sales Tuan",
      email: "sales.tuan@officeflow.com",
      role: UserRole.EMPLOYEE,
      department: "Sales",
    },
    {
      name: "Employee Binh",
      email: "employee1@officeflow.com",
      role: UserRole.EMPLOYEE,
      department: "Operations",
    },
  ];

  const userIds = new Map<string, number>();

  for (const user of seedUsers) {
    const savedUser: User = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
        isActive: true,
        departmentId: getRequiredId(departmentIds, user.department, "Department"),
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        departmentId: getRequiredId(departmentIds, user.department, "Department"),
      },
    });

    userIds.set(user.email, savedUser.id);
  }

  const categoryNames = [
    "Hardware",
    "Software",
    "Network",
    "Account",
    "Access Request",
    "Email",
    "Printer",
    "Security",
    "Other",
  ];
  const categoryIds = new Map<string, number>();

  for (const name of categoryNames) {
    const category = await prisma.ticketCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    categoryIds.set(name, category.id);
  }

  const seedTickets: SeedTicket[] = [
    {
      title: "HR Hoa không truy cập được cổng lương",
      legacyTitle: "HR Hoa cannot access payroll portal",
      description:
        "Cổng lương báo không có quyền truy cập sau khi đặt lại mật khẩu. Phòng HR cần xử lý trước kỳ chốt lương.",
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      createdByEmail: "hr.hoa@officeflow.com",
      assignedToEmail: "it.nam@officeflow.com",
      category: "Access Request",
      dueDate: "2026-07-15T09:00:00.000Z",
    },
    {
      title: "Finance Minh không mở được file hóa đơn",
      legacyTitle: "Finance Minh cannot open invoice spreadsheet",
      description:
        "Excel bị thoát đột ngột khi mở file hóa đơn nhà cung cấp trong thư mục dùng chung của phòng Finance.",
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      createdByEmail: "finance.minh@officeflow.com",
      assignedToEmail: "it.nam@officeflow.com",
      category: "Software",
      dueDate: "2026-07-16T09:00:00.000Z",
    },
    {
      title: "Marketing Lan không in được tài liệu chiến dịch",
      legacyTitle: "Marketing Lan printer not printing campaign briefs",
      description:
        "Máy in gần phòng họp A nhận lệnh in nhưng luôn dừng ở trạng thái đang xử lý đối với người dùng Marketing.",
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.MEDIUM,
      createdByEmail: "marketing.lan@officeflow.com",
      assignedToEmail: "it.linh@officeflow.com",
      category: "Printer",
      dueDate: "2026-07-12T10:00:00.000Z",
    },
    {
      title: "Sales Tuan cần cấp quyền VPN khi đi gặp khách hàng",
      legacyTitle: "Sales Tuan needs VPN access for client visit",
      description:
        "Bộ phận Sales cần truy cập VPN từ laptop công ty trước buổi gặp khách hàng doanh nghiệp trong tuần này.",
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      createdByEmail: "sales.tuan@officeflow.com",
      assignedToEmail: "it.linh@officeflow.com",
      category: "Network",
      dueDate: "2026-07-17T09:00:00.000Z",
    },
    {
      title: "Manager Mai yêu cầu laptop cho nhân viên mới",
      legacyTitle: "Manager Mai requests laptop for new hire",
      description:
        "Phòng Operations có nhân viên mới bắt đầu vào thứ Hai tới và cần chuẩn bị laptop đã cài các phần mềm tiêu chuẩn.",
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.MEDIUM,
      createdByEmail: "manager.mai@officeflow.com",
      assignedToEmail: "it.nam@officeflow.com",
      category: "Hardware",
      dueDate: "2026-07-20T09:00:00.000Z",
    },
    {
      title: "Employee Binh quên mật khẩu tài khoản",
      legacyTitle: "Employee Binh forgot account password",
      description:
        "Nhân viên không đăng nhập được vào helpdesk và email sau khi quay lại làm việc từ kỳ nghỉ.",
      status: TicketStatus.CLOSED,
      priority: TicketPriority.LOW,
      createdByEmail: "employee1@officeflow.com",
      assignedToEmail: "it.linh@officeflow.com",
      category: "Account",
      dueDate: "2026-07-11T09:00:00.000Z",
    },
    {
      title: "Wi-Fi văn phòng tầng 3 không ổn định",
      legacyTitle: "Office Wi-Fi unstable on floor 3",
      description:
        "Nhiều nhân viên báo kết nối bị rớt và họp video chậm tại khu làm việc mở ở tầng 3.",
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.URGENT,
      createdByEmail: "manager.mai@officeflow.com",
      assignedToEmail: "it.nam@officeflow.com",
      category: "Network",
      dueDate: "2026-07-13T08:00:00.000Z",
    },
    {
      title: "Cảnh báo antivirus trên laptop Finance",
      legacyTitle: "Antivirus alert on Finance laptop",
      description:
        "Hệ thống bảo mật phát hiện một file tải xuống đáng ngờ trên laptop của phòng Finance. Cần kiểm tra thiết bị trước khi sử dụng lại.",
      status: TicketStatus.OPEN,
      priority: TicketPriority.URGENT,
      createdByEmail: "finance.minh@officeflow.com",
      assignedToEmail: "it.linh@officeflow.com",
      category: "Security",
      dueDate: "2026-07-12T08:00:00.000Z",
    },
    {
      title: "Tạo tài khoản cho nhóm nhân viên mới",
      legacyTitle: "Create accounts for onboarding group",
      description:
        "Phòng HR cần tạo email, tài khoản helpdesk và quyền truy cập thư mục dùng chung cho ba nhân viên mới trong tháng này.",
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.HIGH,
      createdByEmail: "hr.hoa@officeflow.com",
      assignedToEmail: "it.nam@officeflow.com",
      category: "Account",
      dueDate: "2026-07-18T09:00:00.000Z",
    },
    {
      title: "Báo cáo dashboard tải chậm cho quản lý",
      legacyTitle: "Dashboard report loads slowly for manager",
      description:
        "Dashboard của Operations mất hơn 20 giây để tải các widget tổng hợp ticket trong lúc kiểm tra đầu ngày.",
      status: TicketStatus.CANCELLED,
      priority: TicketPriority.LOW,
      createdByEmail: "manager.mai@officeflow.com",
      assignedToEmail: "it.linh@officeflow.com",
      category: "Software",
      dueDate: "2026-07-19T09:00:00.000Z",
    },
  ];

  const savedTickets: Ticket[] = [];

  for (const ticket of seedTickets) {
    savedTickets.push(await upsertTicket(ticket, userIds, categoryIds));
  }

  console.log(
    `Seed data created successfully: ${seedUsers.length} users, ${categoryNames.length} categories, ${savedTickets.length} tickets.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
