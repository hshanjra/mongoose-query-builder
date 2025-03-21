import { Request, Response, NextFunction } from 'express';
import { QueryOptions } from '../types';

// Extend the Express Request interface
declare global {
    namespace Express {
        interface Request {
            queryOptions: {
                fields?: string[];
                filters?: Record<string, any>;
                pagination?: {
                    page?: number;
                    limit?: number;
                    offset?: number;
                    cursor?: string;
                };
                sort?: string | Array<{ field: string; order: 'asc' | 'desc' }>;
                expand?: Array<{ path: string; select?: string[] }>;
                fullTextSearch?: {
                    searchText: string;
                    language?: string;
                    sortByScore?: boolean;
                };
                defaultFilters?: Record<string, any>;
                restrictedFields?: string[];
            };
        }
    }
}

export interface QueryBuilderMiddlewareOptions {
    maxLimit?: number;
    defaultLimit?: number;
    allowedFields?: string[];
    restrictedFields?: string[];
    defaultFilters?: Record<string, any>;
    routeConfig?: Record<string, {
        maxLimit?: number;
        defaultLimit?: number;
        allowedFields?: string[];
        restrictedFields?: string[];
        defaultFilters?: Record<string, any>;
    }>;
}

export const queryBuilderMiddleware = (options: QueryBuilderMiddlewareOptions = {}) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Get route-specific config if exists
            const routeConfig = options.routeConfig?.[req.path] || {};
            
            const queryOptions: Request['queryOptions'] = {};
            const {
                maxLimit = routeConfig.maxLimit || 100,
                defaultLimit = routeConfig.defaultLimit || 10,
                allowedFields = routeConfig.allowedFields,
                restrictedFields = routeConfig.restrictedFields || [],
                defaultFilters = { ...options.defaultFilters, ...routeConfig.defaultFilters }
            } = options;

            // Parse filters from query params
            const reservedParams = new Set([
                'select', 'expand', 'sort', 'page', 'limit', 
                'offset', 'cursor', 'search', 'fields',
                'language', 'sortByScore'
            ]);

            // Handle filters
            queryOptions.filters = {};
            Object.entries(req.query).forEach(([key, value]) => {
                if (!reservedParams.has(key) && value !== undefined) {
                    // Handle array values (e.g., tags_in=tag1,tag2)
                    if (typeof value === 'string' && key.endsWith('_in')) {
                        queryOptions.filters![key] = value.split(',');
                    } else {
                        queryOptions.filters![key] = value;
                    }
                }
            });

            // Apply default filters if provided
            if (defaultFilters) {
                queryOptions.defaultFilters = defaultFilters;
            }

            // Handle field selection
            if (req.query.select || req.query.fields) {
                const selectFields = (req.query.select || req.query.fields) as string;
                const fields = selectFields.split(',').map(field => field.trim());
                
                if (allowedFields) {
                    queryOptions.fields = fields.filter(field => 
                        allowedFields.includes(field.replace(/^-/, '')));
                } else {
                    queryOptions.fields = fields;
                }
            }

            // Handle expansion/population
            if (req.query.expand) {
                const expands = (req.query.expand as string).split(',');
                queryOptions.expand = expands.map(expand => {
                    const [path, select] = expand.split('(');
                    return {
                        path: path.trim(),
                        select: select ? select.replace(')', '').split(' ') : undefined
                    };
                });
            }

            // Handle sorting
            if (req.query.sort) {
                const sortParam = req.query.sort as string;
                if (sortParam.includes(',')) {
                    // Handle multiple sort criteria
                    queryOptions.sort = sortParam.split(',').map(sort => {
                        const [field, order = 'asc'] = sort.split(':');
                        return { field: field.trim(), order: order as 'asc' | 'desc' };
                    });
                } else {
                    // Handle single sort criterion
                    const [field, order = 'asc'] = sortParam.split(':');
                    queryOptions.sort = [{ field: field.trim(), order: order as 'asc' | 'desc' }];
                }
            }

            // Handle pagination
            const page = parseInt(req.query.page as string) || 1;
            const limit = Math.min(
                parseInt(req.query.limit as string) || defaultLimit,
                maxLimit
            );
            const offset = parseInt(req.query.offset as string);
            
            queryOptions.pagination = {
                page,
                limit,
                ...(offset !== undefined && { offset })
            };

            // Handle cursor-based pagination
            if (req.query.cursor) {
                queryOptions.pagination.cursor = req.query.cursor as string;
            }

            // Handle full-text search
            if (req.query.search) {
                queryOptions.fullTextSearch = {
                    searchText: req.query.search as string,
                    language: req.query.language as string,
                    sortByScore: req.query.sortByScore === 'true'
                };
            }

            // Add restricted fields
            if (restrictedFields.length > 0) {
                queryOptions.restrictedFields = restrictedFields;
            }

            // Attach normalized query options to request
            req.queryOptions = queryOptions;
            next();
        } catch (error) {
            next(error);
        }
    };
};