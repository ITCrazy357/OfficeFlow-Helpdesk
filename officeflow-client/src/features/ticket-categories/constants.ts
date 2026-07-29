const ticketCategoryLabelsVi: Record<string, string> = {
  hardware: "Phần cứng",
  "hardware issue": "Sự cố phần cứng",
  "hardware issues": "Sự cố phần cứng",
  software: "Phần mềm",
  "software issue": "Sự cố phần mềm",
  "software issues": "Sự cố phần mềm",
  network: "Mạng và kết nối",
  "network issue": "Sự cố mạng",
  "network issues": "Sự cố mạng",
  "network and connectivity": "Mạng và kết nối",
  account: "Tài khoản",
  "account issue": "Sự cố tài khoản",
  "account issues": "Sự cố tài khoản",
  "account and access": "Tài khoản và quyền truy cập",
  access: "Quyền truy cập",
  "access request": "Yêu cầu cấp quyền",
  email: "Email",
  "email issue": "Sự cố email",
  "email issues": "Sự cố email",
  "email and collaboration": "Email và cộng tác",
  printer: "Máy in",
  "printer issue": "Sự cố máy in",
  "printer issues": "Sự cố máy in",
  "printer and peripheral": "Máy in và thiết bị ngoại vi",
  security: "Bảo mật",
  "security issue": "Sự cố bảo mật",
  "security issues": "Sự cố bảo mật",
  "general support": "Hỗ trợ chung",
  general: "Chung",
  other: "Khác",
  others: "Khác",
};

function normalizeCategoryName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ");
}

export function getTicketCategoryLabel(name?: string | null) {
  if (!name?.trim()) {
    return "Chưa phân loại";
  }

  return ticketCategoryLabelsVi[normalizeCategoryName(name)] ?? name;
}
