import express, { Request, Response } from "express";
import mongoose, { Document } from "mongoose";
import { QueryBuilder, queryBuilderMiddleware } from "../src";
import { GraphQueryConfig } from "../src/types";

// Document interfaces
interface ProductDocument extends Document {
  name: string;
  price: number;
  description: string;
  category: CategoryDocument;
  tags: string[];
  status: "active" | "draft" | "archived";
  createdAt: Date;
}

interface CategoryDocument extends Document {
  name: string;
  description: string;
  slug: string;
  parent?: CategoryDocument;
  isActive: boolean;
}

// Schema definitions
const productSchema = new mongoose.Schema<ProductDocument>({
  name: String,
  price: Number,
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  tags: [String],
  status: {
    type: String,
    enum: ["active", "draft", "archived"],
    default: "draft",
  },
  createdAt: { type: Date, default: Date.now },
});

const categorySchema = new mongoose.Schema<CategoryDocument>({
  name: String,
  description: String,
  slug: String,
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  isActive: { type: Boolean, default: true },
});

// Create text indices for search
productSchema.index({ name: "text", description: "text" });
categorySchema.index({ name: "text", description: "text" });

// Extended Request interface with query options
interface QueryRequest extends Request {
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
    defaultFilters?: Record<string, any>;
  };
}

// Base Controller class with generic type support
abstract class BaseController<T extends Document> {
  protected queryBuilder: QueryBuilder;
  protected entity: string;

  constructor(entity: string) {
    this.entity = entity;
    this.queryBuilder = new QueryBuilder();
  }

  async findAll(req: QueryRequest, res: Response) {
    try {
      const { data, metadata } = await this.queryBuilder.graph<T>({
        entity: this.entity,
        ...req.queryOptions,
      });

      res.json({ success: true, data, metadata });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async findById(req: QueryRequest, res: Response) {
    try {
      const { data, metadata } = await this.queryBuilder.graph<T>({
        entity: this.entity,
        filters: { _id: req.params.id },
        ...req.queryOptions,
      });

      if (!data.length) {
        return res.status(404).json({
          success: false,
          error: `${this.entity} not found`,
        });
      }

      res.json({ success: true, data: data[0], metadata });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  protected enhanceQuery(
    config: Partial<GraphQueryConfig<T>>
  ): GraphQueryConfig<T> {
    return {
      entity: this.entity,
      ...config,
    };
  }
}

// Product controller with specific product-related functionality
class ProductController extends BaseController<ProductDocument> {
  constructor() {
    super("Product");
  }

  async search(req: QueryRequest, res: Response) {
    try {
      const { data, metadata } = await this.queryBuilder.graph<ProductDocument>(
        this.enhanceQuery({
          fullTextSearch: {
            searchText: req.query.q as string,
            sortByScore: true,
            language: "english",
          },
          filters: {
            ...req.queryOptions.filters,
            price_gte: req.query.minPrice,
            price_lte: req.query.maxPrice,
            status: "active",
          },
          expand: [{ path: "category", select: ["name", "slug"] }],
          sort: [
            { field: "score", order: "desc" },
            { field: "price", order: "asc" },
          ],
        })
      );

      res.json({ success: true, data, metadata });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async analytics(req: QueryRequest, res: Response) {
    try {
      const { data, metadata } = await this.queryBuilder.graph<ProductDocument>(
        this.enhanceQuery({
          filters: {
            createdAt_gte: req.query.startDate as string,
            createdAt_lte: req.query.endDate as string,
            status: "active",
          },
          expand: [{ path: "category", select: ["name"] }],
        })
      );

      const analytics = {
        totalProducts: metadata.totalCount,
        categorySummary: data.reduce((acc, product) => {
          const categoryName = product.category?.name || "Uncategorized";
          acc[categoryName] = (acc[categoryName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        priceRanges: {
          budget: data.filter((p) => p.price < 50).length,
          midRange: data.filter((p) => p.price >= 50 && p.price < 200).length,
          premium: data.filter((p) => p.price >= 200).length,
        },
      };

      res.json({ success: true, data: analytics, metadata });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

// Category controller with tree-structure support
class CategoryController extends BaseController<CategoryDocument> {
  constructor() {
    super("Category");
  }

  async tree(req: QueryRequest, res: Response) {
    try {
      const { data, metadata } =
        await this.queryBuilder.graph<CategoryDocument>(
          this.enhanceQuery({
            filters: {
              parent: null, // Get root categories
              isActive: true,
            },
            expand: [
              {
                path: "children",
                select: ["name", "slug", "children"],
              },
            ],
            sort: "name:asc",
          })
        );

      res.json({ success: true, data, metadata });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async search(req: QueryRequest, res: Response) {
    try {
      const { data, metadata } =
        await this.queryBuilder.graph<CategoryDocument>(
          this.enhanceQuery({
            fullTextSearch: {
              searchText: req.query.q as string,
              sortByScore: true,
            },
            filters: {
              isActive: true,
            },
            expand: [{ path: "parent", select: ["name", "slug"] }],
          })
        );

      res.json({ success: true, data, metadata });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

const app = express();

// Configure middleware with route-specific options
app.use(
  "/api",
  queryBuilderMiddleware({
    maxLimit: 50,
    defaultLimit: 20,
    restrictedFields: ["__v"],
    routeConfig: {
      "/products": {
        maxLimit: 100,
        defaultLimit: 30,
        allowedFields: [
          "name",
          "price",
          "description",
          "category",
          "tags",
          "status",
          "createdAt",
        ],
      },
      "/products/analytics": {
        maxLimit: 1000,
        defaultLimit: 500,
        allowedFields: ["price", "category", "status", "createdAt"],
      },
      "/categories": {
        maxLimit: 200,
        defaultLimit: 50,
        allowedFields: ["name", "description", "slug", "parent", "isActive"],
      },
    },
  })
);

// Initialize controllers
const productController = new ProductController();
const categoryController = new CategoryController();

// Product routes
app.get("/api/products", productController.findAll.bind(productController));
app.get(
  "/api/products/search",
  productController.search.bind(productController)
);
app.get(
  "/api/products/analytics",
  productController.analytics.bind(productController)
);
app.get(
  "/api/products/:id",
  productController.findById.bind(productController)
);

// Category routes
app.get("/api/categories", categoryController.findAll.bind(categoryController));
app.get(
  "/api/categories/tree",
  categoryController.tree.bind(categoryController)
);
app.get(
  "/api/categories/search",
  categoryController.search.bind(categoryController)
);
app.get(
  "/api/categories/:id",
  categoryController.findById.bind(categoryController)
);

// Start server
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
