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
            const queryBuilder = new QueryBuilder(Post, {});
            const response = await queryBuilder.execute();
            expect(response.data).toHaveLength(3);
        });

        it('should find with conditions using filters', async () => {
            const queryBuilder = new QueryBuilder(Post, {
                filters: { status: 'published' }
            });
            const response = await queryBuilder.execute();
            expect(response.data).toHaveLength(2);
            expect(response.data.every(post => post.status === 'published')).toBe(true);
        });

        it('should support field selection', async () => {
            const queryBuilder = new QueryBuilder(Post, {
                select: ['title', 'author', 'tags']
            });
            const response = await queryBuilder.execute();
            expect(response.data[0]).toHaveProperty('title');
            expect(response.data[0]).toHaveProperty('author');
            expect(response.data[0]).toHaveProperty('tags');
            expect(response.data[0]).not.toHaveProperty('content');
            expect(response.data[0]).not.toHaveProperty('viewCount');
        });

        it('should support multiple sorting criteria', async () => {
            const queryBuilder = new QueryBuilder(Post, {
                sort: [
                    { field: 'status', order: 'asc' },
                    { field: 'viewCount', order: 'desc' }
                ]
            });
            const response = await queryBuilder.execute();
            expect(response.data[0].status).toBe('draft');
            expect(response.data[1].status).toBe('published');
            expect(response.data[1].viewCount).toBeGreaterThan(response.data[2].viewCount);
        });

        it('should support pagination with complex filters', async () => {
            const queryBuilder = new QueryBuilder(Post, {
                filters: {
                    status: 'published',
                    viewCount_gte: 100
                },
                pagination: { page: 1, limit: 1 },
                sort: 'createdAt:desc'
            });
            const response = await queryBuilder.execute();
            expect(response.data).toHaveLength(1);
            expect(response.meta.totalCount).toBe(2);
            expect(response.meta.hasNextPage).toBe(true);
            expect(response.data[0].title).toBe('Second Post');
        });

        it('should support population with field selection', async () => {
            const queryBuilder = new QueryBuilder(Post, {
                filters: { status: 'published' },
                expand: [{
                    path: 'author',
                    select: ['name']
                }]
            });
            const response = await queryBuilder.execute();
            expect(response.data[0].author).toHaveProperty('name');
            expect(response.data[0].author).not.toHaveProperty('email');
            expect(response.data[0].author.name).toBe('Alice');
        });

        it('should support array field operations', async () => {
            const queryBuilder = new QueryBuilder(Post, {
                filters: {
                    tags_in: ['mongodb', 'advanced']
                }
            });
            const response = await queryBuilder.execute();
            expect(response.data).toHaveLength(1);
            expect(response.data[0].title).toBe('Second Post');
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
            const queryBuilder = new QueryBuilder(Post, {
                fullTextSearch: {
                    searchText: 'MongoDB aggregation',
                    sortByScore: true
                }
            });
            const response = await queryBuilder.execute();
            expect(response.data).toHaveLength(1);
            expect(response.data[0].title).toBe('MongoDB Tutorial');
        });

        it('should combine multiple query options', async () => {
            const queryBuilder = new QueryBuilder(Post, {
                filters: {
                    status: 'published',
                    viewCount_gt: 100
                },
                sort: 'viewCount:desc',
                select: ['title', 'viewCount', 'author'],
                expand: [{ path: 'author', select: ['name'] }],
                pagination: { page: 1, limit: 10 }
            });
            const response = await queryBuilder.execute();
            
            expect(response.data).toHaveLength(2);
            expect(response.meta.totalCount).toBe(2);
            expect(response.data[0]).toHaveProperty('title');
            expect(response.data[0]).toHaveProperty('viewCount');
            expect(response.data[0]).not.toHaveProperty('content');
            expect(response.data[0].viewCount).toBeGreaterThan(response.data[1].viewCount);
            expect(response.data[0].author).toHaveProperty('name');
        });

        it('should support date range filters', async () => {
            const queryBuilder = new QueryBuilder(Post, {
                filters: {
                    createdAt_gte: new Date('2024-01-02'),
                    status: 'published'
                }
            });
            const response = await queryBuilder.execute();
            expect(response.data).toHaveLength(1);
            expect(response.data[0].title).toBe('GraphQL Basics');
        });

        it('should support complex aggregation', async () => {
            const queryBuilder = new QueryBuilder(Post, {});
            const result = await queryBuilder
                .aggregate([
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                            totalViews: { $sum: '$viewCount' },
                            avgViews: { $avg: '$viewCount' }
                        }
                    },
                    { $sort: { totalViews: -1 } }
                ])
                .execute();

            expect(result).toHaveLength(1);
            expect(result[0]._id).toBe('published');
            expect(result[0].count).toBe(2);
            expect(result[0].totalViews).toBe(350);
        });
    });
});