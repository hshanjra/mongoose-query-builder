import mongoose, { Document } from 'mongoose';
import { QueryBuilder } from '../src';

// Order document interfaces
interface OrderProduct {
    productId: string;
    name: string;
    quantity: number;
    price: number;
}

interface OrderDocument extends Document {
    orderId: string;
    customerId: string;
    products: OrderProduct[];
    status: string;
    totalAmount: number;
    createdAt: Date;
}

// Order schema definition
const orderSchema = new mongoose.Schema<OrderDocument>({
    orderId: String,
    customerId: String,
    products: [{
        productId: String,
        name: String,
        quantity: Number,
        price: Number
    }],
    status: String,
    totalAmount: Number,
    createdAt: { type: Date, default: Date.now }
});

const OrderModel = mongoose.model<OrderDocument>('Order', orderSchema);

async function demonstrateAggregateQueries() {
    try {
        await mongoose.connect('mongodb://localhost:27017/test');
        console.log('Connected to MongoDB');

        const queryBuilder = new QueryBuilder();

        // Example 1: Sales Analytics by Date Range
        console.log('\n--- Example 1: Sales Analytics by Date Range ---');
        const { data: salesData } = await queryBuilder.graph<OrderDocument>({
            entity: 'Order',
            filters: {
                createdAt_gte: new Date('2024-01-01'),
                createdAt_lte: new Date('2024-12-31'),
                status: 'completed'
            }
        });

        // Process sales data by month
        const monthlySales = salesData.reduce((acc, order) => {
            const month = order.createdAt.getMonth();
            acc[month] = acc[month] || { total: 0, count: 0, avgOrderValue: 0 };
            acc[month].total += order.totalAmount;
            acc[month].count++;
            acc[month].avgOrderValue = acc[month].total / acc[month].count;
            return acc;
        }, {} as Record<number, { total: number; count: number; avgOrderValue: number }>);

        console.log('Monthly Sales Analysis:', monthlySales);

        // Example 2: Product Performance Analysis
        console.log('\n--- Example 2: Product Performance Analysis ---');
        const { data: productData } = await queryBuilder.graph<OrderDocument>({
            entity: 'Order',
            filters: {
                status: 'completed'
            },
            sort: 'createdAt:desc'
        });

        // Process product performance data
        const productPerformance = productData.reduce((acc, order) => {
            order.products.forEach(product => {
                if (!acc[product.productId]) {
                    acc[product.productId] = {
                        name: product.name,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        orderCount: 0,
                        averageQuantityPerOrder: 0,
                        averagePrice: 0
                    };
                }
                acc[product.productId].totalQuantity += product.quantity;
                acc[product.productId].totalRevenue += product.quantity * product.price;
                acc[product.productId].orderCount++;
                acc[product.productId].averageQuantityPerOrder = 
                    acc[product.productId].totalQuantity / acc[product.productId].orderCount;
                acc[product.productId].averagePrice = 
                    acc[product.productId].totalRevenue / acc[product.productId].totalQuantity;
            });
            return acc;
        }, {} as Record<string, {
            name: string;
            totalQuantity: number;
            totalRevenue: number;
            orderCount: number;
            averageQuantityPerOrder: number;
            averagePrice: number;
        }>);

        console.log('Product Performance:', productPerformance);

        // Example 3: Customer Segmentation
        console.log('\n--- Example 3: Customer Segmentation ---');
        const { data: customerData } = await queryBuilder.graph<OrderDocument>({
            entity: 'Order',
            filters: {
                status: 'completed',
                createdAt_gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
            }
        });

        // Process customer segmentation data
        type CustomerSegmentData = {
            totalSpent: number;
            orderCount: number;
            averageOrderValue: number;
            lastOrderDate: Date;
            frequency: number; // days between orders
        };

        const customerSegmentation = customerData.reduce((acc, order) => {
            if (!acc[order.customerId]) {
                acc[order.customerId] = {
                    totalSpent: 0,
                    orderCount: 0,
                    averageOrderValue: 0,
                    lastOrderDate: order.createdAt,
                    frequency: 0
                };
            }

            const customer = acc[order.customerId];
            customer.totalSpent += order.totalAmount;
            customer.orderCount++;
            customer.averageOrderValue = customer.totalSpent / customer.orderCount;
            
            if (order.createdAt > customer.lastOrderDate) {
                customer.lastOrderDate = order.createdAt;
            }

            // Calculate average days between orders
            if (customer.orderCount > 1) {
                const daysSinceFirst = Math.ceil(
                    (customer.lastOrderDate.getTime() - customerData[0].createdAt.getTime()) 
                    / (1000 * 60 * 60 * 24)
                );
                customer.frequency = daysSinceFirst / (customer.orderCount - 1);
            }

            return acc;
        }, {} as Record<string, CustomerSegmentData>);

        // Segment customers based on RFM (Recency, Frequency, Monetary)
        const segments = Object.entries(customerSegmentation).reduce((acc, [customerId, data]) => {
            const recency = Date.now() - data.lastOrderDate.getTime();
            const segment = 
                data.totalSpent > 1000 && data.frequency < 30 ? 'vip' :
                data.totalSpent > 500 && data.frequency < 45 ? 'loyal' :
                data.totalSpent > 200 ? 'regular' :
                recency > 60 * 24 * 60 * 60 * 1000 ? 'inactive' : 'new';

            acc[segment] = acc[segment] || [];
            acc[segment].push({ customerId, ...data });
            return acc;
        }, {} as Record<string, Array<{ customerId: string } & CustomerSegmentData>>);

        console.log('Customer Segments:', segments);

        // Example 4: Advanced Order Analytics
        console.log('\n--- Example 4: Advanced Order Analytics ---');
        const { data: analyticsData } = await queryBuilder.graph<OrderDocument>({
            entity: 'Order',
            filters: {
                createdAt_gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            },
            sort: [
                { field: 'totalAmount', order: 'desc' }
            ]
        });

        const orderAnalytics = {
            totalOrders: analyticsData.length,
            totalRevenue: analyticsData.reduce((sum, order) => sum + order.totalAmount, 0),
            averageOrderValue: analyticsData.reduce((sum, order) => sum + order.totalAmount, 0) / analyticsData.length,
            ordersByStatus: analyticsData.reduce((acc, order) => {
                acc[order.status] = (acc[order.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
            topProducts: analyticsData.reduce((acc, order) => {
                order.products.forEach(product => {
                    if (!acc[product.productId]) {
                        acc[product.productId] = {
                            name: product.name,
                            totalQuantity: 0,
                            totalRevenue: 0
                        };
                    }
                    acc[product.productId].totalQuantity += product.quantity;
                    acc[product.productId].totalRevenue += product.quantity * product.price;
                });
                return acc;
            }, {} as Record<string, { name: string; totalQuantity: number; totalRevenue: number }>)
        };

        console.log('Order Analytics:', orderAnalytics);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB connection closed');
    }
}

// Run the demonstration
demonstrateAggregateQueries().catch(console.error);