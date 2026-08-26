import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import type { CreateMaterialInput, UpdateMaterialInput, ListMaterialsQuery } from './materials.schema';

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const listMaterials = async (query: ListMaterialsQuery) => {
  const where: any = { deletedAt: null };

  if (query.active === 'true') {
    where.isActive = true;
  } else if (query.active === 'false') {
    where.isActive = false;
  }

  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    where.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { slug: { contains: s, mode: 'insensitive' } },
      { shortName: { contains: s, mode: 'insensitive' } },
      { gradeBadge: { contains: s, mode: 'insensitive' } },
    ];
  }

  const materials = await prisma.material.findMany({
    where,
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: { products: { where: { deletedAt: null } } },
      },
    },
  });

  return materials.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    shortName: m.shortName,
    gradeBadge: m.gradeBadge,
    description: m.description,
    tagline: m.tagline,
    specs: m.specs,
    isActive: m.isActive,
    position: m.position,
    productCount: m._count.products,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));
};

export const getMaterialByIdOrSlug = async (idOrSlug: string) => {
  const material = await prisma.material.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug.toLowerCase().trim() }],
      deletedAt: null,
    },
    include: {
      _count: {
        select: { products: { where: { deletedAt: null } } },
      },
    },
  });

  if (!material) {
    throw new AppError('NOT_FOUND', `Material "${idOrSlug}" not found`, 404);
  }

  return {
    id: material.id,
    name: material.name,
    slug: material.slug,
    shortName: material.shortName,
    gradeBadge: material.gradeBadge,
    description: material.description,
    tagline: material.tagline,
    specs: material.specs,
    isActive: material.isActive,
    position: material.position,
    productCount: material._count.products,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
};

export const createMaterial = async (input: CreateMaterialInput) => {
  const slug = input.slug?.trim() ? generateSlug(input.slug) : generateSlug(input.name);

  const existingSlug = await prisma.material.findFirst({
    where: { slug, deletedAt: null },
  });
  if (existingSlug) {
    throw new AppError('CONFLICT', `Material with slug "${slug}" already exists`, 409);
  }

  const existingName = await prisma.material.findFirst({
    where: { name: { equals: input.name.trim(), mode: 'insensitive' }, deletedAt: null },
  });
  if (existingName) {
    throw new AppError('CONFLICT', `Material with name "${input.name.trim()}" already exists`, 409);
  }

  const material = await prisma.material.create({
    data: {
      name: input.name.trim(),
      slug,
      shortName: input.shortName?.trim() || null,
      gradeBadge: input.gradeBadge?.trim() || null,
      description: input.description?.trim() || null,
      tagline: input.tagline?.trim() || null,
      specs: Array.isArray(input.specs) ? input.specs : [],
      isActive: input.isActive ?? true,
      position: input.position ?? 0,
    },
  });

  return material;
};

export const updateMaterial = async (id: string, input: UpdateMaterialInput) => {
  const existing = await prisma.material.findUnique({
    where: { id },
  });
  if (!existing || existing.deletedAt) {
    throw new AppError('NOT_FOUND', 'Material not found', 404);
  }

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.slug !== undefined) updateData.slug = generateSlug(input.slug);
  if (input.shortName !== undefined) updateData.shortName = input.shortName?.trim() || null;
  if (input.gradeBadge !== undefined) updateData.gradeBadge = input.gradeBadge?.trim() || null;
  if (input.description !== undefined) updateData.description = input.description?.trim() || null;
  if (input.tagline !== undefined) updateData.tagline = input.tagline?.trim() || null;
  if (input.specs !== undefined) updateData.specs = input.specs;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.position !== undefined) updateData.position = input.position;

  // Check unique constraints if name or slug changed
  if (updateData.slug && updateData.slug !== existing.slug) {
    const slugExists = await prisma.material.findFirst({
      where: { slug: updateData.slug, id: { not: id }, deletedAt: null },
    });
    if (slugExists) throw new AppError('CONFLICT', `Material with slug "${updateData.slug}" already exists`, 409);
  }

  const updated = await prisma.material.update({
    where: { id },
    data: updateData,
  });

  return updated;
};

export const deleteMaterial = async (id: string) => {
  const existing = await prisma.material.findUnique({
    where: { id },
  });
  if (!existing || existing.deletedAt) {
    throw new AppError('NOT_FOUND', 'Material not found', 404);
  }

  // Soft delete
  await prisma.material.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  return { message: `Material "${existing.name}" deleted successfully` };
};
