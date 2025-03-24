import { GraphQueryConfig } from '@hshanjra/mongoose-query-builder';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// Types for query parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

export interface ExpandParams {
  path: string;
  select?: string[];
}

export interface SearchParams {
  searchText: string;
  language?: string;
  sortByScore?: boolean;
  caseSensitive?: boolean;
  diacriticSensitive?: boolean;
}

// Parse individual query parameters
const parsePagination = (query: any): PaginationParams | undefined => {
  const page = Number(query.page);
  const limit = Number(query.limit);

  if (isNaN(page) && isNaN(limit)) return undefined;

  return {
    ...(page && !isNaN(page) && { page }),
    ...(limit && !isNaN(limit) && { limit }),
  };
};

const parseSort = (query: any): SortParams[] | undefined => {
  if (!query.sort) return undefined;

  return query.sort.split(',').map((sort) => {
    const [field, order = 'asc'] = sort.split(':');
    return {
      field: field.trim(),
      order: order.toLowerCase() as 'asc' | 'desc',
    };
  });
};

const parseExpand = (query: any): ExpandParams[] | undefined => {
  if (!query.expand) return undefined;

  return query.expand.split(',').map((expand) => {
    const match = expand.match(/^(\w+)(?:\(([\w,]+)\))?$/);
    if (!match) return { path: expand.trim() };

    const [, path, fields] = match;
    return {
      path: path.trim(),
      ...(fields && { select: fields.split(',').map((f) => f.trim()) }),
    };
  });
};

const parseSearch = (query: any): SearchParams | undefined => {
  if (!query.search) return undefined;

  return {
    searchText: query.search,
    ...(query.searchLanguage && { language: query.searchLanguage }),
    ...(query.searchScore && { sortByScore: query.searchScore === 'true' }),
    ...(query.searchCaseSensitive && {
      caseSensitive: query.searchCaseSensitive === 'true',
    }),
    ...(query.searchDiacriticSensitive && {
      diacriticSensitive: query.searchDiacriticSensitive === 'true',
    }),
  };
};

const parseFields = (query: any): string[] | undefined => {
  if (!query.fields) return undefined;
  return query.fields.split(',').map((field) => field.trim());
};

const parseFilters = (query: any): Record<string, any> | undefined => {
  const reservedParams = new Set([
    'page',
    'limit',
    'sort',
    'expand',
    'search',
    'searchLanguage',
    'searchScore',
    'searchCaseSensitive',
    'searchDiacriticSensitive',
    'fields',
  ]);

  const filters: Record<string, any> = {};

  for (const [key, value] of Object.entries(query)) {
    if (!reservedParams.has(key)) {
      if (key.endsWith('_in') && typeof value === 'string') {
        filters[key] = value.split(',');
      } else if (typeof value === 'string' && !isNaN(Number(value))) {
        filters[key] = Number(value);
      } else {
        filters[key] = value;
      }
    }
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
};

// Main query parameters decorator
export const QueryParams = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Partial<GraphQueryConfig<any>> => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const query = request.query;

    return {
      pagination: parsePagination(query),
      sort: parseSort(query),
      expand: parseExpand(query),
      fullTextSearch: parseSearch(query),
      fields: parseFields(query),
      filters: parseFilters(query),
    };
  },
);

// Individual parameter decorators for more granular control
export const Pagination = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): PaginationParams | undefined => {
    const query = ctx.switchToHttp().getRequest<Request>().query;
    return parsePagination(query);
  },
);

export const Sort = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): SortParams[] | undefined => {
    const query = ctx.switchToHttp().getRequest<Request>().query;
    return parseSort(query);
  },
);

export const Expand = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ExpandParams[] | undefined => {
    const query = ctx.switchToHttp().getRequest<Request>().query;
    return parseExpand(query);
  },
);

export const Search = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): SearchParams | undefined => {
    const query = ctx.switchToHttp().getRequest<Request>().query;
    return parseSearch(query);
  },
);

export const Fields = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string[] | undefined => {
    const query = ctx.switchToHttp().getRequest<Request>().query;
    return parseFields(query);
  },
);

export const Filters = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Record<string, any> | undefined => {
    const query = ctx.switchToHttp().getRequest<Request>().query;
    return parseFilters(query);
  },
);
