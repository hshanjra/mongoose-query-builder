const mongoose = require('mongoose');
const { QueryBuilder } = require('../lib');

// Define sample schema
const orderSchema = new mongoose.Schema({
    orderId: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    products: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: Number,
        price: Number
    }],
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered'],
        default: 'pending'
    },
    totalAmount: Number,
    createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

async function runAggregationExamples() {
    try {
        await mongoose.connect('mongodb://localhost:27017/ecommerce', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Example 1: Basic aggregation with filtering and grouping
        console.log('\nExample 1: Orders by status with total revenue');
        const orderStats = new QueryBuilder(Order, {
            filters: {
                createdAt_gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
        });
        
        const orderResults = await orderStats
            .aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' }
                    }
                },
                {
                    $sort: { revenue: -1 }
                }
            ])
            .execute();

        console.log('Order statistics:', orderResults);

        // Example 2: Complex aggregation with multiple stages
        console.log('\nExample 2: Product sales analysis');
        const productAnalysis = new QueryBuilder(Order, {
            filters: { status: 'delivered' }
        });

        const productResults = await productAnalysis
            .aggregate([
                { $unwind: '$products' },
                {
                    $group: {
                        _id: '$products.productId',
                        totalSold: { $sum: '$products.quantity' },
                        totalRevenue: { 
                            $sum: { 
                                $multiply: ['$products.quantity', '$products.price'] 
                            }
                        },
                        averageOrderValue: { $avg: '$products.price' }
                    }
                },
                {
                    $sort: { totalRevenue: -1 }
                },
                {
                    $limit: 10
                }
            ])
            .execute();

        console.log('Top 10 products by revenue:', productResults);

        // Example 3: Time-based analysis with date grouping
        console.log('\nExample 3: Daily sales trend');
        const salesTrend = new QueryBuilder(Order, {
            filters: {
                createdAt_gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
        });

        const trendResults = await salesTrend
            .aggregate([
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' },
                            day: { $dayOfMonth: '$createdAt' }
                        },
                        orders: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' },
                        averageOrderValue: { $avg: '$totalAmount' }
                    }
                },
                {
                    $sort: { 
                        '_id.year': 1, 
                        '_id.month': 1, 
                        '_id.day': 1 
                    }
                },
                {
                    $project: {
                        _id: 0,
                        date: {
                            $dateFromParts: {
                                year: '$_id.year',
                                month: '$_id.month',
                                day: '$_id.day'
                            }
                        },
                        orders: 1,
                        revenue: 1,
                        averageOrderValue: 1
                    }
                }
            ])
            .execute();

        console.log('Daily sales trend:', trendResults);

        // Example 4: Customer segmentation
        console.log('\nExample 4: Customer order frequency');
        const customerSegments = new QueryBuilder(Order, {});

        const segmentResults = await customerSegments
            .aggregate([
                {
                    $group: {
                        _id: '$userId',
                        orderCount: { $sum: 1 },
                        totalSpent: { $sum: '$totalAmount' },
                        firstOrder: { $min: '$createdAt' },
                        lastOrder: { $max: '$createdAt' }
                    }
                },
                {
                    $addFields: {
                        daysSinceLastOrder: {
                            $dateDiff: {
                                startDate: '$lastOrder',
                                endDate: '$$NOW',
                                unit: 'day'
                            }
                        },
                        averageOrderValue: {
                            $divide: ['$totalSpent', '$orderCount']
                        }
                    }
                },
                {
                    $bucket: {
                        groupBy: '$orderCount',
                        boundaries: [1, 3, 5, 10, 20],
                        default: '20+',
                        output: {
                            count: { $sum: 1 },
                            avgSpent: { $avg: '$totalSpent' },
                            customers: { $push: '$_id' }
                        }
                    }
                }
            ])
            .execute();

        console.log('Customer segments by order frequency:', segmentResults);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

runAggregationExamples();