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
  let User: mongoose.Model<IUser>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    // Define the model
    User = mongoose.model<IUser>('User', userSchema);
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
      const queryBuilder = new QueryBuilder();
      const { data, metadata } = await queryBuilder.graph({
        entity: 'User'
      });
      expect(data).toHaveLength(3);
    });

    it('should find with conditions using filters', async () => {
      const queryBuilder = new QueryBuilder();
      const { data, metadata } = await queryBuilder.graph({
        entity: 'User',
        filters: {
          age_gt: 20
        }
      });
      expect(data).toHaveLength(2);
      expect(data.every(user => user.age > 20)).toBe(true);
    });

    it('should support field selection', async () => {
      console.log('Running field selection test');
      const queryBuilder = new QueryBuilder();
      const { data, metadata } = await queryBuilder.graph({
        entity: 'User',
        fields: ['name', 'email']
      });
      console.log('Query response:', {
        data: data.map(doc => ({
          name: doc.name,
          email: doc.email,
          hasAge: doc.hasOwnProperty('age'),
          hasIsActive: doc.hasOwnProperty('isActive')
        }))
      });
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).toHaveProperty('email');
      expect(Object.prototype.hasOwnProperty.call(data[0], 'age')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(data[0], 'isActive')).toBe(false);
    });

    it('should support sorting', async () => {
      const queryBuilder = new QueryBuilder();
      const { data, metadata } = await queryBuilder.graph({
        entity: 'User',
        sort: 'age:desc'
      });
      expect(data[0].age).toBe(30);
      expect(data[1].age).toBe(25);
      expect(data[2].age).toBe(20);
    });

    it('should support multiple sorting criteria', async () => {
      console.log('Running multiple sorting criteria test');
      const queryBuilder = new QueryBuilder();
      const { data, metadata } = await queryBuilder.graph({
        entity: 'User',
        sort: [
          { field: 'isActive', order: 'desc' },
          { field: 'age', order: 'asc' }
        ]
      });
      console.log('Query response:', {
        data: data.map(doc => ({
          name: doc.name,
          isActive: doc.isActive,
          age: doc.age
        }))
      });
      expect(data[0].isActive).toBe(true);
      expect(data[1].isActive).toBe(true);
      expect(data[2].isActive).toBe(false);
      // Check age sorting within isActive groups
      expect(data[0].age).toBeLessThan(data[1].age);
    });

    it('should support pagination', async () => {
      const queryBuilder = new QueryBuilder();
      const { data, metadata } = await queryBuilder.graph({
        entity: 'User',
        pagination: {
          page: 1,
          limit: 2
        },
        sort: 'age:asc'
      });
      expect(data).toHaveLength(2);
      expect(metadata.totalCount).toBe(3);
      expect(metadata.currentPage).toBe(1);
      expect(metadata.pageSize).toBe(2);
      expect(metadata.hasNextPage).toBe(true);
      expect(metadata.hasPrevPage).toBe(false);
    });

    it('should apply default filters', async () => {
      const queryBuilder = new QueryBuilder();
      const { data, metadata } = await queryBuilder.graph({
        entity: 'User',
        defaultFilters: { isActive: true }
      });
      expect(data).toHaveLength(2);
      expect(data.every(user => user.isActive)).toBe(true);
    });

    it('should combine default filters with user filters', async () => {
      const queryBuilder = new QueryBuilder();
      const { data, metadata } = await queryBuilder.graph({
        entity: 'User',
        defaultFilters: { isActive: true },
        filters: { age_gt: 25 }
      });
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Jane');
      expect(data[0].isActive).toBe(true);
      expect(data[0].age).toBeGreaterThan(25);
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

    it('should include metadata with query results', async () => {
      const queryBuilder = new QueryBuilder();
      const { data, metadata } = await queryBuilder.graph({
        entity: 'User',
        filters: {},
        pagination: {
          page: 1,
          limit: 10
        }
      });
      
      expect(metadata.totalCount).toBe(3);
      expect(metadata.currentPage).toBe(1);
      expect(metadata.hasNextPage).toBe(false);
      expect(metadata.executionTimeMs).toBeDefined();
    });
  });
});
