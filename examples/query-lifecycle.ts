import express, { Request, Response, NextFunction } from "express";
import mongoose, { Document } from "mongoose";
import { QueryBuilder, queryBuilderMiddleware } from "../src";

// Document interfaces
interface AuthorDocument extends Document {
  name: string;
  email: string;
  bio: string;
  role: string;
}

interface PostDocument extends Document {
  title: string;
  content: string;
  status: "draft" | "published" | "archived";
  author: AuthorDocument;
  tags: string[];
  viewCount: number;
  createdAt: Date;
}

// Schema definitions
const authorSchema = new mongoose.Schema<AuthorDocument>({
  name: String,
  email: String,
  bio: String,
  role: { type: String, default: "author" },
});

const postSchema = new mongoose.Schema<PostDocument>({
  title: String,
  content: String,
  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "draft",
  },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "Author" },
  tags: [String],
  viewCount: Number,
  createdAt: { type: Date, default: Date.now },
});

// Create text index for search capabilities
postSchema.index({ title: "text", content: "text" });

const Author = mongoose.model<AuthorDocument>("Author", authorSchema);
const Post = mongoose.model<PostDocument>("Post", postSchema);

// Custom request interface for TypeScript
interface QueryRequest extends Request {
  user?: {
    id: string;
    role: string;
    organizationId: string;
  };
  queryOptions: {
    filters?: Record<string, any>;
    fields?: string[];
    pagination?: { page: number; limit: number };
    sort?: string | { field: string; order: "asc" | "desc" }[];
    expand?: { path: string; select?: string[] }[];
    fullTextSearch?: {
      searchText: string;
      sortByScore?: boolean;
    };
  };
}

// Middleware definitions with TypeScript
const queryLoggerMiddleware = (
  req: QueryRequest,
  res: Response,
  next: NextFunction
) => {
  console.log("Incoming query parameters:", req.query);
  next();
};

const queryValidationMiddleware = (
  req: QueryRequest,
  res: Response,
  next: NextFunction
) => {
  const { page, limit } = req.query;
  if (page && isNaN(Number(page))) {
    return res.status(400).json({ error: "Invalid page number" });
  }
  if (limit && isNaN(Number(limit))) {
    return res.status(400).json({ error: "Invalid limit value" });
  }
  next();
};

const authMiddleware = (
  req: QueryRequest,
  res: Response,
  next: NextFunction
) => {
  // Simulate user authentication
  req.user = {
    id: "123",
    role: "user",
    organizationId: "org123",
  };
  next();
};

const enhanceQueryMiddleware = (
  req: QueryRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.organizationId) {
    req.queryOptions = req.queryOptions || {};
    req.queryOptions.defaultFilters = {
      ...(req.queryOptions.defaultFilters || {}),
      organizationId: req.user.organizationId,
    };
  }
  next();
};

const app = express();

// Apply middlewares in order
app.use(queryLoggerMiddleware);
app.use(queryValidationMiddleware);
app.use(authMiddleware);
app.use(
  queryBuilderMiddleware({
    maxLimit: 50,
    defaultLimit: 20,
    restrictedFields: ["password", "secretKey"],
  })
);
app.use(enhanceQueryMiddleware);

// Example API endpoint with strong typing
app.get("/api/posts", async (req: QueryRequest, res: Response) => {
  try {
    const query = new QueryBuilder();

    // Apply business rules and prepare query config
    const queryConfig = {
      entity: "Post",
      fields: req.queryOptions.fields,
      filters: {
        ...req.queryOptions.filters,
        status: "published", // Business rule: only show published posts
      },
      sort: req.queryOptions.sort,
      pagination: req.queryOptions.pagination,
      expand: req.queryOptions.expand,
      defaultFilters: {
        isDeleted: false, // Global filter
      },
    };

    // Execute query
    const { data, metadata } = (await query.graph) < PostDocument > queryConfig;

    // Send response
    res.json({
      success: true,
      data,
      metadata,
    });
  } catch (error) {
    console.error("Query execution error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Example error handling middleware with TypeScript
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Global error handler:", error);
  res.status(500).json({
    success: false,
    error: error.message,
  });
});

// Start server with async/await
async function startServer() {
  try {
    await mongoose.connect("mongodb://localhost:27017/test");
    console.log("Connected to MongoDB");

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer().catch(console.error);
