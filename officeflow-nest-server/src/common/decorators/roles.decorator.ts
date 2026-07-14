import { SetMetadata } from '@nestjs/common'; // Sử dụng để tạo metadata cho decorator Roles, có thể được đọc bởi Reflector trong RolesGuard
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
