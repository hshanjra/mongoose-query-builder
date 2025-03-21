const express = require('express');
const mongoose = require('mongoose');
const { QueryBuilder, queryBuilderMiddleware } = require('../lib');

// Define sample schemas
const productSchema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    category: String,
    tags: [String],
    stock: Number,
    variants: [{
        color: String,
        size: String,
        stock: Number
    }],
    status: {
        type: String,
        enum: ['active', 'inactive', 'draft'],
        default: 'draft'
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller'
    },
    createdAt: { type: Date, default: Date.now }
});

const sellerSchema = new mongoose.Schema({
    name: String,
    email: String,
    rating: Number,
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
});

// Create text indices for search
productSchema.index({ name: 'text', description: 'text' });

const Product = mongoose.model('Product', productSchema);
const Seller = mongoose.model('Seller', sellerSchema);

const app = express();

// Apply query builder middleware with options
app.use('/api', queryBuilderMiddleware({
    maxLimit: 50,
    defaultLimit: 20,
    restrictedFields: ['seller.email']
}));

// Example 1: Basic product listing with direct browser query support
app.get('/api/products', async (req, res) => {
    try {
        const queryBuilder = new QueryBuilder();
        const { data, metadata } = await queryBuilder.graph({
            entity: 'Product',
            defaultFilters: { status: 'active' },
            filters: req.query.onSale ? {
                ...req.queryOptions.filters,
                'price_lt': req.query.originalPrice
            } : req.queryOptions.filters,
            fields: req.queryOptions.fields,
            sort: req.queryOptions.sort,
            pagination: req.queryOptions.pagination,
            expand: req.queryOptions.expand
        });

        res.json({ data, metadata });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example 2: Advanced product search with multiple modifications
app.get('/api/products/search', async (req, res) => {
    try {
        const queryBuilder = new QueryBuilder();
        
        // Build the search configuration
        const searchConfig = {
            entity: 'Product',
            filters: req.queryOptions.filters || {},
            fields: req.queryOptions.fields,
            sort: req.queryOptions.sort,
            pagination: req.queryOptions.pagination,
            expand: req.queryOptions.expand
        };

        // Add text search if provided
        if (req.query.keyword) {
            searchConfig.fullTextSearch = {
                searchText: req.query.keyword,
                sortByScore: true
            };
        }

        // Add price range filter
        if (req.query.minPrice || req.query.maxPrice) {
            searchConfig.filters = {
                ...searchConfig.filters,
                ...(req.query.minPrice && { price_gte: req.query.minPrice }),
                ...(req.query.maxPrice && { price_lte: req.query.maxPrice })
            };
        }

        // Add stock check
        searchConfig.filters = {
            ...searchConfig.filters,
            stock_gt: 0
        };

        // Execute the query
        const { data, metadata } = await queryBuilder.graph(searchConfig);
        res.json({ data, metadata });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example 3: Product analytics with aggregation
app.get('/api/products/analytics', async (req, res) => {
    try {
        const queryBuilder = new QueryBuilder();
        
        // Build analytics configuration
        const analyticsConfig = {
            entity: 'Product',
            filters: {
                ...(req.query.startDate && req.query.endDate && {
                    createdAt_gte: new Date(req.query.startDate),
                    createdAt_lte: new Date(req.query.endDate)
                }),
                ...req.queryOptions.filters
            }
        };

        // Execute the query
        const { data, metadata } = await queryBuilder.graph(analyticsConfig);

        // Process the results for analytics
        const analytics = {
            totalProducts: data.length,
            categorySummary: data.reduce((acc, product) => {
                acc[product.category] = acc[product.category] || {
                    count: 0,
                    totalStock: 0,
                    averagePrice: 0
                };
                acc[product.category].count++;
                acc[product.category].totalStock += product.stock;
                acc[product.category].averagePrice = 
                    (acc[product.category].averagePrice * (acc[product.category].count - 1) + product.price) / 
                    acc[product.category].count;
                return acc;
            }, {}),
            lowStockProducts: data.filter(p => p.stock < 10).length
        };

        res.json({ analytics, metadata });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/*
Example browser URLs:

1. Basic listing with filtering and sorting:
/api/products?
    category=electronics&
    price_gte=100&
    price_lte=500&
    status=active&
    sort=price:asc&
    page=1&
    limit=20

2. Full-text search with field selection and relations:
/api/products/search?
    keyword=smartphone&
    minPrice=200&
    maxPrice=800&
    fields=name,price,description&
    expand=seller&
    sort=rating:desc,price:asc

3. Complex filtering:
/api/products?
    category_in=electronics,gadgets&
    tags_all=premium,wireless&
    price_between=100,500&
    stock_gt=0&
    seller.rating_gte=4&
    status=active&
    sort=createdAt:desc

4. Analytics query:
/api/products/analytics?
    startDate=2024-01-01&
    endDate=2024-03-21&
    category=electronics
*/

async function startServer() {
    try {
        await mongoose.connect('mongodb://localhost:27017/ecommerce', {
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