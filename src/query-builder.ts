import { Document, Model, Query, FilterQuery, HydratedDocument, PopulateOptions } from 'mongoose';
import { QueryOptions } from './types';
import { QueryResponse } from './types/query-response';
import { buildFullTextSearchQuery, includeTextScore, sortByTextScore } from './operators';

export class QueryBuilder<T extends Document> {
    private model: Model<T>;
    private options: QueryOptions;
    private query: Query<HydratedDocument<T>[], HydratedDocument<T>>;

    constructor(model: Model<T>, options: QueryOptions = {}) {
        this.model = model;
        this.options = this.normalizeOptions(options);
        this.query = this.model.find();
    }

    /**
     * Normalize query options from different formats (URL params, API options)
     */
    private normalizeOptions(options: QueryOptions): QueryOptions {
        const normalized: QueryOptions = {};

        // Normalize filters
        if (options.filters) {
            normalized.filters = this.parseFilters(options.filters);
        }

        // Normalize sorting
        if (options.sort) {
            normalized.sorting = this.parseSorting(options.sort);
        }

        // Normalize pagination
        if (options.pagination) {
            normalized.pagination = {
                page: options.pagination.page || 1,
                limit: options.pagination.limit || 10,
                offset: options.pagination.offset,
                cursor: options.pagination.cursor
            };
        }

        // Normalize field selection
        if (options.select) {
            normalized.selectFields = this.parseSelect(options.select);
        }

        // Normalize expansion/population
        if (options.expand) {
            normalized.populate = this.parseExpand(options.expand);
        }

        // Copy other options
        normalized.defaultFilters = options.defaultFilters;
        normalized.excludeFields = options.excludeFields;
        normalized.restrictedFields = options.restrictedFields;
        normalized.fullTextSearch = options.fullTextSearch;
        normalized.modifiers = options.modifiers;

        return normalized;
    }

    /**
     * Parse filter parameters from URL or API options
     */
    private parseFilters(filters: Record<string, any>): Record<string, any> {
        const parsed: Record<string, any> = {};
        
        for (const [key, value] of Object.entries(filters)) {
            if (key.includes('_')) {
                const [field, operator] = key.split('_');
                
                switch(operator) {
                    case 'in':
                    case 'nin':
                    case 'all':
                        parsed[key] = typeof value === 'string' ? value.split(',') : value;
                        break;
                    case 'exists':
                        parsed[key] = String(value).toLowerCase() === 'true';
                        break;
                    case 'gt':
                    case 'gte':
                    case 'lt':
                    case 'lte':
                        parsed[key] = !isNaN(Number(value)) ? Number(value) : value;
                        break;
                    case 'between':
                        if (typeof value === 'string') {
                            const [min, max] = value.split(',').map(Number);
                            if (!isNaN(min) && !isNaN(max)) {
                                parsed[`${field}_gte`] = min;
                                parsed[`${field}_lte`] = max;
                            }
                        }
                        break;
                    case 'regex':
                        parsed[key] = value;
                        break;
                    default:
                        parsed[key] = value;
                }
            } else {
                parsed[key] = value;
            }
        }
        
        return parsed;
    }

    /**
     * Parse sorting parameters from different formats
     */
    private parseSorting(sort: QueryOptions['sort']): Array<{ field: string; order: 'asc' | 'desc' }> {
        if (typeof sort === 'string') {
            return sort.split(',').map(item => {
                const [field, order = 'asc'] = item.split(':');
                return { field, order: order as 'asc' | 'desc' };
            });
        }
        
        if (Array.isArray(sort)) {
            if (typeof sort[0] === 'string') {
                return (sort as string[]).map(item => {
                    const [field, order = 'asc'] = item.split(':');
                    return { field, order: order as 'asc' | 'desc' };
                });
            }
            return sort as Array<{ field: string; order: 'asc' | 'desc' }>;
        }
        
        return [];
    }

    /**
     * Parse field selection parameters
     */
    private parseSelect(select: QueryOptions['select']): string[] {
        if (typeof select === 'string') {
            return select.split(',').map(field => field.trim());
        }
        
        if (Array.isArray(select)) {
            return select;
        }
        
        if (typeof select === 'object') {
            return Object.entries(select)
                .filter(([_, value]) => value === 1)
                .map(([field]) => field);
        }
        
        return [];
    }

    /**
     * Parse expansion/population parameters
     */
    private parseExpand(expand: QueryOptions['expand']): { path: string; select?: string[] }[] {
        if (typeof expand === 'string') {
            return expand.split(',').map(path => ({ path: path.trim() }));
        }
        
        if (Array.isArray(expand)) {
            if (typeof expand[0] === 'string') {
                return (expand as string[]).map(path => ({ path }));
            }
            return expand as { path: string; select?: string[] }[];
        }
        
        return [];
    }

    /**
     * Modify the current query
     */
    public modify(callback: (query: Query<HydratedDocument<T>[], HydratedDocument<T>>) => void): this {
        callback(this.query);
        return this;
    }

    /**
     * Add additional filters to the current query
     */
    public addFilters(filters: Record<string, any>): this {
        this.options.filters = {
            ...this.options.filters,
            ...this.parseFilters(filters)
        };
        return this;
    }

    /**
     * Override the current sorting
     */
    public setSort(sort: QueryOptions['sort']): this {
        this.options.sorting = this.parseSorting(sort);
        return this;
    }

    /**
     * Add fields to select
     */
    public addSelect(fields: string | string[]): this {
        const currentFields = this.options.selectFields || [];
        const newFields = this.parseSelect(fields);
        this.options.selectFields = [...new Set([...currentFields, ...newFields])];
        return this;
    }

    /**
     * Add fields to expand/populate
     */
    public addExpand(expand: QueryOptions['expand']): this {
        const currentExpand = this.options.populate || [];
        const newExpand = this.parseExpand(expand);
        this.options.populate = [...currentExpand, ...newExpand];
        return this;
    }

    /**
     * Builds a Mongoose query based on the provided options
     * @returns Mongoose Query object
     */
    public buildQuery(): Query<HydratedDocument<T>[], HydratedDocument<T>> {
        let query = this.model.find();
        
        // Apply filters first
        query = this.applyFilters(query);
        
        // Apply full-text search if specified
        if (this.options.fullTextSearch) {
            query = this.applyFullTextSearch(query);
        }
        
        // Apply sorting
        query = this.applySorting(query);
        
        // Apply field selection
        query = this.selectFields(query);
        
        // Apply population/expansion
        query = this.applyPopulation(query);
        
        // Apply pagination last
        query = this.paginate(query);
        
        return query;
    }

    /**
     * Executes the query and returns the results in a standardized format
     * @returns Promise resolving to QueryResponse object containing data and metadata
     */
    public async execute(): Promise<QueryResponse<T>> {
        const startTime = Date.now();
        
        // Get the base query
        const query = this.buildQuery();
        
        // Execute the query to get the data
        const data = await query.exec();
        
        // Calculate total count (for pagination metadata)
        let totalCount = 0;
        if (this.options.pagination) {
            // Create a count query with the same filters but no pagination
            const countQuery = this.model.find();
            
            // Apply the same filters as the main query
            let filterQuery: FilterQuery<T> = {};

            if (this.options.filters) {
                const userFilterQuery = this.buildFilterQuery(this.options.filters);
                filterQuery = this.mergeFilterQueries(filterQuery, userFilterQuery);
            }
            
            if (this.options.defaultFilters) {
                const defaultFilterQuery = this.buildFilterQuery(this.options.defaultFilters);
                filterQuery = { ...defaultFilterQuery };
            }
            
            if (Object.keys(filterQuery).length > 0) {
                countQuery.find(filterQuery);
            }
            
            // If full-text search is being used, apply it to the count query
            if (this.options.fullTextSearch) {
                const fullTextSearch = this.options.fullTextSearch;
                const textSearchQuery = buildFullTextSearchQuery({
                    searchText: fullTextSearch.searchText,
                    language: fullTextSearch.language,
                    caseSensitive: fullTextSearch.caseSensitive || false,
                    diacriticSensitive: fullTextSearch.diacriticSensitive || false
                });
                countQuery.find(textSearchQuery as FilterQuery<T>);
            }
            
            // Get the total count
            totalCount = await countQuery.countDocuments();
        } else {
            // If no pagination, total count is the same as data length
            totalCount = data.length;
        }
        
        // Execution time
        const executionTimeMs = Date.now() - startTime;
        
        // Build the pagination metadata
        const { page = 1, limit = 10 } = this.options.pagination || {};
        const totalPages = Math.ceil(totalCount / limit);
        
        // Create the response object
        const response: QueryResponse<T> = {
            data,
            meta: {
                totalCount,
                currentPage: page,
                pageSize: limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                executionTimeMs,
                query: {
                    filters: this.options.filters,
                    sort: this.transformSortingToRecord(this.options.sorting),
                    pagination: this.options.pagination,
                    fields: this.options.selectFields,
                    fullTextSearch: this.options.fullTextSearch
                }
            }
        };
        
        return response;
    }

    private applyFilters(query: Query<HydratedDocument<T>[], HydratedDocument<T>>): Query<HydratedDocument<T>[], HydratedDocument<T>> {
        // Start with empty filter query
        let filterQuery: FilterQuery<T> = {};
        
        // Apply default filters if they exist
        if (this.options.defaultFilters) {
            const defaultFilterQuery = this.buildFilterQuery(this.options.defaultFilters);
            filterQuery = { ...defaultFilterQuery };
        }
        
        // Apply user-specified filters if they exist
        if (this.options.filters) {
            const userFilterQuery = this.buildFilterQuery(this.options.filters);
            
            // Merge default filters with user filters
            // If the same field is filtered in both, combine the conditions with $and
            // to ensure both conditions are met
            filterQuery = this.mergeFilterQueries(filterQuery, userFilterQuery);
        }
        
        // Apply combined filters if not empty
        if (Object.keys(filterQuery).length > 0) {
            return query.find(filterQuery);
        }
        
        return query;
    }
    
    // Helper method to intelligently merge two filter queries
    private mergeFilterQueries(defaultFilters: FilterQuery<T>, userFilters: FilterQuery<T>): FilterQuery<T> {
        const mergedQuery: FilterQuery<T> = { ...defaultFilters };
        
        // For each user filter
        for (const [field, condition] of Object.entries(userFilters)) {
            // If this field already has a condition from default filters
            if (mergedQuery[field]) {
                // If either condition is a simple value (not an object with operators)
                if (
                    (typeof mergedQuery[field] !== 'object' || mergedQuery[field] === null) ||
                    (typeof condition !== 'object' || condition === null)
                ) {
                    // Use $and to combine the conditions
                    mergedQuery.$and = mergedQuery.$and || [];
                    
                    // Create individual field conditions
                    const defaultCondition: Record<string, any> = {};
                    defaultCondition[field] = mergedQuery[field];
                    
                    const userCondition: Record<string, any> = {};
                    userCondition[field] = condition;
                    
                    // Add both conditions to $and array
                    mergedQuery.$and.push(defaultCondition, userCondition);
                    
                    // Remove the original field to avoid duplication
                    delete mergedQuery[field];
                } else {
                    // Both conditions are objects with operators, merge them
                    (mergedQuery as Record<string, any>)[field] = { ...(mergedQuery[field] as object), ...(condition as object) };
                }
            } else {
                // Field doesn't exist in default filters, simply add it
                (mergedQuery as Record<string, any>)[field] = condition;
            }
        }
        
        return mergedQuery;
    }

    private applyFullTextSearch(query: Query<HydratedDocument<T>[], HydratedDocument<T>>): Query<HydratedDocument<T>[], HydratedDocument<T>> {
        // Since this method is only called when fullTextSearch exists, we can use the non-null assertion
        // to let TypeScript know that fullTextSearch is defined here
        const fullTextSearch = this.options.fullTextSearch!;
        
        // Now we can safely destructure the properties
        const { 
            searchText,
            language,
            caseSensitive = false,
            diacriticSensitive = false
        } = fullTextSearch;
        
        const textSearchQuery = buildFullTextSearchQuery({
            searchText,
            language,
            caseSensitive,
            diacriticSensitive
        });
        
        // Apply the text search query
        query = query.find(textSearchQuery);
        
        // Include text score in projection if sortByScore is true
        if (fullTextSearch.sortByScore) {
            query = query.select(includeTextScore());
            
            // If no explicit sort is defined and sortByScore is true, sort by text score
            if (!this.options.sorting && fullTextSearch.sortByScore) {
                query = query.sort(sortByTextScore());
            }
        }
        
        return query;
    }

    private applySorting(query: Query<HydratedDocument<T>[], HydratedDocument<T>>): Query<HydratedDocument<T>[], HydratedDocument<T>> {
        if (this.options.sorting) {
            const sortOptions: Record<string, 1 | -1> = {};
            
            for (const { field, order } of this.options.sorting) {
                sortOptions[field] = order === 'asc' ? 1 : -1;
            }
            
            return query.sort(sortOptions);
        }
        return query;
    }

    private paginate(query: Query<HydratedDocument<T>[], HydratedDocument<T>>): Query<HydratedDocument<T>[], HydratedDocument<T>> {
        if (this.options.pagination) {
            const { page = 1, limit = 10 } = this.options.pagination;
            return query.skip((page - 1) * limit).limit(limit);
        }
        return query;
    }

    private selectFields(query: Query<HydratedDocument<T>[], HydratedDocument<T>>): Query<HydratedDocument<T>[], HydratedDocument<T>> {
        if (this.options.selectFields || this.options.select) {
            const fields = this.options.selectFields || this.parseSelect(this.options.select);
            
            if (fields && fields.length > 0) {
                const modelPaths = Object.keys(this.model.schema.paths)
                    .filter(path => path !== '_id');
                
                // Create select string using minus prefix for exclusion
                const excludedFields = modelPaths
                    .filter(path => !fields.includes(path))
                    .map(path => `-${path}`);
                
                const selectString = [...fields, ...excludedFields].join(' ');
                return query.select(selectString);
            }
        }
        return query;
    }

    /**
     * Apply population/expansion to the query
     */
    private applyPopulation(query: Query<HydratedDocument<T>[], HydratedDocument<T>>): Query<HydratedDocument<T>[], HydratedDocument<T>> {
        const populateOpts = this.options.populate || (this.options.expand ? this.parseExpand(this.options.expand) : undefined);
        
        if (populateOpts) {
            populateOpts.forEach(opt => {
                if (opt.select) {
                    // Get referenced model schema
                    const populatedModel = this.model.db.model(
                        this.model.schema.path(opt.path).options.ref
                    );
                    const modelPaths = Object.keys(populatedModel.schema.paths)
                        .filter(path => path !== '_id');
                    
                    // Create select string with exclusions for populated documents
                    const excludedFields = modelPaths
                        .filter(path => !opt.select?.includes(path))
                        .map(path => `-${path}`);
                    
                    const selectString = [...opt.select, ...excludedFields].join(' ');
                    
                    query = query.populate({
                        path: opt.path,
                        select: selectString
                    }) as unknown as Query<HydratedDocument<T>[], HydratedDocument<T>>;
                } else {
                    query = query.populate(opt.path) as unknown as Query<HydratedDocument<T>[], HydratedDocument<T>>;
                }
            });
        }
        
        return query;
    }

    // Helper methods
    private buildFilterQuery(filters: Record<string, any>): FilterQuery<T> {
        const query: FilterQuery<T> = {};
        
        for (const [key, value] of Object.entries(filters)) {
            // Check if the key follows the pattern fieldName_operator
            if (key.includes('_')) {
                const [fieldName, operator] = key.split('_');
                
                // Map the operator to MongoDB operator
                const mongoOperator = this.mapOperatorToMongoOperator(operator);
                
                if (mongoOperator) {
                    // Special case for direct equality operator
                    if (mongoOperator === '$eq') {
                        query[fieldName as keyof T] = value;
                    } else {
                        // Initialize field object if it doesn't exist
                        query[fieldName as keyof T] = (query[fieldName as keyof T] || {}) as FilterQuery<T>[keyof T];
                        const fieldQuery = query[fieldName as keyof T] as Record<string, any>;
                        
                        // Handle arrays for operators like $in, $nin
                        if (['$in', '$nin'].includes(mongoOperator) && !Array.isArray(value)) {
                            fieldQuery[mongoOperator] = typeof value === 'string' ? value.split(',') : [value];
                        } else {
                            fieldQuery[mongoOperator] = value;
                        }
                    }
                }
            } else {
                // Regular field without operator, treat as equality
                query[key as keyof T] = value;
            }
        }
        
        return query;
    }

    private mapOperatorToMongoOperator(operator: string): string | null {
        const operatorMap: Record<string, string> = {
            'eq': '$eq',
            'ne': '$ne',
            'gt': '$gt',
            'gte': '$gte',
            'lt': '$lt',
            'lte': '$lte',
            'in': '$in',
            'nin': '$nin',
            'regex': '$regex',
            'exists': '$exists',
            'type': '$type',
            'mod': '$mod',
            'all': '$all',
            'size': '$size',
            'elemMatch': '$elemMatch',
            'text': '$text'
        };
        
        return operatorMap[operator] || null;
    }
    
    private transformSortingToRecord(sorting?: { field: string; order: "asc" | "desc"; }[]): Record<string, string> | undefined {
        if (!sorting) return undefined;
        
        const sortRecord: Record<string, string> = {};
        for (const { field, order } of sorting) {
            sortRecord[field] = order;
        }
        return sortRecord;
    }

    /**
     * Create a new instance with the same options
     */
    public clone(): QueryBuilder<T> {
        return new QueryBuilder(this.model, { ...this.options });
    }

    public aggregate<R = any>(pipeline: any[]): {
        execute(): Promise<R[]>;
    } {
        return {
            execute: async () => {
                const result = await this.model.aggregate(pipeline);
                return result as R[];
            }
        };
    }
}