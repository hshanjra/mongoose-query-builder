const mongoose = require('mongoose');
const { QueryBuilder } = require('../src');

// Example Mongoose model with text index
const Product = mongoose.model('Product', new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    tags: [String],
    createdAt: { type: Date, default: Date.now }
}));

// Create a text index on the name and description fields
// This needs to be done once when setting up your schema
// Product.schema.index({ name: 'text', description: 'text' });

async function runBasicExample() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/test', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        
        console.log('Connected to MongoDB');

        // Create an instance of QueryBuilder with basic filtering and sorting
        const queryBuilder = new QueryBuilder(Product, {
            filters: { price: { $gte: 10 } },
            sort: { createdAt: 'desc' },
            pagination: { page: 1, limit: 10 },
            fields: 'name description price'
        });

        // Execute the query
        const products = await queryBuilder.buildQuery().exec();
        console.log('Basic query results:', products);
    } catch (err) {
        console.error('Error in basic example:', err);
    }
}

async function runFullTextSearchExample() {
    try {
        // Connect to MongoDB (if not already connected)
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect('mongodb://localhost:27017/test', { 
                useNewUrlParser: true, 
                useUnifiedTopology: true 
            });
            console.log('Connected to MongoDB');
        }

        // Create sample data if not exists
        const count = await Product.countDocuments();
        if (count === 0) {
            console.log('Creating sample data...');
            await Product.create([
                { 
                    name: 'Smartphone X', 
                    description: 'High-end smartphone with advanced camera features', 
                    price: 999,
                    tags: ['electronics', 'smartphone']
                },
                { 
                    name: 'Laptop Pro', 
                    description: 'Professional laptop for developers and designers', 
                    price: 1499,
                    tags: ['electronics', 'computer']
                },
                { 
                    name: 'Wireless Headphones', 
                    description: 'Noise cancelling headphones with long battery life', 
                    price: 299,
                    tags: ['audio', 'electronics']
                }
            ]);
            
            // Create the text index if it doesn't exist
            console.log('Creating text index...');
            await Product.collection.createIndex({ name: 'text', description: 'text' });
        }

        // Using QueryBuilder with full-text search
        console.log('Running full-text search for "smartphone"...');
        const smartphoneQuery = new QueryBuilder(Product, {
            fullTextSearch: {
                searchText: 'smartphone',
                sortByScore: true
            }
        });

        const smartphones = await smartphoneQuery.buildQuery().exec();
        console.log('Smartphone search results:', smartphones);

        // Another search example with additional filters
        console.log('Running full-text search for "electronics" with price filter...');
        const electronicsQuery = new QueryBuilder(Product, {
            filters: { price: { $lt: 1000 } },
            fullTextSearch: {
                searchText: 'electronics'
            },
            sort: { price: 'desc' }
        });

        const affordableElectronics = await electronicsQuery.buildQuery().exec();
        console.log('Affordable electronics search results:', affordableElectronics);

        // Example with language specification
        console.log('Running advanced search with language specification...');
        const advancedQuery = new QueryBuilder(Product, {
            fullTextSearch: {
                searchText: 'headphones noise',
                language: 'english',
                sortByScore: true
            }
        });

        const advancedResults = await advancedQuery.buildQuery().exec();
        console.log('Advanced search results:', advancedResults);
    } catch (err) {
        console.error('Error in full-text search example:', err);
    } finally {
        // Close the connection
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
}

// Run examples
async function runAllExamples() {
    try {
        await runBasicExample();
        await runFullTextSearchExample();
    } catch (err) {
        console.error('Error running examples:', err);
    } finally {
        // Ensure connection is closed
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
            console.log('MongoDB connection closed');
        }
    }
}

runAllExamples();