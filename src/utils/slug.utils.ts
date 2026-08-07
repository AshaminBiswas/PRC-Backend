import slugify from 'slugify';
import prisma from '../config/database';

/**
 * Generate a URL-safe slug from a name.
 * If a slug already exists in the given model, appends a numeric suffix.
 */
export const generateSlug = (name: string): string => {
  return slugify(name, {
    lower: true,
    strict: true,
    trim: true,
  });
};

/**
 * Generate a unique slug for a category.
 * Retries with numeric suffix if base slug is taken.
 */
export const generateUniqueSlug = async (
  name: string,
  model: 'category' | 'product' | 'venture' | 'appointmentService',
  excludeId?: string
): Promise<string> => {
  const base = generateSlug(name);
  let slug = base;
  let counter = 1;

  while (true) {
    let existing: { id: string } | null = null;

    if (model === 'category') {
      existing = await prisma.category.findFirst({
        where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      });
    } else if (model === 'product') {
      existing = await prisma.product.findFirst({
        where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      });
    } else if (model === 'venture') {
      existing = await prisma.venture.findFirst({
        where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      });
    } else if (model === 'appointmentService') {
      existing = await prisma.appointmentService.findFirst({
        where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true },
      });
    }

    if (!existing) return slug;

    slug = `${base}-${counter}`;
    counter++;
  }
};
