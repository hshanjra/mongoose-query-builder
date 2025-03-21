import { FilterQuery } from 'mongoose';

export interface FullTextSearchOptions {
    /**
     * The text to search for in text indices
     */
    searchText: string;
    
    /**
     * Override the default language for text search
     */
    language?: string;
    
    /**
     * Whether the text search should be case sensitive
     * Default: false
     */
    caseSensitive?: boolean;
    
    /**
     * Whether the text search should be diacritic sensitive
     * Default: false
     */
    diacriticSensitive?: boolean;
    
    /**
     * Whether to sort results by text search relevance score
     * Default: false
     */
    sortByScore?: boolean;
}

export interface QueryOptions {
    /**
     * Query filters
     * Supports both direct browser query params and programmatic filters
     */
    filters?: Record<string, any>;
    
    /**
     * Default filters that are always applied regardless of user filters
     */
    defaultFilters?: Record<string, any>;
    
    /**
     * Sorting configuration
     * Supports both string format (createdAt:desc) and object format
     */
    sort?: string | string[] | Array<{ field: string; order: 'asc' | 'desc' }>;
    sorting?: Array<{ field: string; order: 'asc' | 'desc' }>;

    /**
     * Pagination options
     * Supports both offset/limit and cursor-based pagination
     */
    pagination?: {
        page: number;
        limit: number;
        offset?: number;
        cursor?: string;
    };

    /**
     * Fields to select
     * Supports comma-separated string, array, or object format
     */
    select?: string | string[] | Record<string, 1 | 0>;
    selectFields?: string[];

    /**
     * Fields to expand/populate
     * Supports dot notation for nested relations
     */
    expand?: string | string[] | Array<{ path: string; select?: string[] }>;
    populate?: Array<{ path: string; select?: string[] }>;

    /**
     * Fields to exclude from results
     */
    excludeFields?: string[];
    
    /**
     * Fields that cannot be queried or selected
     */
    restrictedFields?: string[];
    
    /**
     * Full-text search options
     */
    fullTextSearch?: FullTextSearchOptions;

    /**
     * Additional query modifiers to be applied
     */
    modifiers?: {
        beforeQuery?: <T>(query: FilterQuery<T>) => Promise<FilterQuery<T>>;
        afterQuery?: <T>(results: T[]) => Promise<T[]>;
    };
}

