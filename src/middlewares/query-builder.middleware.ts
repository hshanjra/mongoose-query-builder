import { Request, Response, NextFunction } from 'express';
import { QueryOptions } from '../types';

// Extend the Express Request interface
declare global {
    namespace Express {
        interface Request {
            queryOptions: QueryOptions;
        }
    }
}

export const queryBuilderMiddleware = (options: {
    maxLimit?: number;
    defaultLimit?: number;
    allowedFields?: string[];
    restrictedFields?: string[];
} = {}) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const queryOptions: QueryOptions = {};
            const {
                maxLimit = 100,
                defaultLimit = 10,
                allowedFields,
                restrictedFields
            } = options;

            // Parse filters from query params
            const reservedParams = new Set([
                'select', 'expand', 'sort', 'page', 'limit', 
                'offset', 'cursor', 'search', 'fields'
            ]);

            // Handle filters
            queryOptions.filters = {};
            Object.entries(req.query).forEach(([key, value]) => {
                if (!reservedParams.has(key) && value !== undefined) {
                    queryOptions.filters![key] = value;
                }
            });

            // Handle field selection
            if (req.query.select || req.query.fields) {
                const selectFields = (req.query.select || req.query.fields) as string;
                if (allowedFields) {
                    queryOptions.select = selectFields
                        .split(',')
                        .filter(field => allowedFields.includes(field));
                } else {
                    queryOptions.select = selectFields;
                }
            }

            // Handle expansion/population
            if (req.query.expand) {
                queryOptions.expand = (req.query.expand as string)
                    .split(',')
                    .map(path => ({ path: path.trim() }));
            }

            // Handle sorting
            if (req.query.sort) {
                queryOptions.sort = req.query.sort as string;
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
                    sortByScore: true
                };
            }

            // Add restricted fields
            if (restrictedFields) {
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