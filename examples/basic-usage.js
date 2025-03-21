const mongoose = require('mongoose');
const { QueryBuilder } = require('../lib');

// Example Mongoose model
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    bio: String,
    age: Number,
    email: String,
    createdAt: { type: Date, default: Date.now }
}));

// Create a text index on the name and bio fields if needed
// This only needs to be done once when setting up your schema
// User.schema.index({ name: 'text', bio: 'text' });

async function runExample() {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/test', { 
        useNewUrlParser: true, 
        useUnifiedTopology: true 
    });
    
    // Create sample data if it doesn't exist
    const count = await User.countDocuments();
    if (count === 0) {
        console.log('Creating sample data...');
        await User.create([
            { name: 'John Smith', bio: 'Software developer with 5 years experience', age: 28, email: 'john@example.com' },
            { name: 'Jane Doe', bio: 'Data scientist specializing in machine learning', age: 32, email: 'jane@example.com' },
            { name: 'Bob Johnson', bio: 'DevOps engineer with cloud experience', age: 35, email: 'bob@example.com' }
        ]);
        
        // Create text index for full-text search
        console.log('Creating text index...');
        await User.collection.createIndex({ name: 'text', bio: 'text' });
    }

    // Initialize query builder
    const queryBuilder = new QueryBuilder();

    // Basic query with filters, sorting, pagination, and field selection
    console.log('\n--- Basic Query ---');
    const basicResult = await queryBuilder.graph({
        entity: 'User',
        filters: { age_gte: 18 },
        sort: 'createdAt:desc',
        pagination: { page: 1, limit: 10 },
        fields: ['name', 'email', 'age']
    });
    
    console.log('Basic query results:', basicResult.data);
    console.log('Metadata:', basicResult.metadata);

    // Full-text search example
    console.log('\n--- Full-Text Search ---');
    const textSearchResult = await queryBuilder.graph({
        entity: 'User',
        fullTextSearch: {
            searchText: 'developer',
            sortByScore: true
        }
    });
    
    console.log('Full-text search results for "developer":', textSearchResult.data);

    // Combined filtering and full-text search
    console.log('\n--- Combined Search ---');
    const combinedResult = await queryBuilder.graph({
        entity: 'User',
        filters: { age_lt: 30 },
        fullTextSearch: {
            searchText: 'developer',
            language: 'english'
        }
    });
    
    console.log('Young developers:', combinedResult.data);

    // Close the connection
    await mongoose.connection.close();
}

runExample().catch(err => console.error(err));