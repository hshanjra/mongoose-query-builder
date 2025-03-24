import { Request, Response, NextFunction } from "express";
import { QueryOptions } from "../types";

// Extend the Express Request interface
declare global {
  namespace Express {
    interface Request {
      queryOptions: {
        fields?: string[];
        filters?: Record<string, any>;
        pagination?: {
          page?: number;
          limit?: number;
          offset?: number;
          cursor?: string;
        };
        sort?: string | Array<{ field: string; order: "asc" | "desc" }>;
        expand?: Array<{ path: string; select?: string[] }>;
        fullTextSearch?: {
          searchText: string;
          language?: string;
          sortByScore?: boolean;
        };
        defaultFilters?: Record<string, any>;
        restrictedFields?: string[];
      };
    }
  }
}

export interface QueryBuilderMiddlewareOptions {
  maxLimit?: number;
  defaultLimit?: number;
  allowedFields?: string[];
  restrictedFields?: string[];
  defaultFilters?: Record<string, any>;
  routeConfig?: Record<
    string,
    {
      maxLimit?: number;
      defaultLimit?: number;
      allowedFields?: string[];
      restrictedFields?: string[];
      defaultFilters?: Record<string, any>;
    }
  >;
}

export const QueryBuilderMiddleware = (
  options: QueryBuilderMiddlewareOptions = {}
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get route-specific config if exists
      const routeConfig = options.routeConfig?.[req.path] || {};

      const queryOptions: Request["queryOptions"] = {};
      const {
        maxLimit = routeConfig.maxLimit || 100,
        defaultLimit = routeConfig.defaultLimit || 10,
        allowedFields = routeConfig.allowedFields,
        restrictedFields = routeConfig.restrictedFields || [],
        defaultFilters = {
          ...options.defaultFilters,
          ...routeConfig.defaultFilters,
        },
      } = options;

      // Parse filters from query params
      const reservedParams = new Set([
        "select",
        "expand",
        "sort",
        "page",
        "limit",
        "offset",
        "cursor",
        "search",
        "fields",
        "searchLanguage",
        "searchScore",
      ]);

      // Handle filters
      queryOptions.filters = {};
      Object.entries(req.query).forEach(([key, value]) => {
        if (!reservedParams.has(key) && value !== undefined) {
          // Handle array values (e.g., tags_in=tag1,tag2)
          if (typeof value === "string" && key.endsWith("_in")) {
            queryOptions.filters![key] = value.split(",");
          } else if (typeof value === "string") {
            // Convert numeric strings to numbers
            const numValue = Number(value);
            queryOptions.filters![key] = !isNaN(numValue) ? numValue : value;
          } else {
            queryOptions.filters![key] = value;
          }
        }
      });

      // Apply default filters if provided
      if (defaultFilters) {
        queryOptions.defaultFilters = defaultFilters;
      }

      // Handle field selection
      if (req.query.select || req.query.fields) {
        const selectFields = (req.query.select || req.query.fields) as string;
        const fields = selectFields.split(",").map((field) => field.trim());

        if (allowedFields) {
          queryOptions.fields = fields.filter((field) =>
            allowedFields.includes(field.replace(/^-/, ""))
          );
        } else {
          queryOptions.fields = fields;
        }
      }

      // Handle expansion/population
      if (req.query.expand) {
        const expandStr = req.query.expand as string;
        const expands: Array<{ path: string; select?: string[] }> = [];
        let currentPath = "";
        let buffer = "";
        let inParentheses = false;

        // Parse character by character to handle nested parentheses
        for (let i = 0; i < expandStr.length; i++) {
          const char = expandStr[i];
          if (char === "(" && !inParentheses) {
            inParentheses = true;
            currentPath = buffer.trim();
            buffer = "";
          } else if (char === ")" && inParentheses) {
            inParentheses = false;
            expands.push({
              path: currentPath,
              select: buffer.split(",").map((s) => s.trim()),
            });
            buffer = "";
          } else if (char === "," && !inParentheses) {
            if (buffer.trim()) {
              expands.push({ path: buffer.trim() });
            }
            buffer = "";
          } else {
            buffer += char;
          }
        }

        // Handle last item
        if (buffer.trim()) {
          expands.push({ path: buffer.trim() });
        }

        queryOptions.expand = expands;
      }

      // Handle sorting
      if (req.query.sort) {
        const sortParam = req.query.sort as string;
        const validOrders = new Set(["asc", "desc"]);

        try {
          if (sortParam.includes(",")) {
            // Handle multiple sort criteria
            const sortFields = sortParam
              .split(",")
              .map((sort) => {
                const [field, order = "asc"] = sort.split(":");
                return validOrders.has(order.toLowerCase())
                  ? {
                      field: field.trim(),
                      order: order.toLowerCase() as "asc" | "desc",
                    }
                  : null;
              })
              .filter(Boolean);

            if (sortFields.length > 0) {
              queryOptions.sort = sortFields.filter(
                (field): field is { field: string; order: "asc" | "desc" } =>
                  field !== null
              );
            }
          } else {
            // Handle single sort criterion
            const [field, order = "asc"] = sortParam.split(":");
            if (validOrders.has(order.toLowerCase())) {
              queryOptions.sort = [
                {
                  field: field.trim(),
                  order: order.toLowerCase() as "asc" | "desc",
                },
              ];
            }
          }
        } catch (error) {
          // Invalid sort parameter - ignore it
        }
      }

      // Handle pagination
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(
        parseInt(req.query.limit as string) || defaultLimit,
        maxLimit
      );

      queryOptions.pagination = {
        page,
        limit,
      };

      // Handle cursor-based pagination
      if (req.query.cursor) {
        queryOptions.pagination.cursor = req.query.cursor as string;
      }

      // Handle full-text search
      if (req.query.search) {
        queryOptions.fullTextSearch = {
          searchText: req.query.search as string,
          ...(req.query.searchLanguage && {
            language: req.query.searchLanguage as string,
          }),
          sortByScore: req.query.searchScore === "true",
        };
      }

      // Add restricted fields
      if (restrictedFields.length > 0) {
        queryOptions.restrictedFields = restrictedFields;
      }

      // Attach normalized query options to request
      req.queryOptions = queryOptions;
      next();
    } catch (error) {
      next(error);
    }
  };
};
