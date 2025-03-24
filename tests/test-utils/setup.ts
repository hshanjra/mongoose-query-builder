import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import express from "express";
import { QueryBuilderMiddleware } from "../../src/middlewares/query-builder.middleware";

export const setupTestServer = () => {
  const app = express();
  app.use(express.json());
  app.use(QueryBuilderMiddleware());

  // Add a test route that uses the middleware
  app.get("/test", (req, res) => {
    res.json({ queryOptions: req.queryOptions });
  });

  return app;
};

export const setupTestDatabase = async () => {
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  return {
    mongoServer,
    mongoUri,
    cleanup: async () => {
      await mongoose.disconnect();
      await mongoServer.stop();
    },
  };
};

export const createTestServer = async () => {
  const app = setupTestServer();
  const db = await setupTestDatabase();

  const server = app.listen(0); // Use port 0 to get a random available port

  return {
    app,
    server,
    db,
    cleanup: async () => {
      server.close();
      await db.cleanup();
    },
  };
};
