import mongoose, { Document } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { QueryBuilder } from '../src';

// Define a sample schema for testing
interface IUser extends Document {
  name: string;
  age: number;
  email: string;
  isActive: boolean;
}

const userSchema = new mongoose.Schema<IUser>({
  name: String,
  age: Number,
  email: String,
  isActive: Boolean,
});

describe('QueryBuilder', () => {
  let mongoServer: MongoMemoryServer;
  const User = mongoose.model<IUser>('User', userSchema);

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  }, 30000); // Increase timeout to 30 seconds

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('query operations', () => {
    beforeEach(async () => {
      await User.create([
        { name: 'John', age: 25, email: 'john@test.com', isActive: true },
        { name: 'Jane', age: 30, email: 'jane@test.com', isActive: true },
        { name: 'Bob', age: 20, email: 'bob@test.com', isActive: false },
      ]);
    });

    it('should find all documents', async () => {
      const queryBuilder = new QueryBuilder(User, {});
      const response = await queryBuilder.execute();
      expect(response.data).toHaveLength(3);
    });

    it('should find with conditions using filters', async () => {
      const queryBuilder = new QueryBuilder(User, {
        filters: {
          age_gt: 20
        }
      });
      const response = await queryBuilder.execute();
      expect(response.data).toHaveLength(2);
      expect(response.data.every(user => user.age > 20)).toBe(true);
    });

    it('should support field selection', async () => {
      const queryBuilder = new QueryBuilder(User, {
        select: ['name', 'email']
      });
      const response = await queryBuilder.execute();
      expect(response.data[0]).toHaveProperty('name');
      expect(response.data[0]).toHaveProperty('email');
      expect(response.data[0]).not.toHaveProperty('age');
      expect(response.data[0]).not.toHaveProperty('isActive');
    });

    it('should support sorting', async () => {
      const queryBuilder = new QueryBuilder(User, {
        sort: 'age:desc'
      });
      const response = await queryBuilder.execute();
      expect(response.data[0].age).toBe(30);
      expect(response.data[1].age).toBe(25);
      expect(response.data[2].age).toBe(20);
    });

    it('should support multiple sorting criteria', async () => {
      const queryBuilder = new QueryBuilder(User, {
        sort: [
          { field: 'isActive', order: 'desc' },
          { field: 'age', order: 'asc' }
        ]
      });
      const response = await queryBuilder.execute();
      expect(response.data[0].isActive).toBe(true);
      expect(response.data[1].isActive).toBe(true);
      expect(response.data[2].isActive).toBe(false);
      // Check age sorting within isActive groups
      expect(response.data[0].age).toBeLessThan(response.data[1].age);
    });

    it('should support pagination', async () => {
      const queryBuilder = new QueryBuilder(User, {
        pagination: {
          page: 1,
          limit: 2
        },
        sort: 'age:asc'
      });
      const response = await queryBuilder.execute();
      expect(response.data).toHaveLength(2);
      expect(response.meta.totalCount).toBe(3);
      expect(response.meta.currentPage).toBe(1);
      expect(response.meta.pageSize).toBe(2);
      expect(response.meta.hasNextPage).toBe(true);
      expect(response.meta.hasPrevPage).toBe(false);
    });

    it('should apply default filters', async () => {
      const queryBuilder = new QueryBuilder(User, {
        defaultFilters: { isActive: true }
      });
      const response = await queryBuilder.execute();
      expect(response.data).toHaveLength(2);
      expect(response.data.every(user => user.isActive)).toBe(true);
    });

    it('should combine default filters with user filters', async () => {
      const queryBuilder = new QueryBuilder(User, {
        defaultFilters: { isActive: true },
        filters: { age_gt: 25 }
      });
      const response = await queryBuilder.execute();
      expect(response.data).toHaveLength(1);
      expect(response.data[0].name).toBe('Jane');
      expect(response.data[0].isActive).toBe(true);
      expect(response.data[0].age).toBeGreaterThan(25);
    });

    it('should support chaining query modifications', async () => {
      const queryBuilder = new QueryBuilder(User, {})
        .addFilters({ isActive: true })
        .addSelect(['name', 'age'])
        .setSort('age:desc');

      const response = await queryBuilder.execute();
      expect(response.data).toHaveLength(2);
      expect(response.data[0]).toHaveProperty('name');
      expect(response.data[0]).toHaveProperty('age');
      expect(response.data[0]).not.toHaveProperty('email');
      expect(response.data[0].age).toBe(30);
    });
  });

  describe('aggregation operations', () => {
    beforeEach(async () => {
      await User.create([
        { name: 'John', age: 25, email: 'john@test.com', isActive: true },
        { name: 'Jane', age: 30, email: 'jane@test.com', isActive: true },
        { name: 'Bob', age: 20, email: 'bob@test.com', isActive: false },
      ]);
    });

    it('should perform aggregation with metadata', async () => {
      const queryBuilder = new QueryBuilder(User, {
        filters: {},
        pagination: {
          page: 1,
          limit: 10
        }
      });
      const response = await queryBuilder.execute();
      
      expect(response.meta.totalCount).toBe(3);
      expect(response.meta.currentPage).toBe(1);
      expect(response.meta.hasNextPage).toBe(false);
      expect(response.meta.executionTimeMs).toBeDefined();
    });

    it('should support raw aggregation pipeline', async () => {
      const queryBuilder = new QueryBuilder(User, {});
      const result = await queryBuilder
        .aggregate([
          {
            $group: {
              _id: '$isActive',
              count: { $sum: 1 },
              avgAge: { $avg: '$age' }
            }
          },
          { $sort: { _id: -1 } }
        ])
        .execute();

      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe(true);
      expect(result[0].count).toBe(2);
      expect(result[1]._id).toBe(false);
      expect(result[1].count).toBe(1);
    });
  });
});
