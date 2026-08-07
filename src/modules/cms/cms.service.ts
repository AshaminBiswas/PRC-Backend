import prisma from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { generateSlug } from '../../utils/slug.utils';
import { buildPagination, getPaginationParams } from '../../utils/response';
import { ContentStatus, Prisma } from '@prisma/client';
import type {
  CreateCmsPageInput,
  UpdateCmsPageInput,
  ListCmsPagesQuery,
  CreateBlogPostInput,
  UpdateBlogPostInput,
  ListBlogPostsQuery,
  CreateFaqCategoryInput,
  UpdateFaqCategoryInput,
  CreateFaqInput,
  UpdateFaqInput,
  ListFaqsQuery,
} from './cms.schema';

// ─── CMS PAGES ────────────────────────────────────────────────────────────────

export const getPublicPages = async () => {
  const pages = await prisma.cmsPage.findMany({
    where: { status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      metaTitle: true,
      metaDescription: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { title: 'asc' },
  });

  return pages;
};

export const getPageBySlug = async (slug: string, isPublic = true) => {
  const page = await prisma.cmsPage.findUnique({
    where: { slug },
  });

  if (!page) {
    throw new AppError('NOT_FOUND', 'Page not found', 404);
  }

  if (isPublic && page.status !== ContentStatus.PUBLISHED) {
    throw new AppError('NOT_FOUND', 'Page not found', 404);
  }

  return page;
};

export const getPageById = async (id: string) => {
  const page = await prisma.cmsPage.findUnique({
    where: { id },
  });

  if (!page) {
    throw new AppError('NOT_FOUND', 'Page not found', 404);
  }

  return page;
};

export const listPagesAdmin = async (query: ListCmsPagesQuery) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.CmsPageWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { content: { contains: query.search, mode: 'insensitive' } },
      { slug: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [totalItems, pages] = await Promise.all([
    prisma.cmsPage.count({ where }),
    prisma.cmsPage.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const pagination = buildPagination(page, limit, totalItems);

  return { data: pages, pagination };
};

export const createPage = async (input: CreateCmsPageInput) => {
  const slug = input.slug ? generateSlug(input.slug) : generateSlug(input.title);

  const existing = await prisma.cmsPage.findUnique({ where: { slug } });
  if (existing) {
    throw new AppError('CONFLICT', 'A page with this slug already exists', 409);
  }

  const page = await prisma.cmsPage.create({
    data: {
      title: input.title,
      slug,
      content: input.content,
      status: input.status,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      metaKeywords: input.metaKeywords,
    },
  });

  return page;
};

export const updatePage = async (id: string, input: UpdateCmsPageInput) => {
  const existingPage = await prisma.cmsPage.findUnique({ where: { id } });
  if (!existingPage) {
    throw new AppError('NOT_FOUND', 'Page not found', 404);
  }

  let slug = existingPage.slug;
  if (input.slug) {
    slug = generateSlug(input.slug);
  } else if (input.title && input.title !== existingPage.title) {
    slug = generateSlug(input.title);
  }

  if (slug !== existingPage.slug) {
    const duplicate = await prisma.cmsPage.findUnique({ where: { slug } });
    if (duplicate) {
      throw new AppError('CONFLICT', 'A page with this slug already exists', 409);
    }
  }

  const page = await prisma.cmsPage.update({
    where: { id },
    data: {
      ...input,
      slug,
    },
  });

  return page;
};

export const deletePage = async (id: string) => {
  const existingPage = await prisma.cmsPage.findUnique({ where: { id } });
  if (!existingPage) {
    throw new AppError('NOT_FOUND', 'Page not found', 404);
  }

  await prisma.cmsPage.delete({ where: { id } });
};

// ─── BLOG POSTS ───────────────────────────────────────────────────────────────

export const getPublicBlogPosts = async (query: ListBlogPostsQuery) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.BlogPostWhereInput = {
    status: ContentStatus.PUBLISHED,
  };

  if (query.category) {
    where.category = { equals: query.category, mode: 'insensitive' };
  }

  if (query.tag) {
    where.tags = { has: query.tag };
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { content: { contains: query.search, mode: 'insensitive' } },
      { excerpt: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [totalItems, posts] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    }),
  ]);

  const pagination = buildPagination(page, limit, totalItems);

  return { data: posts, pagination };
};

export const getBlogPostBySlug = async (slug: string, isPublic = true) => {
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  });

  if (!post) {
    throw new AppError('NOT_FOUND', 'Blog post not found', 404);
  }

  if (isPublic && post.status !== ContentStatus.PUBLISHED) {
    throw new AppError('NOT_FOUND', 'Blog post not found', 404);
  }

  return post;
};

export const getBlogPostById = async (id: string) => {
  const post = await prisma.blogPost.findUnique({
    where: { id },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  });

  if (!post) {
    throw new AppError('NOT_FOUND', 'Blog post not found', 404);
  }

  return post;
};

export const listBlogPostsAdmin = async (query: ListBlogPostsQuery) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.BlogPostWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.category) {
    where.category = { equals: query.category, mode: 'insensitive' };
  }

  if (query.tag) {
    where.tags = { has: query.tag };
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { content: { contains: query.search, mode: 'insensitive' } },
      { excerpt: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [totalItems, posts] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
  ]);

  const pagination = buildPagination(page, limit, totalItems);

  return { data: posts, pagination };
};

export const createBlogPost = async (
  input: CreateBlogPostInput,
  authorId?: string,
  authorName?: string
) => {
  const slug = input.slug ? generateSlug(input.slug) : generateSlug(input.title);

  const existing = await prisma.blogPost.findUnique({ where: { slug } });
  if (existing) {
    throw new AppError('CONFLICT', 'A blog post with this slug already exists', 409);
  }

  const publishedAt =
    input.publishedAt ? new Date(input.publishedAt) : input.status === ContentStatus.PUBLISHED ? new Date() : null;

  const post = await prisma.blogPost.create({
    data: {
      title: input.title,
      slug,
      content: input.content,
      excerpt: input.excerpt,
      thumbnail: input.thumbnail || null,
      category: input.category,
      tags: input.tags || [],
      authorId: authorId || null,
      authorName: authorName || null,
      status: input.status,
      publishedAt,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      metaKeywords: input.metaKeywords,
    },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  });

  return post;
};

export const updateBlogPost = async (id: string, input: UpdateBlogPostInput) => {
  const existingPost = await prisma.blogPost.findUnique({ where: { id } });
  if (!existingPost) {
    throw new AppError('NOT_FOUND', 'Blog post not found', 404);
  }

  let slug = existingPost.slug;
  if (input.slug) {
    slug = generateSlug(input.slug);
  } else if (input.title && input.title !== existingPost.title) {
    slug = generateSlug(input.title);
  }

  if (slug !== existingPost.slug) {
    const duplicate = await prisma.blogPost.findUnique({ where: { slug } });
    if (duplicate) {
      throw new AppError('CONFLICT', 'A blog post with this slug already exists', 409);
    }
  }

  let publishedAt = existingPost.publishedAt;
  if (input.publishedAt !== undefined) {
    publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
  } else if (input.status === ContentStatus.PUBLISHED && !existingPost.publishedAt) {
    publishedAt = new Date();
  }

  const dataToUpdate: Prisma.BlogPostUpdateInput = {
    ...input,
    slug,
    publishedAt,
  };

  const post = await prisma.blogPost.update({
    where: { id },
    data: dataToUpdate,
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  });

  return post;
};

export const deleteBlogPost = async (id: string) => {
  const existingPost = await prisma.blogPost.findUnique({ where: { id } });
  if (!existingPost) {
    throw new AppError('NOT_FOUND', 'Blog post not found', 404);
  }

  await prisma.blogPost.delete({ where: { id } });
};

// ─── FAQ & FAQ CATEGORIES ──────────────────────────────────────────────────────

export const getPublicFaqsGrouped = async () => {
  const categories = await prisma.faqCategory.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
    include: {
      faqs: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          question: true,
          answer: true,
          position: true,
        },
      },
    },
  });

  return categories;
};

// FAQ Category Admin CRUD
export const listFaqCategories = async () => {
  return prisma.faqCategory.findMany({
    orderBy: { position: 'asc' },
    include: {
      _count: { select: { faqs: true } },
    },
  });
};

export const createFaqCategory = async (input: CreateFaqCategoryInput) => {
  const slug = input.slug ? generateSlug(input.slug) : generateSlug(input.name);

  const existing = await prisma.faqCategory.findUnique({ where: { slug } });
  if (existing) {
    throw new AppError('CONFLICT', 'An FAQ category with this slug already exists', 409);
  }

  return prisma.faqCategory.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      position: input.position,
      isActive: input.isActive,
    },
  });
};

export const updateFaqCategory = async (id: string, input: UpdateFaqCategoryInput) => {
  const existingCategory = await prisma.faqCategory.findUnique({ where: { id } });
  if (!existingCategory) {
    throw new AppError('NOT_FOUND', 'FAQ category not found', 404);
  }

  let slug = existingCategory.slug;
  if (input.slug) {
    slug = generateSlug(input.slug);
  } else if (input.name && input.name !== existingCategory.name) {
    slug = generateSlug(input.name);
  }

  if (slug !== existingCategory.slug) {
    const duplicate = await prisma.faqCategory.findUnique({ where: { slug } });
    if (duplicate) {
      throw new AppError('CONFLICT', 'An FAQ category with this slug already exists', 409);
    }
  }

  return prisma.faqCategory.update({
    where: { id },
    data: {
      ...input,
      slug,
    },
  });
};

export const deleteFaqCategory = async (id: string) => {
  const category = await prisma.faqCategory.findUnique({ where: { id } });
  if (!category) {
    throw new AppError('NOT_FOUND', 'FAQ category not found', 404);
  }

  await prisma.faqCategory.delete({ where: { id } });
};

// FAQ Admin CRUD
export const listFaqsAdmin = async (query: ListFaqsQuery) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where: Prisma.FaqWhereInput = {};

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (query.search) {
    where.OR = [
      { question: { contains: query.search, mode: 'insensitive' } },
      { answer: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [totalItems, faqs] = await Promise.all([
    prisma.faq.count({ where }),
    prisma.faq.findMany({
      where,
      orderBy: [{ categoryId: 'asc' }, { position: 'asc' }],
      skip,
      take: limit,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  const pagination = buildPagination(page, limit, totalItems);

  return { data: faqs, pagination };
};

export const createFaq = async (input: CreateFaqInput) => {
  const category = await prisma.faqCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    throw new AppError('NOT_FOUND', 'FAQ category not found', 404);
  }

  return prisma.faq.create({
    data: {
      categoryId: input.categoryId,
      question: input.question,
      answer: input.answer,
      position: input.position,
      isActive: input.isActive,
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });
};

export const updateFaq = async (id: string, input: UpdateFaqInput) => {
  const faq = await prisma.faq.findUnique({ where: { id } });
  if (!faq) {
    throw new AppError('NOT_FOUND', 'FAQ not found', 404);
  }

  if (input.categoryId && input.categoryId !== faq.categoryId) {
    const category = await prisma.faqCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw new AppError('NOT_FOUND', 'FAQ category not found', 404);
    }
  }

  return prisma.faq.update({
    where: { id },
    data: input,
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });
};

export const deleteFaq = async (id: string) => {
  const faq = await prisma.faq.findUnique({ where: { id } });
  if (!faq) {
    throw new AppError('NOT_FOUND', 'FAQ not found', 404);
  }

  await prisma.faq.delete({ where: { id } });
};
