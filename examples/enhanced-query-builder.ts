import express, { Request, Response } from 'express';
import mongoose, { Document } from 'mongoose';
import { QueryBuilder, queryBuilderMiddleware } from '../src';

// Document interfaces
interface ProductVariant {
    color: string;
    size: string;
    stock: number;
}

interface ProductDocument extends Document {
    name: string;
    description: string;
    price: number;
    category: string;
    tags: string[];
    stock: number;
    variants: ProductVariant[];
    status: 'active' | 'inactive' | 'draft';
    seller: SellerDocument;
    createdAt: Date;
}

interface SellerDocument extends Document {
    name: string;
    email: string;
    rating: number;
    status: 'active' | 'inactive';
}

// Schema definitions
const productSchema = new mongoose.Schema<ProductDocument>({
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

const sellerSchema = new mongoose.Schema<SellerDocument>({
    name: String,
    email: String,
    rating: Number,
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
});

// Create text indices for search capabilities
productSchema.index({ name: 'text', description: 'text' });

const app = express();

// Apply query builder middleware with options
app.use('/api', queryBuilderMiddleware({
    maxLimit: 50,
    defaultLimit: 20,
    restrictedFields: ['seller.email']
}));

// Example 1: Basic product listing with direct browser query support
app.get('/api/products', async (req: Request, res: Response) => {
    try {
        const queryBuilder = new QueryBuilder();
        const { data, metadata } = await queryBuilder.graph<ProductDocument>({
            entity: 'Product',
            defaultFilters: { 
                status: 'active',
                'seller.status': 'active'
            },
            filters: req.query.onSale ? {
                ...req.query,
                price_lt: req.query.originalPrice
            } : req.query,
            fields: ['name', 'price', 'description', 'category', 'tags', 'stock'],
            sort: req.query.sort as string || 'createdAt:desc',
            expand: [{ path: 'seller', select: ['name', 'rating'] }]
        });

        res.json({ success: true, data, metadata });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Example 2: Advanced product search with multiple criteria
app.get('/api/products/search', async (req: Request, res: Response) => {
    try {
        const queryBuilder = new QueryBuilder();
        
        // Build the search configuration
        const searchConfig = {
            entity: 'Product',
            filters: {
                status: 'active',
                stock_gt: 0,
                ...(req.query.category && { category: req.query.category }),
                ...(req.query.minPrice && { price_gte: Number(req.query.minPrice) }),
                ...(req.query.maxPrice && { price_lte: Number(req.query.maxPrice) }),
                ...(req.query.tags && { tags_in: (req.query.tags as string).split(',') })
            },
            ...(req.query.keyword && {
                fullTextSearch: {
                    searchText: req.query.keyword as string,
                    sortByScore: true,
                    language: 'english'
                }
            }),
            sort: [
                ...(req.query.keyword ? [{ field: 'score', order: 'desc' as const }] : []),
                { field: 'rating', order: 'desc' as const },
                { field: 'price', order: 'asc' as const }
            ],
            expand: [
                { 
                    path: 'seller',
                    select: ['name', 'rating', 'status']
                }
            ],
            pagination: {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 20
            }
        };

        const { data, metadata } = await queryBuilder.graph<ProductDocument>(searchConfig);
        res.json({ success: true, data, metadata });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Example 3: Product analytics with aggregation
app.get('/api/products/analytics', async (req: Request, res: Response) => {
    try {
        const queryBuilder = new QueryBuilder();
        
        // Build analytics configuration
        const analyticsConfig = {
            entity: 'Product',
            filters: {
                status: 'active',
                ...(req.query.startDate && req.query.endDate && {
                    createdAt_gte: new Date(req.query.startDate as string),
                    createdAt_lte: new Date(req.query.endDate as string)
                }),
                ...(req.query.category && { category: req.query.category })
            },
            sort: 'createdAt:desc'
        };

        // Execute the query
        const { data, metadata } = await queryBuilder.graph<ProductDocument>(analyticsConfig);

        // Process the results for analytics
        const analytics = {
            totalProducts: metadata.totalCount,
            totalValue: data.reduce((sum, product) => sum + product.price * product.stock, 0),
            categorySummary: data.reduce((acc, product) => {
                const cat = acc[product.category] || { 
                    count: 0, 
                    totalStock: 0, 
                    averagePrice: 0,
                    totalValue: 0
                };
                cat.count++;
                cat.totalStock += product.stock;
                cat.totalValue += product.price * product.stock;
                cat.averagePrice = cat.totalValue / cat.totalStock;
                acc[product.category] = cat;
                return acc;
            }, {} as Record<string, {
                count: number;
                totalStock: number;
                averagePrice: number;
                totalValue: number;
            }>),
            stockLevels: {
                outOfStock: data.filter(p => p.stock === 0).length,
                lowStock: data.filter(p => p.stock > 0 && p.stock < 10).length,
                adequate: data.filter(p => p.stock >= 10).length
            },
            priceRanges: {
                budget: data.filter(p => p.price < 50).length,
                midRange: data.filter(p => p.price >= 50 && p.price < 200).length,
                premium: data.filter(p => p.price >= 200).length
            }
        };

        res.json({ success: true, data: analytics, metadata });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Start server
async function startServer() {
    try {
        await mongoose.connect('mongodb://localhost:27017/ecommerce');
        console.log('Connected to MongoDB');
        
        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer().catch(console.error);