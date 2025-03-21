export const isValidObjectId = (id: string): boolean => {
    return /^[0-9a-fA-F]{24}$/.test(id);
};

export const sanitizeQuery = (query: Record<string, any>): Record<string, any> => {
    const sanitizedQuery: Record<string, any> = {};
    for (const key in query) {
        if (query[key] !== undefined && query[key] !== null) {
            sanitizedQuery[key] = query[key];
        }
    }
    return sanitizedQuery;
};

export const parsePagination = (page: string | undefined, limit: string | undefined): { page: number; limit: number } => {
    const parsedPage = parseInt(page || '1', 10);
    const parsedLimit = parseInt(limit || '10', 10);
    return {
        page: isNaN(parsedPage) ? 1 : parsedPage,
        limit: isNaN(parsedLimit) ? 10 : parsedLimit,
    };
};

export const isObject = (value: any): boolean => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
};