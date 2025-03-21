export interface QueryResponse<T> {
    /**
     * Array of documents that match the query criteria
     */
    data: T[];
    
    /**
     * Metadata about the query results
     */
    meta: {
        /**
         * Total number of documents that match the query criteria (without pagination)
         */
        totalCount: number;
        
        /**
         * Current page number
         */
        currentPage: number;
        
        /**
         * Number of documents per page
         */
        pageSize: number;
        
        /**
         * Total number of pages available
         */
        totalPages: number;
        
        /**
         * Whether there is a next page of results
         */
        hasNextPage: boolean;
        
        /**
         * Whether there is a previous page of results
         */
        hasPrevPage: boolean;
        
        /**
         * Time taken to execute the query in milliseconds
         */
        executionTimeMs?: number;
        
        /**
         * Query parameters used to generate these results
         */
        query?: {
            filters?: Record<string, any>;
            sort?: Record<string, string>;
            pagination?: {
                page: number;
                limit: number;
            };
            fields?: string | string[];
            fullTextSearch?: {
                searchText: string;
                [key: string]: any;
            };
        };
    };
}