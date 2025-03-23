import mongoose, { Document } from "mongoose";
import { QueryBuilder } from "../src";

// Example User interface
interface UserDocument extends Document {
  name: string;
  bio: string;
  age: number;
  email: string;
  createdAt: Date;
}

// Example Mongoose model
const userSchema = new mongoose.Schema<UserDocument>({
  name: String,
  bio: String,
  age: Number,
  email: String,
  createdAt: { type: Date, default: Date.now },
});

// Create text index for search capabilities
userSchema.index({ name: "text", bio: "text" });

const UserModel = mongoose.model<UserDocument>("User", userSchema);

async function runExample() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/test");
    console.log("Connected to MongoDB");

    // Create sample data if it doesn't exist
    const count = await UserModel.countDocuments();
    if (count === 0) {
      console.log("Creating sample data...");
      await UserModel.create([
        {
          name: "John Smith",
          bio: "Software developer with 5 years experience",
          age: 28,
          email: "john@example.com",
        },
        {
          name: "Jane Doe",
          bio: "Data scientist specializing in machine learning",
          age: 32,
          email: "jane@example.com",
        },
        {
          name: "Bob Johnson",
          bio: "DevOps engineer with cloud experience",
          age: 35,
          email: "bob@example.com",
        },
      ]);
    }

    // Initialize query builder
    const queryBuilder = new QueryBuilder();

    // Basic query with filters, sorting, pagination, and field selection
    console.log("\n--- Basic Query ---");
    const basicResult = await queryBuilder.graph<UserDocument>({
      entity: "User", // Use model name instead of model instance
      filters: { age_gte: 18 },
      sort: "createdAt:desc",
      pagination: { page: 1, limit: 10 },
      fields: ["name", "email", "age"],
    });

    console.log("Basic query results:", basicResult.data);
    console.log("Metadata:", basicResult.metadata);

    // Full-text search with sorting by relevance
    console.log("\n--- Full-Text Search ---");
    const textSearchResult = await queryBuilder.graph<UserDocument>({
      entity: "User",
      fullTextSearch: {
        searchText: "developer",
        sortByScore: true,
        language: "english",
      },
    });

    console.log(
      'Full-text search results for "developer":',
      textSearchResult.data
    );

    // Combined filtering with full-text search
    console.log("\n--- Combined Search ---");
    const combinedResult = await queryBuilder.graph<UserDocument>({
      entity: "User",
      filters: {
        age_lt: 30,
        email_regex: /@example\.com$/,
      },
      fullTextSearch: {
        searchText: "developer",
        language: "english",
        sortByScore: true,
      },
      sort: [
        { field: "age", order: "asc" },
        { field: "name", order: "asc" },
      ],
    });

    console.log("Combined search results:", combinedResult.data);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed");
  }
}

// Run the example
runExample().catch(console.error);
