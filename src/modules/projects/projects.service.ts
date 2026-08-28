import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { CreateProjectInput, UpdateProjectInput, ListProjectsQuery } from './projects.schema';
import { INITIAL_SEED_PROJECTS } from './projects.seed';

// Verified Geographic Hub Coordinates for the India Map Projection
export const CITY_COORDINATES: Record<string, { lat: number; lng: number; state: string }> = {
  'New Delhi': { lat: 28.6139, lng: 77.2090, state: 'Delhi' },
  'Delhi NCR': { lat: 28.5800, lng: 77.1600, state: 'Delhi' },
  'Noida': { lat: 28.5355, lng: 77.3910, state: 'Uttar Pradesh' },
  'Greater Noida': { lat: 28.4744, lng: 77.5040, state: 'Uttar Pradesh' },
  'Gurgaon': { lat: 28.4595, lng: 77.0266, state: 'Haryana' },
  'Faridabad': { lat: 28.4089, lng: 77.3178, state: 'Haryana' },
  'Palwal': { lat: 28.1487, lng: 77.3260, state: 'Haryana' },
  'Bangalore': { lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  'Mumbai': { lat: 19.0760, lng: 72.8777, state: 'Maharashtra' },
  'Thane': { lat: 19.2183, lng: 72.9781, state: 'Maharashtra' },
  'Wasai': { lat: 19.3800, lng: 72.8300, state: 'Maharashtra' },
  'Lucknow': { lat: 26.8467, lng: 80.9462, state: 'Uttar Pradesh' },
  'Kanpur': { lat: 26.4499, lng: 80.3319, state: 'Uttar Pradesh' },
  'Varanasi': { lat: 25.3176, lng: 82.9739, state: 'Uttar Pradesh' },
  'Allahabad': { lat: 25.4358, lng: 81.8463, state: 'Uttar Pradesh' },
  'Meerut': { lat: 28.9845, lng: 77.7064, state: 'Uttar Pradesh' },
  'Chandigarh': { lat: 30.7333, lng: 76.7794, state: 'Chandigarh' },
  'Mohali': { lat: 30.7046, lng: 76.7179, state: 'Punjab' },
  'Kota': { lat: 25.2138, lng: 75.8648, state: 'Rajasthan' },
  'Udaipur': { lat: 24.5854, lng: 73.7125, state: 'Rajasthan' },
  'Jodhpur': { lat: 26.2389, lng: 73.0243, state: 'Rajasthan' },
  'Guwahati': { lat: 26.1445, lng: 91.7362, state: 'Assam' },
  'Hyderabad': { lat: 17.3850, lng: 78.4867, state: 'Telangana' },
  'Mangalore': { lat: 12.9141, lng: 74.8560, state: 'Karnataka' },
  'Indore': { lat: 22.7196, lng: 75.8577, state: 'Madhya Pradesh' },
};

/**
 * List projects with multi-criteria filtering
 */
export async function listProjects(query: ListProjectsQuery, isAdmin = false) {
  const where: any = {};

  if (!isAdmin) {
    where.status = 'ACTIVE';
  } else if (query.status) {
    where.status = query.status;
  }

  if (query.isPanIndia === 'true') {
    where.isPanIndia = true;
  } else if (query.isPanIndia === 'false') {
    where.isPanIndia = false;
  }

  if (query.isFeatured === 'true') {
    where.isFeatured = true;
  }

  if (query.category) {
    where.category = { equals: query.category, mode: 'insensitive' };
  }

  if (query.city) {
    where.city = { equals: query.city, mode: 'insensitive' };
  }

  if (query.state) {
    where.state = { equals: query.state, mode: 'insensitive' };
  }

  if (query.region) {
    where.region = { equals: query.region, mode: 'insensitive' };
  }

  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { clientName: { contains: term, mode: 'insensitive' } },
      { city: { contains: term, mode: 'insensitive' } },
      { state: { contains: term, mode: 'insensitive' } },
      { category: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
      { productsUsed: { hasSome: [term] } },
    ];
  }

  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(query.limit || '50', 10)));
  const skip = (page - 1) * limit;

  let orderBy: any = [{ orderIndex: 'asc' }, { createdAt: 'desc' }];
  if (query.sort === 'newest') orderBy = [{ createdAt: 'desc' }];
  else if (query.sort === 'oldest') orderBy = [{ createdAt: 'asc' }];
  else if (query.sort === 'name') orderBy = [{ name: 'asc' }];

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy,
    }),
  ]);

  return {
    projects,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

/**
 * Get project by ID
 */
export async function getProjectById(id: string) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw new AppError('NOT_FOUND', 'Project not found', 404);
  }
  return project;
}

/**
 * Get aggregated locations summary for the Interactive India Map
 */
export async function getMapLocationsSummary() {
  const activeProjects = await prisma.project.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      clientName: true,
      city: true,
      state: true,
      isPanIndia: true,
      category: true,
      images: true,
    },
  });

  const cityMap = new Map<string, {
    city: string;
    state: string;
    count: number;
    lat: number;
    lng: number;
    sampleProjects: { id: string; name: string; clientName: string; category: string; coverImage: string }[];
  }>();

  let panIndiaCount = 0;
  const panIndiaProjects: any[] = [];

  for (const p of activeProjects) {
    if (p.isPanIndia) {
      panIndiaCount++;
      panIndiaProjects.push({
        id: p.id,
        name: p.name,
        clientName: p.clientName,
        category: p.category,
        coverImage: p.images[0] || '',
      });
      continue;
    }

    const cityKey = p.city.trim();
    const existing = cityMap.get(cityKey);
    const coords = CITY_COORDINATES[cityKey] || {
      lat: 20.5937,
      lng: 78.9629,
      state: p.state,
    };

    const previewItem = {
      id: p.id,
      name: p.name,
      clientName: p.clientName,
      category: p.category,
      coverImage: p.images[0] || '',
    };

    if (existing) {
      existing.count += 1;
      if (existing.sampleProjects.length < 5) {
        existing.sampleProjects.push(previewItem);
      }
    } else {
      cityMap.set(cityKey, {
        city: cityKey,
        state: p.state,
        count: 1,
        lat: coords.lat,
        lng: coords.lng,
        sampleProjects: [previewItem],
      });
    }
  }

  const clusters = Array.from(cityMap.values()).sort((a, b) => b.count - a.count);

  return {
    totalProjects: activeProjects.length,
    totalCities: clusters.length,
    panIndiaCount,
    clusters,
    panIndiaProjects,
  };
}

/**
 * Get distinct categories with counts
 */
export async function getCategoriesSummary() {
  const groups = await prisma.project.groupBy({
    by: ['category'],
    where: { status: 'ACTIVE' },
    _count: { id: true },
  });

  return groups.map((g) => ({
    category: g.category,
    count: g._count.id,
  }));
}

/**
 * Create a new project (Admin)
 */
export async function createProject(data: CreateProjectInput) {
  const productsArray = Array.isArray(data.productsUsed)
    ? data.productsUsed
    : typeof data.productsUsed === 'string'
    ? data.productsUsed.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return prisma.project.create({
    data: {
      name: data.name,
      clientName: data.clientName,
      location: data.location || null,
      city: data.city,
      state: data.state,
      region: data.region || null,
      isPanIndia: data.isPanIndia || false,
      category: data.category || 'Commercial',
      description: data.description || null,
      completionYear: data.completionYear || null,
      productsUsed: productsArray,
      images: data.images,
      videoUrl: data.videoUrl || null,
      isFeatured: data.isFeatured || false,
      status: data.status || 'ACTIVE',
      orderIndex: data.orderIndex || 0,
    },
  });
}

/**
 * Update project (Admin)
 */
export async function updateProject(id: string, data: UpdateProjectInput) {
  await getProjectById(id);

  const updateData: any = { ...data };
  if (data.productsUsed !== undefined) {
    updateData.productsUsed = Array.isArray(data.productsUsed)
      ? data.productsUsed
      : typeof data.productsUsed === 'string'
      ? data.productsUsed.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  }

  return prisma.project.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Delete project (Admin)
 */
export async function deleteProject(id: string) {
  await getProjectById(id);
  return prisma.project.delete({ where: { id } });
}

/**
 * Toggle featured status (Admin)
 */
export async function toggleFeatured(id: string) {
  const project = await getProjectById(id);
  return prisma.project.update({
    where: { id },
    data: { isFeatured: !project.isFeatured },
  });
}

/**
 * Toggle active/inactive status (Admin)
 */
export async function toggleStatus(id: string) {
  const project = await getProjectById(id);
  const nextStatus = project.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  return prisma.project.update({
    where: { id },
    data: { status: nextStatus },
  });
}

/**
 * Seed initial completed projects if table is empty
 */
export async function seedInitialProjects(force = false) {
  const count = await prisma.project.count();
  if (count >= 10 && !force) {
    return { count, message: `Projects table already contains ${count} projects. Skipping seed.` };
  }

  if (force) {
    await prisma.project.deleteMany();
  }

  const created = await prisma.project.createMany({
    data: INITIAL_SEED_PROJECTS.map((p) => ({
      name: p.name,
      clientName: p.clientName,
      location: p.location || null,
      city: p.city,
      state: p.state,
      region: p.region || null,
      isPanIndia: p.isPanIndia,
      category: p.category,
      description: p.description,
      completionYear: p.completionYear,
      productsUsed: p.productsUsed,
      images: p.images,
      videoUrl: p.videoUrl || null,
      isFeatured: p.isFeatured,
      status: p.status,
      orderIndex: p.orderIndex,
    })),
    skipDuplicates: true,
  });

  return {
    count: created.count,
    message: `Successfully seeded ${created.count} completed projects across India.`,
  };
}
