import mongoose, { Document } from 'mongoose';
import { QueryBuilder } from '../src';
import { GraphQueryResponse } from '../src/types';

// Document interfaces
interface ProductDocument extends Document {
    name: string;
    price: number;
    category: string;
    description: string;
    status: string;
    createdAt: Date;
}

// Schema definition
const productSchema = new mongoose.Schema<ProductDocument>({
    name: String,
    price: Number,
    category: String,
    description: String,
    status: String,
    createdAt: { type: Date, default: Date.now }
});

// Create text index for search capabilities
productSchema.index({ name: 'text', description: 'text' });

const ProductModel = mongoose.model<ProductDocument>('Product', productSchema);

async function demonstrateResponseFormats() {
    try {
        await mongoose.connect('mongodb://localhost:27017/test');
        console.log('Connected to MongoDB');

        const queryBuilder = new QueryBuilder();

        // Example 1: Basic query response
        console.log('\n--- Example 1: Basic Query Response ---');
        const basicResponse = await queryBuilder.graph<ProductDocument>({
            entity: 'Product',
            fields: ['name', 'price'],
            sort: 'price:desc',
            pagination: { page: 1, limit: 2 }
        });

        console.log('Basic Response Structure:');
        console.log(JSON.stringify(basicResponse, null, 2));

        // Example 2: Response with filters and full-text search
        console.log('\n--- Example 2: Response with Search and Filters ---');
        const searchResponse = await queryBuilder.graph<ProductDocument>({
            entity: 'Product',
            filters: {
                category: 'electronics',
                price_gte: 100,
                status: 'active'
            },
            fullTextSearch: {
                searchText: 'wireless',
                sortByScore: true,
                language: 'english'
            },
            pagination: { page: 1, limit: 5 }
        });

        console.log('Search Response Structure:');
        console.log(JSON.stringify(searchResponse, null, 2));

        // Example 3: Response with relationships
        console.log('\n--- Example 3: Response with Relationships ---');
        const relationalResponse = await queryBuilder.graph<ProductDocument>({
            entity: 'Product',
            expand: [
                { path: 'category', select: ['name'] },
                { path: 'reviews', select: ['rating', 'comment'] }
            ],
            pagination: { page: 1, limit: 3 }
        });

        console.log('Relational Response Structure:');
        console.log(JSON.stringify(relationalResponse, null, 2));

        // Example 4: Analytics response with aggregated data
        console.log('\n--- Example 4: Analytics Response ---');
        const analyticsResponse = await queryBuilder.graph<ProductDocument>({
            entity: 'Product',
            filters: {
                createdAt_gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                status: 'active'
            }
        });

        // Process analytics from the response
        type ProductAnalytics = {
            totalProducts: number;
            averagePrice: number;
            categoryBreakdown: Record<string, number>;
            priceRanges: {
                budget: number;    // < $100
                midRange: number;  // $100 - $500
                premium: number;   // > $500
            };
            statusDistribution: Record<string, number>;
        };

        const analytics: ProductAnalytics = {
            totalProducts: analyticsResponse.metadata.totalCount,
            averagePrice: analyticsResponse.data.reduce((sum, product) => sum + product.price, 0) / analyticsResponse.data.length,
            categoryBreakdown: analyticsResponse.data.reduce((acc, product) => {
                acc[product.category] = (acc[product.category] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
            priceRanges: {
                budget: analyticsResponse.data.filter(p => p.price < 100).length,
                midRange: analyticsResponse.data.filter(p => p.price >= 100 && p.price <= 500).length,
                premium: analyticsResponse.data.filter(p => p.price > 500).length
            },
            statusDistribution: analyticsResponse.data.reduce((acc, product) => {
                acc[product.status] = (acc[product.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        };

        const enhancedResponse = {
            ...analyticsResponse,
            analytics
        };

        console.log('Analytics Response:');
        console.log(JSON.stringify(enhancedResponse, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB connection closed');
    }
}

// Run the demonstration
demonstrateResponseFormats().catch(console.error);