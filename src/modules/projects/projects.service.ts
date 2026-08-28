import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { CreateProjectInput, UpdateProjectInput, ListProjectsQuery } from './projects.schema';
import { INITIAL_SEED_PROJECTS } from './projects.seed';

// Verified Geographic Hub Coordinates for the India Map Projection
export const CITY_COORDINATES: Record<string, { lat: number; lng: number; state: string }> = {
  'New Delhi': { lat: 28.6139, lng: 77.2090, state: 'Delhi' },
  'Delhi NCR': { lat: 28.5800, lng: 77.1600, state: 'Delhi' },
  'Delhi': { lat: 28.6139, lng: 77.2090, state: 'Delhi' },
  'Noida': { lat: 28.5355, lng: 77.3910, state: 'Uttar Pradesh' },
  'Greater Noida': { lat: 28.4744, lng: 77.5040, state: 'Uttar Pradesh' },
  'Gurgaon': { lat: 28.4595, lng: 77.0266, state: 'Haryana' },
  'Gurugram': { lat: 28.4595, lng: 77.0266, state: 'Haryana' },
  'Faridabad': { lat: 28.4089, lng: 77.3178, state: 'Haryana' },
  'Palwal': { lat: 28.1487, lng: 77.3260, state: 'Haryana' },
  'Bangalore': { lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  'Bengaluru': { lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  'Mumbai': { lat: 19.0760, lng: 72.8777, state: 'Maharashtra' },
  'Thane': { lat: 19.2183, lng: 72.9781, state: 'Maharashtra' },
  'Navi Mumbai': { lat: 19.0330, lng: 73.0297, state: 'Maharashtra' },
  'Pune': { lat: 18.5204, lng: 73.8567, state: 'Maharashtra' },
  'Nagpur': { lat: 21.1458, lng: 79.0882, state: 'Maharashtra' },
  'Nashik': { lat: 19.9975, lng: 73.7898, state: 'Maharashtra' },
  'Wasai': { lat: 19.3800, lng: 72.8300, state: 'Maharashtra' },
  'Lucknow': { lat: 26.8467, lng: 80.9462, state: 'Uttar Pradesh' },
  'Kanpur': { lat: 26.4499, lng: 80.3319, state: 'Uttar Pradesh' },
  'Varanasi': { lat: 25.3176, lng: 82.9739, state: 'Uttar Pradesh' },
  'Allahabad': { lat: 25.4358, lng: 81.8463, state: 'Uttar Pradesh' },
  'Prayagraj': { lat: 25.4358, lng: 81.8463, state: 'Uttar Pradesh' },
  'Meerut': { lat: 28.9845, lng: 77.7064, state: 'Uttar Pradesh' },
  'Agra': { lat: 27.1767, lng: 78.0081, state: 'Uttar Pradesh' },
  'Ghaziabad': { lat: 28.6692, lng: 77.4538, state: 'Uttar Pradesh' },
  'Chandigarh': { lat: 30.7333, lng: 76.7794, state: 'Chandigarh' },
  'Mohali': { lat: 30.7046, lng: 76.7179, state: 'Punjab' },
  'Ludhiana': { lat: 30.9010, lng: 75.8573, state: 'Punjab' },
  'Amritsar': { lat: 31.6340, lng: 74.8723, state: 'Punjab' },
  'Kota': { lat: 25.2138, lng: 75.8648, state: 'Rajasthan' },
  'Udaipur': { lat: 24.5854, lng: 73.7125, state: 'Rajasthan' },
  'Jaipur': { lat: 26.9124, lng: 75.7873, state: 'Rajasthan' },
  'Jodhpur': { lat: 26.2389, lng: 73.0243, state: 'Rajasthan' },
  'Guwahati': { lat: 26.1445, lng: 91.7362, state: 'Assam' },
  'Hyderabad': { lat: 17.3850, lng: 78.4867, state: 'Telangana' },
  'Chennai': { lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu' },
  'Coimbatore': { lat: 11.0168, lng: 76.9558, state: 'Tamil Nadu' },
  'Kolkata': { lat: 22.5726, lng: 88.3639, state: 'West Bengal' },
  'Ahmedabad': { lat: 23.0225, lng: 72.5714, state: 'Gujarat' },
  'Surat': { lat: 21.1702, lng: 72.8311, state: 'Gujarat' },
  'Vadodara': { lat: 22.3072, lng: 73.1812, state: 'Gujarat' },
  'Rajkot': { lat: 22.3039, lng: 70.8022, state: 'Gujarat' },
  'Indore': { lat: 22.7196, lng: 75.8577, state: 'Madhya Pradesh' },
  'Bhopal': { lat: 23.2599, lng: 77.4126, state: 'Madhya Pradesh' },
  'Patna': { lat: 25.5941, lng: 85.1376, state: 'Bihar' },
  'Bhubaneswar': { lat: 20.2961, lng: 85.8245, state: 'Odisha' },
  'Kochi': { lat: 9.9312, lng: 76.2673, state: 'Kerala' },
  'Thiruvananthapuram': { lat: 8.5241, lng: 76.9366, state: 'Kerala' },
  'Mangalore': { lat: 12.9141, lng: 74.8560, state: 'Karnataka' },
  'Mangaluru': { lat: 12.9141, lng: 74.8560, state: 'Karnataka' },
  'Mysore': { lat: 12.2958, lng: 76.6394, state: 'Karnataka' },
  'Mysuru': { lat: 12.2958, lng: 76.6394, state: 'Karnataka' },
  'Dehradun': { lat: 30.3165, lng: 78.0322, state: 'Uttarakhand' },
  'Ranchi': { lat: 23.3441, lng: 85.3096, state: 'Jharkhand' },
  'Raipur': { lat: 21.2514, lng: 81.6296, state: 'Chhattisgarh' },
  'Goa': { lat: 15.2993, lng: 74.1240, state: 'Goa' },
  'Murthal': { lat: 29.0289, lng: 77.0784, state: 'Haryana' },
  'Jhajjar': { lat: 28.6074, lng: 76.6565, state: 'Haryana' },
  'Panipat': { lat: 29.3909, lng: 76.9635, state: 'Haryana' },
  'Sohna': { lat: 28.2478, lng: 77.0673, state: 'Haryana' },
  'Rupnagar': { lat: 30.9664, lng: 76.5331, state: 'Punjab' },
  'Jammu': { lat: 32.7266, lng: 74.8570, state: 'Jammu and Kashmir' },
  'Mathura': { lat: 27.4924, lng: 77.6737, state: 'Uttar Pradesh' },
  'Sardarshahar': { lat: 28.4414, lng: 74.4925, state: 'Rajasthan' },
};

// Fallback State Centroids for any new city entered in any Indian State/UT
export const STATE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'Delhi': { lat: 28.6139, lng: 77.2090 },
  'Uttar Pradesh': { lat: 26.8467, lng: 80.9462 },
  'Karnataka': { lat: 15.3173, lng: 75.7139 },
  'Maharashtra': { lat: 19.7515, lng: 75.7139 },
  'Haryana': { lat: 29.0588, lng: 76.0856 },
  'Punjab': { lat: 31.1471, lng: 75.3412 },
  'Rajasthan': { lat: 27.0238, lng: 74.2179 },
  'Assam': { lat: 26.2006, lng: 92.9376 },
  'Telangana': { lat: 18.1124, lng: 79.0193 },
  'Tamil Nadu': { lat: 11.1271, lng: 78.6569 },
  'West Bengal': { lat: 22.9868, lng: 87.8550 },
  'Gujarat': { lat: 22.2587, lng: 71.1924 },
  'Madhya Pradesh': { lat: 22.9734, lng: 78.6569 },
  'Bihar': { lat: 25.0961, lng: 85.3131 },
  'Odisha': { lat: 20.9517, lng: 85.0985 },
  'Kerala': { lat: 10.8505, lng: 76.2711 },
  'Uttarakhand': { lat: 30.0668, lng: 79.0193 },
  'Jharkhand': { lat: 23.6102, lng: 85.2799 },
  'Chhattisgarh': { lat: 21.2787, lng: 81.8661 },
  'Goa': { lat: 15.2993, lng: 74.1240 },
  'Chandigarh': { lat: 30.7333, lng: 76.7794 },
  'Himachal Pradesh': { lat: 31.1048, lng: 77.1734 },
  'Jammu and Kashmir': { lat: 33.7782, lng: 76.5762 },
  'Ladakh': { lat: 34.1526, lng: 77.5771 },
  'Andhra Pradesh': { lat: 15.9129, lng: 79.7400 },
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
    const coords = CITY_COORDINATES[cityKey] || (STATE_CENTROIDS[p.state] ? {
      lat: STATE_CENTROIDS[p.state].lat,
      lng: STATE_CENTROIDS[p.state].lng,
      state: p.state,
    } : {
      lat: 20.5937,
      lng: 78.9629,
      state: p.state,
    });

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
