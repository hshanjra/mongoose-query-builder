const mongoose = require('mongoose');
const { QueryBuilder } = require('../lib');

// Example Product model
const Product = mongoose.model('Product', new mongoose.Schema({
    name: String,
    price: Number,
    category: String,
    description: String,
    status: String,
    createdAt: { type: Date, default: Date.now }
}));

async function demonstrateResponseFormats() {
    try {
        await mongoose.connect('mongodb://localhost:27017/test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const query = new QueryBuilder();

        // Example 1: Basic query response
        console.log('\n--- Example 1: Basic Query Response ---');
        const basicResponse = await query.graph({
            entity: 'Product',
            fields: ['name', 'price'],
            sort: 'price:desc',
            pagination: { page: 1, limit: 2 }
        });

        console.log('Basic Response Structure:');
        console.log(JSON.stringify(basicResponse, null, 2));

        // Example 2: Response with filters and full-text search
        console.log('\n--- Example 2: Response with Search and Filters ---');
        const searchResponse = await query.graph({
            entity: 'Product',
            filters: {
                category: 'electronics',
                price_gte: 100
            },
            fullTextSearch: {
                searchText: 'wireless',
                sortByScore: true
            },
            pagination: { page: 1, limit: 5 }
        });

        console.log('Search Response Structure:');
        console.log(JSON.stringify(searchResponse, null, 2));

        // Example 3: Response with relationships
        console.log('\n--- Example 3: Response with Relationships ---');
        const relationalResponse = await query.graph({
            entity: 'Product',
            expand: [
                { path: 'category', select: ['name'] },
                { path: 'reviews', select: ['rating', 'comment'] }
            ],
            pagination: { page: 1, limit: 3 }
        });

        console.log('Relational Response Structure:');
        console.log(JSON.stringify(relationalResponse, null, 2));

        // Example 4: Analytics response
        console.log('\n--- Example 4: Analytics Response ---');
        const analyticsResponse = await query.graph({
            entity: 'Product',
            filters: {
                createdAt_gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                status: 'active'
            }
        });

        // Process analytics from the response
        const analytics = {
            totalProducts: analyticsResponse.metadata.totalCount,
            averagePrice: analyticsResponse.data.reduce((sum, product) => sum + product.price, 0) / analyticsResponse.data.length,
            categoryBreakdown: analyticsResponse.data.reduce((acc, product) => {
                acc[product.category] = (acc[product.category] || 0) + 1;
                return acc;
            }, {})
        };

        console.log('Analytics Response:');
        console.log(JSON.stringify({
            ...analyticsResponse,
            analytics
        }, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Run the demonstration
demonstrateResponseFormats().catch(console.error);