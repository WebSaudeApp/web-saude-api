import { User, UserRole } from '@prisma/client';

export class UserResponseDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string;
  role!: UserRole;
  emailVerified!: boolean;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerified: user.emailVerified,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
