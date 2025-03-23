import mongoose, { Document } from "mongoose";
import { QueryBuilder } from "../src";

// Product document interface
interface ProductDocument extends Document {
  name: string;
  description: string;
  price: number;
  status: "draft" | "published" | "archived";
  category: string;
  tags: string[];
  createdAt: Date;
}

// Product schema definition
const productSchema =
  new mongoose.Schema() <
  ProductDocument >
  {
    name: String,
    description: String,
    price: Number,
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    category: String,
    tags: [String],
    createdAt: { type: Date, default: Date.now },
  };

const ProductModel =
  mongoose.model < ProductDocument > ("Product", productSchema);

async function runExample() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/test");
    console.log("Connected to MongoDB");

    // Create sample data if it doesn't exist
    const count = await ProductModel.countDocuments();
    if (count === 0) {
      console.log("Creating sample products...");
      await ProductModel.create([
        {
          name: "Premium Smartphone",
          description: "Latest smartphone with advanced features",
          price: 999,
          status: "published",
          category: "electronics",
          tags: ["phone", "gadget"],
        },
        {
          name: "Budget Smartphone",
          description: "Affordable smartphone for basic needs",
          price: 299,
          status: "published",
          category: "electronics",
          tags: ["phone", "budget"],
        },
        {
          name: "Upcoming Tablet",
          description: "Next generation tablet coming soon",
          price: 599,
          status: "draft",
          category: "electronics",
          tags: ["tablet", "gadget"],
        },
        {
          name: "Discontinued Laptop",
          description: "Old model laptop no longer available",
          price: 899,
          status: "archived",
          category: "electronics",
          tags: ["laptop", "computer"],
        },
      ]);
    }

    const queryBuilder = new QueryBuilder();

    // Example 1: Using defaultFilters to only show published products
    console.log("\n--- Example 1: Default Filters ---");
    const { data: publishedProducts } =
      (await queryBuilder.graph) <
      ProductDocument >
      {
        entity: "Product",
        defaultFilters: { status: "published" },
        sort: "price:asc",
      };

    console.log(
      "Published products (default filter):",
      publishedProducts.map((p) => `${p.name} - $${p.price} (${p.status})`)
    );

    // Example 2: User filters combined with default filters
    console.log("\n--- Example 2: Combined Filters ---");
    const { data: budgetPublishedProducts } =
      (await queryBuilder.graph) <
      ProductDocument >
      {
        entity: "Product",
        defaultFilters: { status: "published" },
        filters: {
          price_lt: 500,
          tags_in: ["budget"],
        },
        sort: "price:asc",
      };

    console.log(
      "Budget published products (combined filters):",
      budgetPublishedProducts.map(
        (p) => `${p.name} - $${p.price} (${p.status})`
      )
    );

    // Example 3: Multi-tenant example with multiple default filters
    console.log("\n--- Example 3: Multi-tenant Filtering ---");
    const { data: tenantProducts } =
      (await queryBuilder.graph) <
      ProductDocument >
      {
        entity: "Product",
        defaultFilters: {
          status: "published",
          category: "electronics", // Simulating tenant-specific category
        },
        filters: {
          price_between: [200, 1000],
        },
        sort: "price:desc",
      };

    console.log(
      "Tenant-specific products:",
      tenantProducts.map((p) => `${p.name} - $${p.price} (${p.category})`)
    );

    // Example 4: Complex filtering with arrays and default filters
    console.log("\n--- Example 4: Complex Array Filtering ---");
    const { data: filteredProducts } =
      (await queryBuilder.graph) <
      ProductDocument >
      {
        entity: "Product",
        defaultFilters: {
          status: "published",
          tags_in: ["phone", "gadget"],
        },
        filters: {
          price_gte: 500,
        },
        sort: [
          { field: "price", order: "desc" },
          { field: "name", order: "asc" },
        ],
      };

    console.log(
      "Premium gadgets:",
      filteredProducts.map(
        (p) => `${p.name} - ${p.tags.join(", ")} ($${p.price})`
      )
    );
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed");
  }
}

runExample().catch(console.error);
