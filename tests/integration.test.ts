import { QueryBuilder } from '../src/query-builder';
import mongoose, { Schema, Document } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Define interfaces for our test models
interface IUser extends Document {
    name: string;
    email: string;
    posts: IPost[];
}

interface IPost extends Document {
    title: string;
    content: string;
    tags: string[];
    viewCount: number;
    author: IUser;
    status: 'draft' | 'published';
    createdAt: Date;
}

describe('Integration Tests for QueryBuilder', () => {
    let mongoServer: MongoMemoryServer;
    let User: mongoose.Model<IUser>;
    let Post: mongoose.Model<IPost>;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
        
        // Define schemas
        const userSchema = new Schema<IUser>({
            name: String,
            email: String,
            posts: [{ type: Schema.Types.ObjectId, ref: 'Post' }]
        });

        const postSchema = new Schema<IPost>({
            title: String,
            content: String,
            tags: [String],
            viewCount: Number,
            status: {
                type: String,
                enum: ['draft', 'published'],
                default: 'draft'
            },
            author: { type: Schema.Types.ObjectId, ref: 'User' },
            createdAt: { type: Date, default: Date.now }
        });

        // Create text index for full-text search
        postSchema.index({ title: 'text', content: 'text' });

        User = mongoose.model<IUser>('User', userSchema);
        Post = mongoose.model<IPost>('Post', postSchema);
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await Post.deleteMany({});
    });

    describe('query operations', () => {
        let users: IUser[];
        
        beforeEach(async () => {
            users = await User.create([
                { name: 'Alice', email: 'alice@test.com' },
                { name: 'Bob', email: 'bob@test.com' }
            ]);

            await Post.create([
                {
                    title: 'First Post',
                    content: 'Hello World',
                    tags: ['intro', 'basic'],
                    viewCount: 100,
                    status: 'published',
                    author: users[0]._id,
                    createdAt: new Date('2024-01-01')
                },
                {
                    title: 'Second Post',
                    content: 'Advanced MongoDB',
                    tags: ['mongodb', 'advanced'],
                    viewCount: 150,
                    status: 'published',
                    author: users[0]._id,
                    createdAt: new Date('2024-01-02')
                },
                {
                    title: 'Draft Post',
                    content: 'Work in Progress',
                    tags: ['draft'],
                    viewCount: 0,
                    status: 'draft',
                    author: users[1]._id,
                    createdAt: new Date('2024-01-03')
                }
            ]);
        });

        it('should find all documents', async () => {
            const queryBuilder = new QueryBuilder();
            const { data, metadata } = await queryBuilder.graph({
                entity: 'Post'
            });
            expect(data).toHaveLength(3);
        });

        it('should find with conditions using filters', async () => {
            const queryBuilder = new QueryBuilder();
            const { data, metadata } = await queryBuilder.graph({
                entity: 'Post',
                filters: { status: 'published' }
            });
            expect(data).toHaveLength(2);
            expect(data.every(post => post.status === 'published')).toBe(true);
        });

        it('should support field selection', async () => {
            const queryBuilder = new QueryBuilder();
            const { data, metadata } = await queryBuilder.graph({
                entity: 'Post',
                fields: ['title', 'author', 'tags']
            });
            expect(data[0]).toHaveProperty('title');
            expect(data[0]).toHaveProperty('author');
            expect(data[0]).toHaveProperty('tags');
            expect(Object.prototype.hasOwnProperty.call(data[0], 'content')).toBe(false);
            expect(Object.prototype.hasOwnProperty.call(data[0], 'viewCount')).toBe(false);
        });

        it('should support multiple sorting criteria', async () => {
            const queryBuilder = new QueryBuilder();
            const { data, metadata } = await queryBuilder.graph({
                entity: 'Post',
                sort: [
                    { field: 'status', order: 'asc' },
                    { field: 'viewCount', order: 'desc' }
                ]
            });
            expect(data[0].status).toBe('draft');
            expect(data[1].status).toBe('published');
            expect(data[1].viewCount).toBeGreaterThan(data[2].viewCount);
        });

        it('should support pagination with complex filters', async () => {
            const queryBuilder = new QueryBuilder();
            const { data, metadata } = await queryBuilder.graph({
                entity: 'Post',
                filters: {
                    status: 'published',
                    viewCount_gte: 100
                },
                pagination: { page: 1, limit: 1 },
                sort: 'createdAt:desc'
            });
            expect(data).toHaveLength(1);
            expect(metadata.totalCount).toBe(2);
            expect(metadata.hasNextPage).toBe(true);
            expect(data[0].title).toBe('Second Post');
        });

        it('should support population with field selection', async () => {
            const queryBuilder = new QueryBuilder();
            const { data, metadata } = await queryBuilder.graph({
                entity: 'Post',
                filters: { status: 'published' },
                expand: [{
                    path: 'author',
                    select: ['name']
                }]
            });
            expect(data[0].author).toHaveProperty('name');
            expect(data[0].author && Object.prototype.hasOwnProperty.call(data[0].author, 'email')).toBe(false);
            expect(data[0].author.name).toBe('Alice');
        });

        it('should support array field operations', async () => {
            const queryBuilder = new QueryBuilder();
            const { data, metadata } = await queryBuilder.graph({
                entity: 'Post',
                filters: {
                    tags_in: ['mongodb', 'advanced']
                }
            });
            expect(data).toHaveLength(1);
            expect(data[0].title).toBe('Second Post');
        });
    });

    describe('advanced operations', () => {
        let users: IUser[];

        beforeEach(async () => {
            users = await User.create([
                { name: 'Bob', email: 'bob@test.com' },
                { name: 'Alice', email: 'alice@test.com' }
            ]);

            await Post.create([
                {
                    title: 'MongoDB Tutorial',
                    content: 'Learn about MongoDB aggregation',
                    tags: ['mongodb', 'tutorial'],
                    viewCount: 200,
                    status: 'published',
                    author: users[0]._id,
                    createdAt: new Date('2024-01-01')
                },
                {
                    title: 'GraphQL Basics',
                    content: 'Introduction to GraphQL queries',
                    tags: ['graphql', 'tutorial'],
                    viewCount: 150,
                    status: 'published',
                    author: users[1]._id,
                    createdAt: new Date('2024-01-02')
                }
            ]);
        });

        it('should perform full-text search with sorting by score', async () => {
            const queryBuilder = new QueryBuilder();
            const { data, metadata } = await queryBuilder.graph({
                entity: 'Post',
                fullTextSearch: {
                    searchText: 'MongoDB aggregation',
                    sortByScore: true
                }
            });
            expect(data).toHaveLength(1);
            expect(data[0].title).toBe('MongoDB Tutorial');
        });

        it('should combine multiple query options', async () => {
            const queryBuilder = new QueryBuilder();
            const { data, metadata } = await queryBuilder.graph({
                entity: 'Post',
                filters: {
                    status: 'published',
                    viewCount_gt: 100
                },
                sort: 'viewCount:desc',
                fields: ['title', 'viewCount', 'author'],
                expand: [{ path: 'author', select: ['name'] }],
                pagination: { page: 1, limit: 10 }
            });
            
            expect(data).toHaveLength(2);
            expect(metadata.totalCount).toBe(2);
            expect(data[0]).toHaveProperty('title');
            expect(data[0]).toHaveProperty('viewCount');
            expect(Object.prototype.hasOwnProperty.call(data[0], 'content')).toBe(false);
            expect(data[0].viewCount).toBeGreaterThan(data[1].viewCount);
            expect(data[0].author).toHaveProperty('name');
        });

        it('should support date range filters', async () => {
            const queryBuilder = new QueryBuilder();
            const { data, metadata } = await queryBuilder.graph({
                entity: 'Post',
                filters: {
                    createdAt_gte: new Date('2024-01-02'),
                    status: 'published'
                }
            });
            expect(data).toHaveLength(1);
            expect(data[0].title).toBe('GraphQL Basics');
        });

        it('should handle invalid model names gracefully', async () => {
            const queryBuilder = new QueryBuilder();
            await expect(queryBuilder.graph({
                entity: 'NonExistentModel'
            })).rejects.toThrow('Model "NonExistentModel" not found');
        });

        it('should include query metadata in response', async () => {
            const queryBuilder = new QueryBuilder();
            const { data, metadata } = await queryBuilder.graph({
                entity: 'Post',
                filters: { status: 'published' },
                sort: 'viewCount:desc',
                pagination: { page: 1, limit: 5 }
            });
            
            expect(metadata).toMatchObject({
                totalCount: expect.any(Number),
                currentPage: 1,
                pageSize: 5,
                totalPages: expect.any(Number),
                hasNextPage: expect.any(Boolean),
                hasPrevPage: expect.any(Boolean),
                executionTimeMs: expect.any(Number),
                query: {
                    filters: expect.any(Object),
                    sort: expect.any(Object),
                    pagination: expect.any(Object)
                }
            });
        });
    });
});