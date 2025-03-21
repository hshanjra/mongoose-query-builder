const express = require('express');
const mongoose = require('mongoose');
const { QueryBuilder } = require('../lib');

// Define sample schemas
const authorSchema = new mongoose.Schema({
    name: String,
    email: String,
    bio: String,
    role: { type: String, default: 'author' }
});

const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' },
    tags: [String],
    viewCount: Number,
    createdAt: { type: Date, default: Date.now }
});

// Create text index for full-text search
postSchema.index({ title: 'text', content: 'text' });

const Author = mongoose.model('Author', authorSchema);
const Post = mongoose.model('Post', postSchema);

// Express middleware to parse query parameters
const parseQueryParams = (req, res, next) => {
    try {
        // Parse filters
        req.queryOptions = {};
        if (req.query.filters) {
            req.queryOptions.filters = JSON.parse(req.query.filters);
        }

        // Parse sorting
        if (req.query.sort) {
            req.queryOptions.sorting = JSON.parse(req.query.sort);
        }

        // Parse pagination
        if (req.query.page || req.query.limit) {
            req.queryOptions.pagination = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10
            };
        }

        // Parse field selection
        if (req.query.fields) {
            req.queryOptions.selectFields = JSON.parse(req.query.fields);
        }

        // Parse population
        if (req.query.populate) {
            req.queryOptions.populate = JSON.parse(req.query.populate);
        }

        // Parse full-text search
        if (req.query.search) {
            req.queryOptions.fullTextSearch = {
                searchText: req.query.search,
                sortByScore: true
            };
        }

        next();
    } catch (error) {
        res.status(400).json({
            error: 'Invalid query parameters',
            details: error.message
        });
    }
};

// Express route handlers
const app = express();

// Example route with query builder
app.get('/api/posts', parseQueryParams, async (req, res) => {
    try {
        // Add default filters for security
        const queryOptions = {
            ...req.queryOptions,
            defaultFilters: { status: 'published' }, // Only show published posts
            restrictedFields: ['author.email'] // Protect author's email
        };

        const queryBuilder = new QueryBuilder(Post, queryOptions);
        const response = await queryBuilder.execute();

        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example usage with curl:
/*
    # Basic query with filtering and sorting
    curl "http://localhost:3000/api/posts?filters={\"tags\":\"mongodb\"}&sort=[{\"field\":\"createdAt\",\"order\":\"desc\"}]&page=1&limit=10"

    # Full-text search with field selection
    curl "http://localhost:3000/api/posts?search=mongodb&fields=[\"title\",\"content\"]&populate=[{\"path\":\"author\",\"select\":[\"name\",\"bio\"]}]"
*/

// Start the server
async function startServer() {
    try {
        await mongoose.connect('mongodb://localhost:27017/blog', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        // Create sample data if database is empty
        const authorCount = await Author.countDocuments();
        if (authorCount === 0) {
            const author = await Author.create({
                name: 'John Doe',
                email: 'john@example.com',
                bio: 'Technical writer and MongoDB enthusiast'
            });

            await Post.create([
                {
                    title: 'Getting Started with MongoDB',
                    content: 'MongoDB is a powerful NoSQL database...',
                    status: 'published',
                    author: author._id,
                    tags: ['mongodb', 'database', 'tutorial']
                },
                {
                    title: 'Advanced MongoDB Queries',
                    content: 'Learn about aggregation pipelines...',
                    status: 'published',
                    author: author._id,
                    tags: ['mongodb', 'advanced']
                }
            ]);
        }

        app.listen(3000, () => {
            console.log('Server running on http://localhost:3000');
            console.log('\nTry these example queries:');
            console.log('\n1. Get all published posts:');
            console.log('GET http://localhost:3000/api/posts');
            console.log('\n2. Search posts with pagination:');
            console.log('GET http://localhost:3000/api/posts?search=mongodb&page=1&limit=10');
            console.log('\n3. Get posts with author details:');
            console.log('GET http://localhost:3000/api/posts?populate=[{"path":"author","select":["name","bio"]}]');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();