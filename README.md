# Mongoose Query Builder

A powerful and flexible TypeScript-first query builder for Mongoose that simplifies complex MongoDB queries. This package provides a clean, intuitive interface for building queries with support for search, filtering, sorting, pagination, population, field selection, and more.

## Features

- **Dynamic Model Loading**: Use model names directly without importing models for better decoupling
- **TypeScript Support**: Full type safety with generic types for documents and responses
- **Full-Text Search**: Built-in text search with score sorting and language support
- **Rich Filtering**: Comprehensive filtering API with MongoDB-style operators
- **Default Filters**: Apply global or context-specific filters (great for multi-tenant systems)
- **Flexible Sorting**: Sort by single or multiple fields with type-safe ordering
- **Smart Pagination**: Built-in pagination with detailed metadata
- **Deep Population**: Populate nested relationships with field selection
- **Field Selection**: Fine-grained control over returned fields
- **Restricted Fields**: Control which fields can be populated
- **Restricted Fields**: Control which fields can be populated
- **Framework Support**: Works with Express, NestJS, and vanilla Node.js/TypeScript applications
- **Built-in Middleware**: Built-in express middleware to parse the query from incoming request

## Installation

```bash
npm install @hshanjra/mongoose-query-builder mongoose
```

> **Note**: This package requires `mongoose` as a peer dependency. You need to install it separately in your project.

## Basic Usage

```typescript
import { QueryBuilder } from "@hshanjra/mongoose-query-builder";
import { Document } from "mongoose";

// Define your document interface
interface UserDocument extends Document {
  name: string;
  email: string;
  age: number;
  status: string;
}

// Initialize the query builder
const query = new QueryBuilder();

// Execute a type-safe query
const { data, metadata } = await query.graph<UserDocument>({
  entity: "User", // Use model name string
  fields: ["name", "email", "age"],
  filters: {
    age_gte: 18,
    status: "active",
  },
  pagination: {
    page: 1,
    limit: 10,
  },
});

console.log("Users:", data);
console.log("Metadata:", metadata);
```

## Query Options

### Configuration Object

```typescript
interface GraphQueryConfig<T extends Document> {
  // Required: Model name (prefer string over model instance)
  entity: string;

  // Optional: Fields to select
  fields?: string[];

  // Optional: Query filters
  filters?: Record<string, any>;

  // Optional: Pagination configuration
  pagination?: {
    page?: number;
    limit?: number;
    offset?: number;
    cursor?: string;
  };

  // Optional: Sort configuration (multiple formats supported)
  sort?:
    | string
    | string[]
    | Array<{
        field: string;
        order: "asc" | "desc";
      }>;

  // Optional: Population/expansion configuration
  expand?: Array<{
    path: string;
    select?: string[];
  }>;

  // Optional: Full-text search configuration
  fullTextSearch?: {
    searchText: string;
    language?: string;
    sortByScore?: boolean;
    caseSensitive?: boolean;
    diacriticSensitive?: boolean;
  };

  // Optional: Default filters (always applied)
  defaultFilters?: Record<string, any>;

  // Optional: Fields that cannot be queried
  restrictedFields?: string[];
}
```

### Filter Operators

MongoDB-style operators with a simplified syntax:

```typescript
const { data } = await query.graph<ProductDocument>({
  entity: "Product",
  filters: {
    // Comparison operators
    price_gte: 100, // Greater than or equal
    price_lte: 500, // Less than or equal
    stock_gt: 0, // Greater than
    status_ne: "archived", // Not equal

    // Array operators
    category_in: ["electronics", "gadgets"], // In array
    tags_all: ["premium", "wireless"], // Contains all

    // Text search operators
    name_regex: "^iPhone", // Regex match
    description_text: "wireless", // Text search

    // Logical operators can be combined
    price_gte: 100,
    price_lte: 1000,
    category: "electronics",
    tags_in: ["premium", "sale"],
  },
});
```

### Sorting

Multiple formats supported for flexibility:

```typescript
// String format (simple)
const { data } = await query.graph<ProductDocument>({
  entity: "Product",
  sort: "price:desc",
});

// Multiple sort criteria (string array)
const { data } = await query.graph<ProductDocument>({
  entity: "Product",
  sort: ["price:desc", "name:asc"],
});

// Object format (type-safe)
const { data } = await query.graph<ProductDocument>({
  entity: "Product",
  sort: [
    { field: "price", order: "desc" },
    { field: "name", order: "asc" },
  ],
});
```

### Population (Expanding Relations)

```typescript
interface OrderDocument extends Document {
  items: ProductDocument[];
  customer: UserDocument;
  status: string;
}

const { data } = await query.graph<OrderDocument>({
  entity: "Order",
  expand: [
    {
      path: "customer",
      select: ["name", "email"],
    },
    {
      path: "items",
      select: ["name", "price", "quantity"],
    },
  ],
  filters: {
    status: "completed",
  },
});
```

### Full-Text Search

```typescript
const { data } = await query.graph<ProductDocument>({
  entity: "Product",
  fullTextSearch: {
    searchText: "wireless headphones",
    language: "english",
    sortByScore: true,
    caseSensitive: false,
  },
  filters: {
    price_lt: 1000,
    category: "electronics",
  },
  sort: [
    { field: "score", order: "desc" },
    { field: "price", order: "asc" },
  ],
});
```

## Framework Integrations

### NestJS Integration

```typescript
// query-builder.service.ts
import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { QueryBuilder } from "@hshanjra/mongoose-query-builder";
import {
  GraphQueryConfig,
  GraphQueryResponse,
} from "@hshanjra/mongoose-query-builder/types";

@Injectable()
export class QueryBuilderService {
  private queryBuilder: QueryBuilder;

  constructor(@InjectConnection() private connection: Connection) {
    this.queryBuilder = new QueryBuilder(connection);
  }

  async graph<T extends Document>(
    config: GraphQueryConfig<T>
  ): Promise<GraphQueryResponse<T>> {
    return this.queryBuilder.graph<T>(config);
  }
}

// product.controller.ts
@Controller("products")
export class ProductController {
  constructor(private readonly queryBuilderService: QueryBuilderService) {}

  @Get()
  async findAll(
    @Query("fields") fields?: string,
    @Query("filters") filters?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("sort") sort?: string,
    @Query("expand") expand?: string,
    @Query("search") search?: string
  ) {
    const queryConfig: GraphQueryConfig<ProductDocument> = {
      entity: "Product",
      fields: fields?.split(","),
      filters: filters ? JSON.parse(filters) : undefined,
      pagination: { page, limit },
      sort,
      expand: expand?.split(",").map((path) => ({ path })),
      ...(search && {
        fullTextSearch: {
          searchText: search,
          sortByScore: true,
        },
      }),
    };

    return this.queryBuilderService.graph<ProductDocument>(queryConfig);
  }
}
```

### Express Integration

```typescript
import express from "express";
import { QueryBuilder } from "@hshanjra/mongoose-query-builder";
import { QueryBuilderMiddleware } from "@hshanjra/mongoose-query-builder/middlewares";

const app = express();

// Apply middleware with configuration
app.use(
  QueryBuilderMiddleware({
    maxLimit: 50,
    defaultLimit: 20,
    restrictedFields: ["password", "secretKey"],
  })
);

app.get("/api/products", async (req, res) => {
  try {
    const query = new QueryBuilder();
    const { data, metadata } = await query.graph<ProductDocument>({
      entity: "Product",
      ...req.queryOptions,
      defaultFilters: {
        isActive: true,
        isDeleted: false,
      },
    });

    res.json({ data, metadata });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Client-Side Integration

### Making API Requests with URL Parameters

When consuming an API that uses mongoose-query-builder, all query parameters should be passed via URL query strings. Here are examples of how to build proper requests:

#### Axios Example

```typescript
import axios from "axios";

// Basic query with simple parameters
async function fetchProducts() {
  try {
    // All parameters are passed in URL query string
    const response = await axios.get("https://api.example.com/api/products", {
      params: {
        // Pagination
        page: 1,
        limit: 10,

        // Sorting
        sort: "price:desc",

        // Field selection
        fields: "name,price,category,description",

        // Simple filtering
        category: "electronics",
        price_gte: 100,
        isActive: true,
      },
    });

    const { data, metadata } = response.data;
    console.log("Products:", data);
    console.log("Metadata:", metadata);

    return data;
  } catch (error) {
    console.error("Error fetching products:", error);
    throw error;
  }
}
```

#### Handling Array Parameters

For array parameters that need to be sent as multiple parameters with the same key:

```typescript
// For array parameters like tags_in that should have multiple values
const fetchProductsWithTags = async () => {
  try {
    // Build URL parameters manually for array parameters
    const params = new URLSearchParams();

    // Add regular parameters
    params.append("page", "1");
    params.append("limit", "20");
    params.append("sort", "createdAt:desc");

    // Add each tag as a separate parameter with the same key
    // This creates: tags_in=premium&tags_in=wireless&tags_in=bluetooth
    const tags = ["premium", "wireless", "bluetooth"];
    tags.forEach((tag) => params.append("tags_in", tag));

    // Make request with explicitly built query string
    const response = await axios.get(
      `https://api.example.com/api/products?${params.toString()}`
    );

    return response.data;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};
```

#### Fetch API Example

```typescript
// Using native fetch API with URL parameters
async function fetchProductsWithFetch() {
  try {
    // Build the query string explicitly using URLSearchParams
    const params = new URLSearchParams({
      page: "1",
      limit: "10",
      sort: "createdAt:desc",
      fields: "name,price,category,image",
      category: "electronics",
      price_gte: "100",
    });

    // Handle array parameters
    const tags = ["premium", "wireless"];
    tags.forEach((tag) => params.append("tags_in", tag));

    // Make the fetch request with query string in the URL
    const response = await fetch(
      `https://api.example.com/api/products?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const { data, metadata } = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching with fetch:", error);
    throw error;
  }
}
```

### React Query Integration

For modern React applications, you can integrate with libraries like React Query:

```typescript
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// Define query options interface
interface ProductQueryOptions {
  page?: number;
  limit?: number;
  sort?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
}

// Helper to build URL parameters correctly
const buildUrlParams = (options: ProductQueryOptions): URLSearchParams => {
  const params = new URLSearchParams();

  // Add pagination
  if (options.page) params.append("page", options.page.toString());
  if (options.limit) params.append("limit", options.limit.toString());

  // Add sorting
  if (options.sort) params.append("sort", options.sort);

  // Add filters
  if (options.category) params.append("category", options.category);
  if (options.minPrice) params.append("price_gte", options.minPrice.toString());
  if (options.maxPrice) params.append("price_lte", options.maxPrice.toString());

  // Add array parameters
  if (options.tags && options.tags.length > 0) {
    options.tags.forEach((tag) => params.append("tags_in", tag));
  }

  return params;
};

// Fetch products function
const fetchProducts = async (options: ProductQueryOptions) => {
  const params = buildUrlParams(options);
  const response = await axios.get(
    `https://api.example.com/api/products?${params.toString()}`
  );
  return response.data;
};

// React Query hook
export const useProducts = (options: ProductQueryOptions) => {
  return useQuery({
    queryKey: ["products", options],
    queryFn: () => fetchProducts(options),
    keepPreviousData: true,
  });
};

// Using the hook in a component
function ProductList() {
  const [queryOptions, setQueryOptions] = useState({
    page: 1,
    limit: 10,
    sort: "price:desc",
    category: "electronics",
    minPrice: 100,
  });

  const { data, isLoading, error } = useProducts(queryOptions);

  // Rest of the component...
}
```

## Response Format

```typescript
interface GraphQueryResponse<T> {
  // Array of matched documents
  data: T[];

  // Rich metadata about the query
  metadata: {
    totalCount: number; // Total matching documents
    currentPage: number; // Current page number
    pageSize: number; // Items per page
    totalPages: number; // Total number of pages
    hasNextPage: boolean; // Whether there are more pages
    hasPrevPage: boolean; // Whether there are previous pages
    executionTimeMs: number; // Query execution time

    // Original query parameters
    query?: {
      filters?: Record<string, any>;
      sort?: Record<string, string>;
      pagination?: {
        page?: number;
        limit?: number;
      };
      fields?: string[];
      fullTextSearch?: {
        searchText: string;
        [key: string]: any;
      };
    };
  };
}
```

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

This project is licensed under the MIT License.
