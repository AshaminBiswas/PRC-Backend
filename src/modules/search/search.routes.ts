import { Router } from 'express';
import * as controller from './search.controller';
import { validate } from '../../middleware/validate.middleware';
import { cacheResponse } from '../../middleware/cache.middleware';
import { searchLimiter } from '../../middleware/rateLimit.middleware';
import {
  SearchProductsQuerySchema,
  SearchSuggestionsQuerySchema,
} from './search.schema';

const router = Router();

router.use(searchLimiter);

// GET /suggestions - autocomplete suggestions for products and categories
router.get(
  '/suggestions',
  cacheResponse(30),
  validate(SearchSuggestionsQuerySchema, 'query'),
  controller.getSuggestions
);

// GET / - search products with filters and sorting
router.get(
  '/',
  cacheResponse(30),
  validate(SearchProductsQuerySchema, 'query'),
  controller.searchProducts
);

export default router;
