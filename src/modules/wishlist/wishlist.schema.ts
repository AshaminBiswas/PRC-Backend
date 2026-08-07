import { z } from 'zod';

export const AddWishlistItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID format'),
  variantId: z.string().uuid('Invalid variant ID format').optional().nullable(),
});

export const WishlistItemParamSchema = z.object({
  itemId: z.string().uuid('Invalid item ID format'),
});

export type AddWishlistItemInput = z.infer<typeof AddWishlistItemSchema>;
