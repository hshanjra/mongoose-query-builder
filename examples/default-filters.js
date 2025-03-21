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
                tags: ['phone', 'gadget']
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

    const queryBuilder = new QueryBuilder();

    // Example 1: Using defaultFilters to only show published products
    console.log('\n--- Example 1: Default Filters ---');
    const { data: publishedProducts } = await queryBuilder.graph({
        entity: 'Product',
        defaultFilters: { status: 'published' },
        sort: 'price:asc'
    });
    
    console.log('Published products (default filter):', 
        publishedProducts.map(p => `${p.name} - $${p.price} (${p.status})`));

    // Example 2: User filters combined with default filters
    console.log('\n--- Example 2: Combined Filters ---');
    const { data: budgetPublishedProducts } = await queryBuilder.graph({
        entity: 'Product',
        defaultFilters: { status: 'published' },
        filters: { price_lt: 500 },
        sort: 'price:asc'
    });
    
    console.log('Budget published products (combined filters):', 
        budgetPublishedProducts.map(p => `${p.name} - $${p.price} (${p.status})`));

    // Example 3: Admin view (no default filters) to see all products
    console.log('\n--- Example 3: Admin View (No Default Filters) ---');
    const { data: allProducts } = await queryBuilder.graph({
        entity: 'Product',
        sort: 'price:desc'
    });
    
    console.log('All products (admin view):', 
        allProducts.map(p => `${p.name} - $${p.price} (${p.status})`));

    // Example 4: Complex filtering with default filters
    console.log('\n--- Example 4: Complex Filtering ---');
    const { data: filteredProducts } = await queryBuilder.graph({
        entity: 'Product',
        defaultFilters: { status: 'published' },
        filters: { 
            category: 'electronics',
            tags_in: ['budget', 'phone']
        }
    });
    
    console.log('Filtered products (complex filters):', 
        filteredProducts.map(p => `${p.name} - ${p.tags.join(', ')} (${p.status})`));

    // Close the connection
    await mongoose.connection.close();
}

runExample().catch(err => console.error(err));