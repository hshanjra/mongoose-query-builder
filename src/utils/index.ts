import { isObject } from './helpers';
import { QueryParams, QueryOptions } from '../types/query-options';

export const buildQueryOptions = (queryParams: QueryParams): QueryOptions => {
    // Initialize options with default values
    const options: QueryOptions = {
        filters: {},
        sorting: []
    };

    // Handle filters
    if (queryParams.filters && isObject(queryParams.filters)) {
        options.filters = queryParams.filters;
    }

    // Handle sorting
    if (queryParams.sort) {
        if (typeof queryParams.sort === 'string') {
            const [field, order = 'asc'] = queryParams.sort.split(':');
            options.sorting = [{ field, order: order as 'asc' | 'desc' }];
        } else if (Array.isArray(queryParams.sort)) {
            if (typeof queryParams.sort[0] === 'string') {
                options.sorting = queryParams.sort.map((item) => {
                    if (typeof item === 'string') {
                        const [field, order = 'asc'] = item.split(':');
                        return { field, order: order as 'asc' | 'desc' };
                    } else {
                        return item;
                    }
                });
            } else {
                options.sorting = queryParams.sort as Array<{ field: string; order: 'asc' | 'desc' }>;
            }
        }
    }

    // Handle pagination
    if (queryParams.page || queryParams.limit) {
        options.pagination = {
            page: parseInt(queryParams.page || '1', 10),
            limit: parseInt(queryParams.limit || '10', 10)
        };
    }

    // Handle field selection
    if (queryParams.fields) {
        options.select = queryParams.fields;
    }

    return options;
}