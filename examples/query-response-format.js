const mongoose = require('mongoose');
const { QueryBuilder } = require('../lib');

// Example Product Mongoose model
const Product = mongoose.model('Product', new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    category: String,
    tags: [String],
    createdAt: { type: Date, default: Date.now }
}));

async function runExample() {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/test', { 
        useNewUrlParser: true, 
        useUnifiedTopology: true 
    });
    
    // Create sample data if it doesn't exist
    const count = await Product.countDocuments();
    if (count === 0) {
        console.log('Creating sample products...');
        await Product.create([
            { 
                name: 'Premium Smartphone', 
                description: 'Latest smartphone with advanced features', 
                price: 999,
                status: 'published',
                category: 'electronics',
                tags: ['phone', 'gadget', 'premium']
            },
            { 
                name: 'Budget Smartphone', 
                description: 'Affordable smartphone for basic needs', 
                price: 299,
                status: 'published',
                category: 'electronics',
                tags: ['phone', 'budget']
            },
            { 
                name: 'Gaming Laptop', 
                description: 'High-performance laptop for gaming enthusiasts', 
                price: 1499,
                status: 'published',
                category: 'electronics',
                tags: ['laptop', 'gaming', 'premium']
            },
            { 
                name: 'Bluetooth Headphones', 
                description: 'Wireless headphones with noise cancellation', 
                price: 199,
                status: 'published',
                category: 'audio',
                tags: ['headphones', 'wireless', 'budget']
            },
            { 
                name: 'Upcoming Tablet', 
                description: 'Next generation tablet coming soon', 
                price: 599,
                status: 'draft',
                category: 'electronics',
                tags: ['tablet', 'gadget']
            },
            { 
                name: 'Discontinued Laptop', 
                description: 'Old model laptop no longer available', 
                price: 899,
                status: 'archived',
                category: 'electronics',
                tags: ['laptop', 'computer']
            }
        ]);
    }

    // Demo the standardized query response format
    console.log('\n--- Query Response Format Demo ---');
    const productsQuery = new QueryBuilder(Product, {
        defaultFilters: { status: 'published' },
        filters: { 
            price_gte: 200,
            category: 'electronics'
        },
        pagination: {
            page: 1,
            limit: 2
        },
        sort: { price: 'asc' }
    });
    
    // Use the new execute method to get the standardized response
    const response = await productsQuery.execute();
    
    // Log the full response structure
    console.log('Standard Query Response Structure:');
    console.log(JSON.stringify({
        data: '[Array of product documents]',
        meta: response.meta
    }, null, 2));
    
    // Display the actual data
    console.log('\nPage 1 results:');
    response.data.forEach(product => {
        console.log(`- ${product.name} ($${product.price})`);
    });
    
    // Demonstrate pagination by fetching the second page
    if (response.meta.hasNextPage) {
        console.log('\nFetching page 2...');
        
        const page2Query = new QueryBuilder(Product, {
            defaultFilters: { status: 'published' },
            filters: { 
                price_gte: 200,
                category: 'electronics'
            },
            pagination: {
                page: 2,
                limit: 2
            },
            sort: { price: 'asc' }
        });
        
        const page2Response = await page2Query.execute();
        
        console.log('Page 2 results:');
        page2Response.data.forEach(product => {
            console.log(`- ${product.name} ($${product.price})`);
        });
        
        // Show pagination metadata
        console.log('\nPagination metadata:');
        console.log(`- Total items: ${page2Response.meta.totalCount}`);
        console.log(`- Total pages: ${page2Response.meta.totalPages}`);
        console.log(`- Current page: ${page2Response.meta.currentPage}`);
        console.log(`- Items per page: ${page2Response.meta.pageSize}`);
    }
    
    // Demonstrate execution time tracking
    console.log('\nPerformance metrics:');
    console.log(`- Query execution time: ${response.meta.executionTimeMs}ms`);

    // Close the connection
    await mongoose.connection.close();
}

runExample().catch(err => console.error(err));