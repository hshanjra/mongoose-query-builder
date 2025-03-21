const express = require('express');
const mongoose = require('mongoose');
const { QueryBuilder, queryBuilderMiddleware } = require('../lib');

const app = express();

// Define sample schemas
const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    description: String,
    category: String,
    tags: [String],
    status: {
        type: String,
        enum: ['active', 'draft', 'archived'],
        default: 'draft'
    },
    createdAt: { type: Date, default: Date.now }
});

const categorySchema = new mongoose.Schema({
    name: String,
    description: String,
    slug: String,
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    isActive: { type: Boolean, default: true }
});

// Create models
const Product = mongoose.model('Product', productSchema);
const Category = mongoose.model('Category', categorySchema);

// Configure middleware with global and route-specific options
app.use('/api', queryBuilderMiddleware({
    // Global options
    maxLimit: 50,
    defaultLimit: 20,
    restrictedFields: ['__v'],
    defaultFilters: { status: 'active' }, // Global default filter

    // Route-specific configurations
    routeConfig: {
        '/products': {
            maxLimit: 100,
            defaultLimit: 30,
            allowedFields: ['name', 'price', 'description', 'category', 'tags', 'status', 'createdAt'],
            defaultFilters: { status: 'active' }
        },
        '/products/analytics': {
            maxLimit: 1000, // Higher limit for analytics
            defaultLimit: 500,
            allowedFields: ['price', 'category', 'status', 'createdAt'],
            restrictedFields: ['description', 'tags'] // Additional restricted fields for analytics
        },
        '/categories': {
            maxLimit: 200,
            defaultLimit: 50,
            allowedFields: ['name', 'description', 'slug', 'parent', 'isActive'],
            defaultFilters: { isActive: true }
        },
        '/categories/tree': {
            maxLimit: 500,
            defaultLimit: 100,
            allowedFields: ['name', 'slug', 'parent'],
            defaultFilters: { isActive: true }
        }
    }
}));

// Create a base controller class that handles common query builder operations
class BaseController {
    constructor(modelName) {
        this.modelName = modelName;
        this.queryBuilder = new QueryBuilder();
    }

    async findAll(req, res) {
        try {
            const { data, metadata } = await this.queryBuilder.graph({
                entity: this.modelName,
                ...req.queryOptions
            });

            res.json({ data, metadata });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async findById(req, res) {
        try {
            const { data, metadata } = await this.queryBuilder.graph({
                entity: this.modelName,
                filters: { _id: req.params.id },
                ...req.queryOptions
            });

            if (!data.length) {
                return res.status(404).json({ 
                    error: `${this.modelName} not found` 
                });
            }

            res.json({ data: data[0], metadata });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

// Product controller extending base controller
class ProductController extends BaseController {
    constructor() {
        super('Product');
    }

    // Custom method for product search
    async search(req, res) {
        try {
            const { data, metadata } = await this.queryBuilder.graph({
                entity: this.modelName,
                fullTextSearch: {
                    searchText: req.query.q,
                    sortByScore: true
                },
                filters: {
                    ...req.queryOptions.filters,
                    price_gte: req.query.minPrice,
                    price_lte: req.query.maxPrice
                },
                expand: [
                    { path: 'category', select: ['name', 'slug'] }
                ],
                ...req.queryOptions
            });

            res.json({ data, metadata });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Custom method for product analytics
    async analytics(req, res) {
        try {
            const { data, metadata } = await this.queryBuilder.graph({
                entity: this.modelName,
                filters: {
                    createdAt_gte: req.query.startDate,
                    createdAt_lte: req.query.endDate,
                    ...req.queryOptions.filters
                }
            });

            // Process analytics
            const analytics = {
                totalProducts: data.length,
                categorySummary: data.reduce((acc, product) => {
                    acc[product.category] = acc[product.category] || 0;
                    acc[product.category]++;
                    return acc;
                }, {}),
                priceRanges: {
                    budget: data.filter(p => p.price < 50).length,
                    midRange: data.filter(p => p.price >= 50 && p.price < 200).length,
                    premium: data.filter(p => p.price >= 200).length
                }
            };

            res.json({ data: analytics, metadata });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

// Category controller extending base controller
class CategoryController extends BaseController {
    constructor() {
        super('Category');
    }

    // Custom method to get category tree
    async tree(req, res) {
        try {
            const { data, metadata } = await this.queryBuilder.graph({
                entity: this.modelName,
                filters: { parent: null }, // Get root categories
                expand: [{ 
                    path: 'children',
                    select: ['name', 'slug', 'children']
                }],
                ...req.queryOptions
            });

            res.json({ data, metadata });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

// Initialize controllers
const productController = new ProductController();
const categoryController = new CategoryController();

// Product routes
app.get('/api/products', productController.findAll.bind(productController));
app.get('/api/products/search', productController.search.bind(productController));
app.get('/api/products/analytics', productController.analytics.bind(productController));
app.get('/api/products/:id', productController.findById.bind(productController));

// Category routes
app.get('/api/categories', categoryController.findAll.bind(categoryController));
app.get('/api/categories/tree', categoryController.tree.bind(categoryController));
app.get('/api/categories/:id', categoryController.findById.bind(categoryController));

/*
Example API calls with route-specific configurations:

1. Get all products (uses /products config):
GET /api/products?page=1&limit=30&sort=price:desc
- Uses higher limit (30) specific to products route
- Enforces allowedFields for field selection
- Applies product-specific default filters

2. Product analytics (uses /products/analytics config):
GET /api/products/analytics?startDate=2024-01-01&endDate=2024-12-31
- Uses much higher limits for analytics purposes
- Restricts certain fields from being queried
- Optimized for analytical queries

3. Get categories (uses /categories config):
GET /api/categories?expand=parent(name slug)&limit=50
- Uses category-specific configuration
- Applies isActive filter by default
- Different limit settings for category listing

4. Get category tree (uses /categories/tree config):
GET /api/categories/tree
- Uses tree-specific configuration
- Higher limits for full tree retrieval
- Optimized field selection for tree structure
*/

// Start server
async function startServer() {
    try {
        await mongoose.connect('mongodb://localhost:27017/test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        app.listen(3000, () => {
            console.log('Server running on http://localhost:3000');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();