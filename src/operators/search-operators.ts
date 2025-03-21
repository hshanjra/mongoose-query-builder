import { FilterQuery } from 'mongoose';

export interface SearchOptions {
    searchField: string;
    searchValue: string | number;
    caseSensitive?: boolean;
}

export interface FullTextSearchOptions {
    searchText: string;
    language?: string;
    caseSensitive?: boolean;
    diacriticSensitive?: boolean;
    weight?: Record<string, number>;
}

export function buildSearchQuery(options: SearchOptions): FilterQuery<any> {
    const { searchField, searchValue, caseSensitive = false } = options;

    const query: FilterQuery<any> = {};

    if (caseSensitive) {
        query[searchField] = { $regex: searchValue, $options: '' };
    } else {
        query[searchField] = { $regex: searchValue, $options: 'i' };
    }

    return query;
}

/**
 * Build a full-text search query using MongoDB's text index capabilities.
 * Note: The collection must have a text index configured for the fields to be searched.
 * 
 * @param options FullTextSearchOptions configuration for the full-text search
 * @returns A MongoDB filter query object
 */
export function buildFullTextSearchQuery(options: FullTextSearchOptions): FilterQuery<any> {
    const { 
        searchText, 
        language, 
        caseSensitive = false,
        diacriticSensitive = false,
        weight
    } = options;
    
    const query: FilterQuery<any> = {
        $text: {
            $search: searchText,
            $caseSensitive: caseSensitive,
            $diacriticSensitive: diacriticSensitive
        }
    };

    // Add language if specified
    if (language) {
        (query.$text as { $language?: string }).$language = language;
    }

    return query;
}

/**
 * Creates a text score projection to sort results by relevance.
 * This can be used in conjunction with sort to order results by text search relevance.
 * 
 * @returns A projection object that includes the text score
 */
export function includeTextScore(): Record<string, any> {
    return { score: { $meta: "textScore" } };
}

/**
 * Create a sort specification to order by text search relevance
 * 
 * @returns A sort specification that orders by text relevance score
 */
export function sortByTextScore(): Record<string, any> {
    return { score: { $meta: "textScore" } };
}