const express = require('express');
const mongoose = require('mongoose');
const { QueryBuilder, queryBuilderMiddleware } = require('../lib');

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

// Example logging middleware
const queryLoggerMiddleware = (req, res, next) => {
    console.log('Incoming query parameters:', req.query);
    next();
};

// Example validation middleware
const queryValidationMiddleware = (req, res, next) => {
    if (req.query.page && isNaN(req.query.page)) {
        return res.status(400).json({ error: 'Invalid page number' });
    }
    if (req.query.limit && isNaN(req.query.limit)) {
        return res.status(400).json({ error: 'Invalid limit value' });
    }
    next();
};

// Example authorization middleware
const authMiddleware = (req, res, next) => {
    // Simulate user authentication
    req.user = { 
        id: '123', 
        role: 'user',
        organizationId: 'org123'
    };
    next();
};

// Example query enhancement middleware
const enhanceQueryMiddleware = (req, res, next) => {
    // Add organization filter for multi-tenant scenarios
    if (req.user && req.user.organizationId) {
        req.queryOptions = req.queryOptions || {};
        req.queryOptions.defaultFilters = {
            ...(req.queryOptions.defaultFilters || {}),
            organizationId: req.user.organizationId
        };
    }
    next();
};

const app = express();

// Apply middlewares in order
app.use(queryLoggerMiddleware);
app.use(queryValidationMiddleware);
app.use(authMiddleware);
app.use(queryBuilderMiddleware({
    maxLimit: 50,
    defaultLimit: 20,
    restrictedFields: ['password', 'secretKey']
}));
app.use(enhanceQueryMiddleware);

// Example API endpoint
app.get('/api/products', async (req, res) => {
    try {
        const query = new QueryBuilder();
        
        // Apply any additional business logic
        const searchConfig = {
            entity: 'Product',
            fields: req.queryOptions.fields,
            filters: {
                ...req.queryOptions.filters,
                isActive: true  // Business rule: only show active products
            },
            sort: req.queryOptions.sort,
            pagination: req.queryOptions.pagination,
            expand: req.queryOptions.expand
        };

        // Execute query
        const { data, metadata } = await query.graph(searchConfig);

        // Send response
        res.json({
            success: true,
            data,
            metadata
        });
    } catch (error) {
        console.error('Query execution error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Example error handling middleware
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    res.status(500).json({
        success: false,
        error: error.message
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});