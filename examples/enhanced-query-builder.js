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
        const queryBuilder = new QueryBuilder(Product, req.queryOptions);

        // Add default filters for security
        queryBuilder.addFilters({ status: 'active' });

        // Example: Add business logic based filters
        if (req.query.onSale) {
            queryBuilder.addFilters({ 'price_lt': req.query.originalPrice });
        }

        const response = await queryBuilder.execute();
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example 2: Advanced product search with multiple modifications
app.get('/api/products/search', async (req, res) => {
    try {
        const queryBuilder = new QueryBuilder(Product, req.queryOptions);

        // Add text search if provided
        if (req.query.keyword) {
            queryBuilder.addFilters({ 
                $text: { $search: req.query.keyword } 
            });
        }

        // Add price range filter
        if (req.query.minPrice || req.query.maxPrice) {
            const priceFilter = {};
            if (req.query.minPrice) priceFilter.price_gte = req.query.minPrice;
            if (req.query.maxPrice) priceFilter.price_lte = req.query.maxPrice;
            queryBuilder.addFilters(priceFilter);
        }

        // Add category filter with subcategories support
        if (req.query.category) {
            const categories = await getCategoryWithChildren(req.query.category);
            queryBuilder.addFilters({ category_in: categories });
        }

        // Modify query for inventory check
        queryBuilder.modify(query => {
            query.where('stock').gt(0);
        });

        // Add seller info but protect sensitive data
        queryBuilder.addExpand('seller');
        queryBuilder.addSelect(['name', 'price', 'description', 'seller.name', 'seller.rating']);

        const response = await queryBuilder.execute();
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example 3: Product analytics with aggregation
app.get('/api/products/analytics', async (req, res) => {
    try {
        const queryBuilder = new QueryBuilder(Product, req.queryOptions);

        // Add date range filter
        if (req.query.startDate && req.query.endDate) {
            queryBuilder.addFilters({
                createdAt_gte: new Date(req.query.startDate),
                createdAt_lte: new Date(req.query.endDate)
            });
        }

        // Use raw aggregation for complex analytics
        const analyticsResults = await queryBuilder
            .aggregate([
                { $match: queryBuilder.buildQuery().getQuery() },
                {
                    $group: {
                        _id: '$category',
                        totalProducts: { $sum: 1 },
                        averagePrice: { $avg: '$price' },
                        totalStock: { $sum: '$stock' },
                        productsWithLowStock: {
                            $sum: { $cond: [{ $lt: ['$stock', 10] }, 1, 0] }
                        }
                    }
                },
                { $sort: { totalProducts: -1 } }
            ])
            .execute();

        res.json(analyticsResults);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example browser URLs:

/*
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
    select=name,price,description&
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