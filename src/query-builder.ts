import mongoose, {
  Document,
  Model,
  Query,
  FilterQuery,
  Connection,
} from "mongoose";
import { QueryOptions, GraphQueryConfig, GraphQueryResponse } from "./types";
import {
  buildFullTextSearchQuery,
  includeTextScore,
  sortByTextScore,
} from "./operators";

export class QueryBuilder {
  private connection: Connection | null = null;

  constructor(connection?: Connection) {
    this.connection = connection || null;
  }

  /**
   * Execute a query using the provided configuration
   * @param config Configuration object with entity name and query options
   * @returns Promise resolving to the query results with data and metadata
   */
  public async graph<T extends Document>(
    config: GraphQueryConfig<T>
  ): Promise<GraphQueryResponse<T>> {
    const { entity, ...queryConfig } = config;

    // Get the model from the connection or use the provided model directly
    let model: Model<T>;

    if (typeof entity === "string") {
      try {
        // Try to get the model from the provided connection first
        if (this.connection) {
          model = this.connection.model<T>(entity);
        } else {
          // Fall back to global mongoose
          model = mongoose.model<T>(entity);
        }
      } catch (error) {
        throw new Error(
          `Model "${entity}" not found. Make sure the model is registered with mongoose before using it with QueryBuilder.`
        );
      }
    } else if (entity && typeof entity === "object" && "find" in entity) {
      // User directly passed a model instance
      model = entity as Model<T>;
    } else {
      throw new Error(
        "Invalid entity provided. Please provide either a model name string or a Mongoose Model instance."
      );
    }

    // Start timing execution
    const startTime = Date.now();

    // Build the normalized options
    const options = this.normalizeOptions(queryConfig);

    // Build and execute the query
    const query = this.buildQuery(model, options);
    const data = (await query.exec()) as unknown as T[];

    // Calculate total count for pagination
    let totalCount = 0;
    if (options.pagination) {
      const countQuery = this.buildCountQuery(model, options);
      totalCount = await countQuery.countDocuments();
    } else {
      totalCount = data.length;
    }

    // Calculate pagination metadata
    const { page = 1, limit = 10 } = options.pagination || {};
    const totalPages = Math.ceil(totalCount / limit);

    // Calculate execution time
    const executionTimeMs = Date.now() - startTime;

    // Return the standardized response
    return {
      data,
      metadata: {
        totalCount,
        currentPage: page,
        pageSize: limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        executionTimeMs,
        query: {
          filters: options.filters,
          sort: this.transformSortingToRecord(options.sorting),
          pagination: options.pagination
            ? {
                page: options.pagination.page,
                limit: options.pagination.limit,
              }
            : undefined,
          fields: options.selectFields,
          fullTextSearch: options.fullTextSearch,
        },
      },
    };
  }

  // Private helper methods

  private normalizeOptions(options: Partial<GraphQueryConfig>): QueryOptions {
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
        cursor: options.pagination.cursor,
      };
    }

    // Normalize field selection
    if (options.fields) {
      normalized.selectFields = this.parseSelect(options.fields);
    }

    // Normalize expansion/population
    if (options.expand) {
      normalized.populate = this.parseExpand(options.expand);
    }

    // Copy other options
    normalized.defaultFilters = options.defaultFilters;
    normalized.restrictedFields = options.restrictedFields;
    normalized.fullTextSearch = options.fullTextSearch;

    return normalized;
  }

  private parseFilters(filters: Record<string, any>): Record<string, any> {
    const parsed: Record<string, any> = {};

    for (const [key, value] of Object.entries(filters)) {
      if (key.includes("_")) {
        const [field, operator] = key.split("_");

        switch (operator) {
          case "in":
          case "nin":
          case "all":
            parsed[key] = typeof value === "string" ? value.split(",") : value;
            break;
          case "exists":
            parsed[key] = String(value).toLowerCase() === "true";
            break;
          case "gt":
          case "gte":
          case "lt":
          case "lte":
            parsed[key] = !isNaN(Number(value)) ? Number(value) : value;
            break;
          case "between":
            if (typeof value === "string") {
              const [min, max] = value.split(",").map(Number);
              if (!isNaN(min) && !isNaN(max)) {
                parsed[`${field}_gte`] = min;
                parsed[`${field}_lte`] = max;
              }
            }
            break;
          case "regex":
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

  private parseSorting(
    sort: QueryOptions["sort"]
  ): Array<{ field: string; order: "asc" | "desc" }> {
    if (typeof sort === "string") {
      return sort.split(",").map((item) => {
        const [field, order = "asc"] = item.split(":");
        return { field, order: order.toLowerCase() as "asc" | "desc" };
      });
    }

    if (Array.isArray(sort)) {
      if (sort.length === 0) {
        return [];
      }

      if (typeof sort[0] === "string") {
        return (sort as string[]).map((item) => {
          const [field, order = "asc"] = item.split(":");
          return { field, order: order.toLowerCase() as "asc" | "desc" };
        });
      }

      return (sort as Array<{ field: string; order: "asc" | "desc" }>).map(
        (item) => ({
          field: item.field,
          order: (item.order || "asc").toLowerCase() as "asc" | "desc",
        })
      );
    }

    return [];
  }

  private parseSelect(select: QueryOptions["select"]): string[] {
    if (typeof select === "string") {
      return select.split(",").map((field) => field.trim());
    }

    if (Array.isArray(select)) {
      return select;
    }

    if (typeof select === "object" && select !== null) {
      return Object.entries(select)
        .filter(([_, value]) => value === 1)
        .map(([field]) => field);
    }

    return [];
  }

  private parseExpand(
    expand: QueryOptions["expand"]
  ): { path: string; select?: string[] }[] {
    if (typeof expand === "string") {
      return expand.split(",").map((path) => ({ path: path.trim() }));
    }

    if (Array.isArray(expand)) {
      if (expand.length === 0) {
        return [];
      }

      if (typeof expand[0] === "string") {
        return (expand as string[]).map((path) => ({ path }));
      }
      return (expand as Array<{ path: string; select?: string[] }>).map(
        (item) => ({
          path: item.path,
          select: item.select,
        })
      );
    }

    return [];
  }

  private buildQuery<T extends Document>(
    model: Model<T>,
    options: QueryOptions
  ): Query<T[], T> {
    let query = model.find() as Query<T[], T>;

    // Apply filters first
    query = this.applyFilters(model, query, options);

    // Apply full-text search if specified
    if (options.fullTextSearch) {
      query = this.applyFullTextSearch(query, options.fullTextSearch);
    }

    // Apply sorting
    if (options.sorting && options.sorting.length > 0) {
      const sortOptions: Record<string, 1 | -1> = {};
      for (const { field, order } of options.sorting) {
        sortOptions[field] = order === "asc" ? 1 : -1;
      }
      query = query.sort(sortOptions);
    }

    // Apply field selection
    if (options.selectFields && options.selectFields.length > 0) {
      const projection: Record<string, 1> = {};
      options.selectFields.forEach((field) => {
        if (field === "-_id") {
          delete projection._id;
        } else if (!field.startsWith("-")) {
          projection[field] = 1;
        }
      });
      query = query.select(projection);
    }

    // Apply population/expansion
    const populateOpts = options.populate;
    if (populateOpts && populateOpts.length > 0) {
      populateOpts.forEach((opt) => {
        if (opt.select && opt.select.length > 0) {
          // Only use inclusion projection for populated fields
          const projection: Record<string, 1> = {};
          opt.select.forEach((field) => {
            if (!field.startsWith("-")) {
              projection[field] = 1;
            }
          });

          // Add _id by default unless explicitly excluded
          if (!opt.select.includes("-_id")) {
            projection._id = 1;
          }

          query = query.populate({
            path: opt.path,
            select: projection,
          }) as Query<T[], T>;
        } else {
          query = query.populate(opt.path) as Query<T[], T>;
        }
      });
    }

    // Apply pagination last
    if (options.pagination) {
      const { page = 1, limit = 10 } = options.pagination;
      query = query.skip((page - 1) * limit).limit(limit);
    }

    return query;
  }

  private buildCountQuery<T extends Document>(
    model: Model<T>,
    options: QueryOptions
  ): Query<number, T> {
    let query = model.find() as Query<T[], T>;

    // Apply filters
    query = this.applyFilters(model, query, options);

    // Apply full-text search if specified
    if (options.fullTextSearch) {
      query = this.applyFullTextSearch(query, options.fullTextSearch);
    }

    return query as unknown as Query<number, T>;
  }

  private applyFilters<T extends Document>(
    model: Model<T>,
    query: Query<T[], T>,
    options: QueryOptions
  ): Query<T[], T> {
    // Start with empty filter query
    let filterQuery: FilterQuery<T> = {};

    // Apply default filters if they exist
    if (options.defaultFilters) {
      const defaultFilterQuery = this.buildFilterQuery(options.defaultFilters);
      filterQuery = { ...defaultFilterQuery };
    }

    // Apply user-specified filters if they exist
    if (options.filters) {
      const userFilterQuery = this.buildFilterQuery(options.filters);

      // Merge default filters with user filters
      filterQuery = this.mergeFilterQueries(filterQuery, userFilterQuery);
    }

    // Apply combined filters if not empty
    if (Object.keys(filterQuery).length > 0) {
      return query.find(filterQuery);
    }

    return query;
  }

  private applyFullTextSearch<T extends Document>(
    query: Query<T[], T>,
    fullTextSearch: NonNullable<QueryOptions["fullTextSearch"]>
  ): Query<T[], T> {
    const {
      searchText,
      language,
      caseSensitive = false,
      diacriticSensitive = false,
      sortByScore = false,
    } = fullTextSearch;

    const textSearchQuery = buildFullTextSearchQuery({
      searchText,
      language,
      caseSensitive,
      diacriticSensitive,
    });

    // Apply the text search query
    query = query.find(textSearchQuery);

    // Include text score in projection if sortByScore is true
    if (sortByScore) {
      query = query.select(includeTextScore());
      query = query.sort(sortByTextScore());
    }

    return query;
  }

  // Helper methods for query building
  private mergeFilterQueries<T>(
    defaultFilters: FilterQuery<T>,
    userFilters: FilterQuery<T>
  ): FilterQuery<T> {
    const mergedQuery: FilterQuery<T> = { ...defaultFilters };

    // For each user filter
    for (const [field, condition] of Object.entries(userFilters)) {
      // If this field already has a condition from default filters
      if (field in mergedQuery) {
        // If either condition is a simple value (not an object with operators)
        if (
          typeof mergedQuery[field] !== "object" ||
          mergedQuery[field] === null ||
          typeof condition !== "object" ||
          condition === null
        ) {
          // Use $and to combine the conditions
          if (!mergedQuery.$and) {
            mergedQuery.$and = [];
          }

          // Create individual field conditions
          const defaultCondition: Record<string, any> = {};
          defaultCondition[field] = mergedQuery[field];

          const userCondition: Record<string, any> = {};
          userCondition[field] = condition;

          // Add both conditions to $and array
          mergedQuery.$and.push(defaultCondition, userCondition);

          // Remove the original field to avoid duplication
          delete mergedQuery[field as keyof typeof mergedQuery];
        } else {
          // Both conditions are objects with operators, merge them
          (mergedQuery as Record<string, any>)[field] = {
            ...(mergedQuery[field] as object),
            ...(condition as object),
          };
        }
      } else {
        // Field doesn't exist in default filters, simply add it
        (mergedQuery as Record<string, any>)[field] = condition;
      }
    }

    return mergedQuery;
  }

  private buildFilterQuery(filters: Record<string, any>): FilterQuery<any> {
    const query: FilterQuery<any> = {};

    for (const [key, value] of Object.entries(filters)) {
      // Check if the key follows the pattern fieldName_operator
      if (key.includes("_")) {
        const [fieldName, operator] = key.split("_");

        // Map the operator to MongoDB operator
        const mongoOperator = this.mapOperatorToMongoOperator(operator);

        if (mongoOperator) {
          // Special case for direct equality operator
          if (mongoOperator === "$eq") {
            query[fieldName] = value;
          } else {
            // Initialize field object if it doesn't exist
            query[fieldName] = (query[fieldName] ||
              {}) as FilterQuery<any>[string];
            const fieldQuery = query[fieldName] as Record<string, any>;

            // Handle arrays for operators like $in, $nin
            if (
              ["$in", "$nin"].includes(mongoOperator) &&
              !Array.isArray(value)
            ) {
              fieldQuery[mongoOperator] =
                typeof value === "string" ? value.split(",") : [value];
            } else {
              fieldQuery[mongoOperator] = value;
            }
          }
        }
      } else {
        // Regular field without operator, treat as equality
        query[key] = value;
      }
    }

    return query;
  }

  private mapOperatorToMongoOperator(operator: string): string | null {
    const operatorMap: Record<string, string> = {
      eq: "$eq",
      ne: "$ne",
      gt: "$gt",
      gte: "$gte",
      lt: "$lt",
      lte: "$lte",
      in: "$in",
      nin: "$nin",
      regex: "$regex",
      exists: "$exists",
      type: "$type",
      mod: "$mod",
      all: "$all",
      size: "$size",
      elemMatch: "$elemMatch",
      text: "$text",
    };

    return operatorMap[operator] || null;
  }

  private transformSortingToRecord(
    sorting?: { field: string; order: "asc" | "desc" }[]
  ): Record<string, string> | undefined {
    if (!sorting) return undefined;

    const sortRecord: Record<string, string> = {};
    for (const { field, order } of sorting) {
      sortRecord[field] = order;
    }
    return sortRecord;
  }
}
