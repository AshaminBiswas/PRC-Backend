import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { generateSlug } from '../../utils/slug.utils';
import type {
  CreateRoleInput,
  UpdateRoleInput,
  CreatePermissionInput,
  UpdatePermissionInput,
} from './roles.schema';

// ─── List Roles ───────────────────────────────────────────────────────────────

export const listRoles = async () => {
  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isSystem: true,
      createdAt: true,
      _count: { select: { userRoles: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    isSystem: r.isSystem,
    userCount: r._count.userRoles,
    createdAt: r.createdAt,
  }));
};

// ─── Get Role By ID ───────────────────────────────────────────────────────────

export const getRoleById = async (id: string) => {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      rolePermissions: {
        include: { permission: true },
      },
    },
  });

  if (!role) throw new AppError('NOT_FOUND', 'Role not found', 404);

  return {
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.rolePermissions.map((rp) => ({
      id: rp.permission.id,
      name: rp.permission.name,
      slug: rp.permission.slug,
      module: rp.permission.module,
    })),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
};

// ─── Create Role ──────────────────────────────────────────────────────────────

export const createRole = async (input: CreateRoleInput) => {
  const slug = generateSlug(input.name);

  const existing = await prisma.role.findUnique({ where: { slug } });
  if (existing) throw new AppError('CONFLICT', 'A role with this name already exists', 409);

  let permissionIds: string[] = [];
  if (input.permissions.length > 0) {
    const permRecords = await prisma.permission.findMany({
      where: {
        OR: [
          { id: { in: input.permissions } },
          { slug: { in: input.permissions } },
        ],
      },
      select: { id: true },
    });
    permissionIds = permRecords.map((p) => p.id);
  }

  const role = await prisma.role.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      ...(permissionIds.length > 0 && {
        rolePermissions: {
          create: permissionIds.map((permId) => ({ permissionId: permId })),
        },
      }),
    },
  });

  return { id: role.id, name: role.name, slug: role.slug };
};

// ─── Update Role ──────────────────────────────────────────────────────────────

export const updateRole = async (id: string, input: UpdateRoleInput) => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new AppError('NOT_FOUND', 'Role not found', 404);
  if (role.isSystem) throw new AppError('FORBIDDEN', 'System roles cannot be modified', 403);

  const updateData: { name?: string; slug?: string; description?: string } = {};
  if (input.name) {
    updateData.name = input.name;
    updateData.slug = generateSlug(input.name);
  }
  if (input.description !== undefined) updateData.description = input.description;

  await prisma.role.update({ where: { id }, data: updateData });
};

// ─── Delete Role ──────────────────────────────────────────────────────────────

export const deleteRole = async (id: string) => {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { userRoles: true } } },
  });
  if (!role) throw new AppError('NOT_FOUND', 'Role not found', 404);
  if (role.isSystem) throw new AppError('FORBIDDEN', 'System roles cannot be deleted', 403);
  if (role._count.userRoles > 0) {
    throw new AppError('CONFLICT', 'Cannot delete a role that is assigned to users. Please reassign those users first.', 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    await tx.role.delete({ where: { id } });
  });

  return { success: true, message: `Role ${role.name} deleted permanently.` };
};

// ─── Update Role Permissions ──────────────────────────────────────────────────

export const updateRolePermissions = async (id: string, permissionsInput: string[]) => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new AppError('NOT_FOUND', 'Role not found', 404);

  const roleSlug = (role.slug || '').toLowerCase();
  if (['super_admin', 'super-admin', 'superadmin'].includes(roleSlug) || role.name.toLowerCase() === 'super admin') {
    throw new AppError('FORBIDDEN', 'Super Admin permissions are protected and cannot be modified. Super Admin possesses unrestricted access by default.', 403);
  }

  // Validate and resolve permissions (by ID or slug)
  const permissions = await prisma.permission.findMany({
    where: {
      OR: [
        { id: { in: permissionsInput } },
        { slug: { in: permissionsInput } },
      ],
    },
    select: { id: true },
  });

  const permissionIds = permissions.map((p) => p.id);

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: id } }),
    prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
    }),
  ]);
};

// ─── List Permissions (grouped by module) ────────────────────────────────────

export const listPermissions = async () => {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { name: 'asc' }],
  });

  const grouped: Record<string, typeof permissions> = {};
  for (const perm of permissions) {
    if (!grouped[perm.module]) grouped[perm.module] = [];
    grouped[perm.module].push(perm);
  }

  return Object.entries(grouped).map(([module, perms]) => ({
    module,
    permissions: perms.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
    })),
  }));
};

// ─── Create Custom Permission ────────────────────────────────────────────────

export const createPermission = async (input: CreatePermissionInput) => {
  const cleanName = input.name.trim();
  const cleanModule = input.module.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
  
  // Format slug: e.g. "inventory.transfer_stock"
  const rawSlug = input.slug?.trim() || `${cleanModule}.${generateSlug(cleanName).replace(/-/g, '_')}`;
  const cleanSlug = rawSlug.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');

  const existing = await prisma.permission.findUnique({ where: { slug: cleanSlug } });
  if (existing) {
    throw new AppError('CONFLICT', `A permission with key '${cleanSlug}' already exists`, 409);
  }

  const permission = await prisma.permission.create({
    data: {
      name: cleanName,
      slug: cleanSlug,
      module: input.module.trim(),
      description: input.description?.trim() || null,
    },
  });

  return {
    id: permission.id,
    name: permission.name,
    slug: permission.slug,
    module: permission.module,
    description: permission.description,
    createdAt: permission.createdAt,
  };
};

// ─── Update Custom Permission ────────────────────────────────────────────────

export const updatePermission = async (id: string, input: UpdatePermissionInput) => {
  const perm = await prisma.permission.findUnique({ where: { id } });
  if (!perm) throw new AppError('NOT_FOUND', 'Permission not found', 404);

  const updateData: { name?: string; slug?: string; module?: string; description?: string | null } = {};

  if (input.name) updateData.name = input.name.trim();
  if (input.module) updateData.module = input.module.trim();
  if (input.description !== undefined) updateData.description = input.description ? input.description.trim() : null;

  if (input.slug) {
    const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    if (cleanSlug !== perm.slug) {
      const existing = await prisma.permission.findUnique({ where: { slug: cleanSlug } });
      if (existing && existing.id !== id) {
        throw new AppError('CONFLICT', `A permission with key '${cleanSlug}' already exists`, 409);
      }
      updateData.slug = cleanSlug;
    }
  }

  const updated = await prisma.permission.update({
    where: { id },
    data: updateData,
  });

  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    module: updated.module,
    description: updated.description,
  };
};

// ─── Delete Custom Permission ────────────────────────────────────────────────

export const deletePermission = async (id: string) => {
  const perm = await prisma.permission.findUnique({
    where: { id },
    include: { _count: { select: { rolePermissions: true } } },
  });
  if (!perm) throw new AppError('NOT_FOUND', 'Permission not found', 404);

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { permissionId: id } });
    await tx.permission.delete({ where: { id } });
  });

  return { success: true, message: `Permission '${perm.name}' (${perm.slug}) deleted permanently.` };
};

