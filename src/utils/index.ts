import { QueryOptions } from "../types";
import { isObject } from "./helpers";

export const buildQueryOptions = (queryParams: QueryParams): QueryOptions => {
    const options: QueryOptions = {
        filters: {},
        sort: undefined,
        pagination: {
            page: 1,
            limit: 10,
        },
        fields: {},
    };

    if (queryParams.filters && isObject(queryParams.filters)) {
        options.filters = queryParams.filters;
    }

    if (queryParams.sort) {
        options.sort = queryParams.sort;
    }

    if (queryParams.page) {
        options.pagination.page = parseInt(queryParams.page, 10) || 1;
    }

    if (queryParams.limit) {
        options.pagination.limit = parseInt(queryParams.limit, 10) || 10;
    }

    if (queryParams.fields) {
        options.fields = queryParams.fields.split(',').reduce<Record<string, number>>((acc, field) => {
            acc[field] = 1;
            return acc;
        }, {});
    }

    return options;
};