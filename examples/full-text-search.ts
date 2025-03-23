import mongoose, { Document } from "mongoose";
import { QueryBuilder } from "../src";

// Product document interface
interface ProductDocument extends Document {
  name: string;
  description: string;
  price: number;
  tags: string[];
  createdAt: Date;
}

// Product schema definition
const productSchema = new mongoose.Schema<ProductDocument>({
  name: String,
  description: String,
  price: Number,
  tags: [String],
  createdAt: { type: Date, default: Date.now },
});

// Create text index for search capabilities
productSchema.index({ name: "text", description: "text" });

const ProductModel = mongoose.model<ProductDocument>("Product", productSchema);

async function runBasicExample() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/test", {});

    console.log("Connected to MongoDB");

    // Initialize query builder and execute basic query
    const queryBuilder = new QueryBuilder();
    const { data: products } = await queryBuilder.graph<ProductDocument>({
      entity: "Product",
      filters: { price_gte: 10 },
      sort: "createdAt:desc",
      pagination: { page: 1, limit: 10 },
      fields: ["name", "description", "price"],
    });

    console.log("Basic query results:", products);
  } catch (err) {
    console.error("Error in basic example:", err);
  }
}

async function runFullTextSearchExample() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/test");
    console.log("Connected to MongoDB");

    // Create sample data if not exists
    const count = await ProductModel.countDocuments();
    if (count === 0) {
      console.log("Creating sample data...");
      await ProductModel.create([
        {
          name: "Smartphone X",
          description: "High-end smartphone with advanced camera features",
          price: 999,
          tags: ["electronics", "smartphone"],
        },
        {
          name: "Laptop Pro",
          description: "Professional laptop for developers and designers",
          price: 1499,
          tags: ["electronics", "computer"],
        },
        {
          name: "Wireless Headphones",
          description: "Noise cancelling headphones with long battery life",
          price: 299,
          tags: ["audio", "electronics"],
        },
      ]);
    }

    const queryBuilder = new QueryBuilder();

    // Example 1: Basic full-text search
    console.log("\n--- Example 1: Basic Full-Text Search ---");
    const { data: smartphones } = await queryBuilder.graph<ProductDocument>({
      entity: "Product",
      fullTextSearch: {
        searchText: "smartphone camera",
        sortByScore: true,
        language: "english",
      },
    });
    console.log("Smartphone search results:", smartphones);

    // Example 2: Search with filters
    console.log("\n--- Example 2: Search with Filters ---");
    const { data: affordableElectronics } =
      await queryBuilder.graph<ProductDocument>({
        entity: "Product",
        filters: {
          price_lt: 1000,
          tags_in: ["electronics"],
        },
        fullTextSearch: {
          searchText: "wireless noise",
          sortByScore: true,
        },
        sort: "price:desc",
      });
    console.log(
      "Affordable electronics search results:",
      affordableElectronics
    );

    // Example 3: Advanced search with field selection
    console.log("\n--- Example 3: Advanced Search ---");
    const { data: advancedResults } = await queryBuilder.graph<ProductDocument>(
      {
        entity: "Product",
        fullTextSearch: {
          searchText: "professional developer",
          language: "english",
          sortByScore: true,
        },
        fields: ["name", "price", "tags"],
        pagination: { page: 1, limit: 5 },
      }
    );
    console.log("Advanced search results:", advancedResults);

    // Example 4: Combined search with complex filtering
    console.log("\n--- Example 4: Combined Search with Complex Filtering ---");
    const { data: complexResults } = await queryBuilder.graph<ProductDocument>({
      entity: "Product",
      filters: {
        price_between: [200, 1000],
        tags_all: ["electronics"],
      },
      fullTextSearch: {
        searchText: "wireless OR noise",
        language: "english",
        sortByScore: true,
      },
      sort: [
        { field: "price", order: "asc" },
        { field: "name", order: "asc" },
      ],
    });
    console.log("Complex search results:", complexResults);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed");
  }
}

// Run examples
async function runAllExamples() {
  try {
    await runBasicExample();
    await runFullTextSearchExample();
  } catch (err) {
    console.error("Error running examples:", err);
  } finally {
    // Ensure connection is closed
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");
    }
  }
}

runAllExamples();
