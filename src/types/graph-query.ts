import { Model, Document } from "mongoose";
import { QueryOptions } from "./query-options";
import { QueryResponseMetadata } from "./query-response";

/**
 * Configuration object for graph method
 */
export interface GraphQueryConfig<T extends Document = Document> {
  /**
   * The entity to query - either a string model name or a Mongoose model
   */
  entity: string | Model<T>;

  /**
   * Fields to select in the result
   */
  fields?: QueryOptions["select"];

  /**
   * Query filters to apply
   */
  filters?: Record<string, any>;

  /**
   * Pagination options
   */
  pagination?: {
    page?: number;
    limit?: number;
    offset?: number;
    cursor?: string;
  };

  /**
   * Sorting configuration
   */
  sort?: QueryOptions["sort"];

  /**
   * Fields to expand/populate in the result
   */
  expand?: QueryOptions["expand"];

  /**
   * Full-text search options
   */
  fullTextSearch?: QueryOptions["fullTextSearch"];

  /**
   * Default filters that are always applied
   */
  defaultFilters?: Record<string, any>;

  /**
   * Fields that cannot be queried
   */
  restrictedFields?: string[];
}

/**
 * Response from the graph method
 */
export interface GraphQueryResponse<T extends Document = Document> {
  /**
   * The matched documents
   */
  data: T[];

  /**
   * Metadata about the query execution
   */
  metadata: QueryResponseMetadata;
}
