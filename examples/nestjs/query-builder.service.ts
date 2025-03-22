import { Injectable } from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { QueryBuilder } from "@hshanjra/mongoose-query-builder";

@Injectable()
export class QueryBuilderService {
  private queryBuilder: QueryBuilder;

  constructor(@InjectConnection() private connection: Connection) {
    // Initialize with the NestJS Mongoose connection
    this.queryBuilder = new QueryBuilder(connection);
  }

  /**
   * Execute a query using the provided model and configuration
   */
  async query<T>(
    model: string | Model<T>,
    options: {
      fields?: string[] | string;
      filters?: Record<string, any>;
      pagination?: { page?: number; limit?: number };
      sort?: string | string[] | { field: string; order: "asc" | "desc" }[];
      expand?: string | string[] | { path: string; select?: string[] }[];
      fullTextSearch?: {
        searchText: string;
        language?: string;
        caseSensitive?: boolean;
        diacriticSensitive?: boolean;
        sortByScore?: boolean;
      };
      defaultFilters?: Record<string, any>;
      restrictedFields?: string[];
    }
  ) {
    // Pass the model directly instead of a string name
    return this.queryBuilder.graph({
      entity: model,
      ...options,
    });
  }
}
