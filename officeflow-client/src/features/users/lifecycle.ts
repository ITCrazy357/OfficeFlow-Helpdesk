import type { UserListItem } from "./types";

type AccountState = Pick<UserListItem, "id" | "role" | "isActive" | "isLocked">;

export function isAvailableAccount(
  user: Pick<AccountState, "isActive" | "isLocked">,
) {
  return user.isActive && !user.isLocked;
}

export function getHandoffCandidates<T extends AccountState>(
  users: T[],
  sourceId: number,
): T[] {
  return users.filter(
    (user) =>
      user.id !== sourceId &&
      isAvailableAccount(user) &&
      (user.role === "ADMIN" || user.role === "MANAGER"),
  );
}

export function isLastUsableAdmin(user: AccountState, users: AccountState[]) {
  return (
    user.role === "ADMIN" &&
    isAvailableAccount(user) &&
    !users.some(
      (other) =>
        other.id !== user.id &&
        other.role === "ADMIN" &&
        isAvailableAccount(other),
    )
  );
}

// Backend messages remain the fallback when an unrecognized business rule is added.
export function translateLifecycleMessage(message: string): string {
  const blockers =
    /^Cannot deactivate user: (\d+) active tickets, (\d+) assigned assets, (\d+) pending approvals, (\d+) active subordinates require handoff\.$/.exec(
      message,
    );
  if (blockers)
    return `Chưa thể vô hiệu hóa: còn ${blockers[1]} ticket đang xử lý, ${blockers[2]} tài sản đang giữ, ${blockers[3]} đơn nghỉ chờ duyệt và ${blockers[4]} nhân viên đang hoạt động cần bàn giao.`;
  const messages: Record<string, string> = {
    "Cannot remove the last usable administrator":
      "Phải giữ lại ít nhất một ADMIN đang hoạt động và không bị khóa.",
    "Cannot remove your own ADMIN role":
      "Bạn không thể tự bỏ quyền ADMIN của mình.",
    "Cannot deactivate your own account":
      "Bạn không thể tự vô hiệu hóa tài khoản đang đăng nhập.",
    "An active administrator is required":
      "Quyền hoặc trạng thái tài khoản của bạn đã thay đổi. Cần ADMIN đang hoạt động và không bị khóa để thực hiện.",
    "Reassign active tickets before changing this role":
      "Cần giao lại các ticket đang xử lý trước khi đổi sang vai trò này.",
    "Handoff pending approvals and active subordinates before changing this role":
      "Cần bàn giao đơn nghỉ chờ duyệt và nhân viên trực thuộc trước khi đổi vai trò.",
    "Reassign the unavailable manager before reactivating this user":
      "Cần bàn giao nhân viên này từ quản lý không còn hợp lệ sang quản lý khác trước khi kích hoạt lại.",
    "Replacement must be a different user":
      "Người nhận bàn giao phải khác người bàn giao.",
    "Replacement must be an active, unlocked MANAGER or ADMIN":
      "Người nhận phải là MANAGER hoặc ADMIN đang hoạt động và không bị khóa.",
    "Handoff would create a reporting cycle":
      "Không thể bàn giao cho người thuộc tuyến quản lý này vì sẽ tạo vòng lặp. Hãy chọn quản lý khác.",
    "Replacement cannot approve their own leave request":
      "Người nhận có đơn nghỉ trong nhóm cần bàn giao và không được tự duyệt. Hãy chọn người nhận khác.",
    "Data changed concurrently. Please try again":
      "Dữ liệu vừa được thay đổi bởi thao tác khác. Hãy kiểm tra lại danh sách rồi thử lại.",
  };
  return messages[message] ?? message;
}
