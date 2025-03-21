const mongoose = require('mongoose');
const { QueryBuilder } = require('../lib');

// Example Order model
const orderSchema = new mongoose.Schema({
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

const Order = mongoose.model('Order', orderSchema);

async function demonstrateAggregateQueries() {
    try {
        await mongoose.connect('mongodb://localhost:27017/test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const query = new QueryBuilder();

        // Example 1: Sales Analytics by Date Range
        console.log('\n--- Example 1: Sales Analytics by Date Range ---');
        const salesAnalytics = await query.graph({
            entity: 'Order',
            filters: {
                createdAt_gte: new Date('2024-01-01'),
                createdAt_lte: new Date('2024-12-31'),
                status: 'completed'
            }
        });

        // Process sales data
        const monthlySales = salesAnalytics.data.reduce((acc, order) => {
            const month = order.createdAt.getMonth();
            acc[month] = acc[month] || { total: 0, count: 0 };
            acc[month].total += order.totalAmount;
            acc[month].count++;
            return acc;
        }, {});

        console.log('Monthly Sales Analysis:', monthlySales);

        // Example 2: Product Performance Analysis
        console.log('\n--- Example 2: Product Performance Analysis ---');
        const productAnalytics = await query.graph({
            entity: 'Order',
            filters: {
                status: 'completed'
            }
        });

        // Process product data
        const productPerformance = productAnalytics.data.reduce((acc, order) => {
            order.products.forEach(product => {
                if (!acc[product.productId]) {
                    acc[product.productId] = {
                        name: product.name,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        orderCount: 0
                    };
                }
                acc[product.productId].totalQuantity += product.quantity;
                acc[product.productId].totalRevenue += product.quantity * product.price;
                acc[product.productId].orderCount++;
            });
            return acc;
        }, {});

        console.log('Product Performance:', productPerformance);

        // Example 3: Customer Segmentation
        console.log('\n--- Example 3: Customer Segmentation ---');
        const customerAnalytics = await query.graph({
            entity: 'Order',
            filters: {
                status: 'completed'
            }
        });

        // Process customer data
        const customerSegmentation = customerAnalytics.data.reduce((acc, order) => {
            if (!acc[order.customerId]) {
                acc[order.customerId] = {
                    totalSpent: 0,
                    orderCount: 0,
                    averageOrderValue: 0
                };
            }
            acc[order.customerId].totalSpent += order.totalAmount;
            acc[order.customerId].orderCount++;
            acc[order.customerId].averageOrderValue = 
                acc[order.customerId].totalSpent / acc[order.customerId].orderCount;
            return acc;
        }, {});

        // Categorize customers
        const segmentedCustomers = Object.entries(customerSegmentation).reduce((acc, [customerId, data]) => {
            let segment;
            if (data.totalSpent > 1000) {
                segment = 'premium';
            } else if (data.totalSpent > 500) {
                segment = 'regular';
            } else {
                segment = 'basic';
            }
            
            acc[segment] = acc[segment] || [];
            acc[segment].push({ customerId, ...data });
            return acc;
        }, {});

        console.log('Customer Segmentation:', segmentedCustomers);

        // Example 4: Order Status Distribution
        console.log('\n--- Example 4: Order Status Distribution ---');
        const statusAnalytics = await query.graph({
            entity: 'Order'
        });

        const statusDistribution = statusAnalytics.data.reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
        }, {});

        console.log('Order Status Distribution:', statusDistribution);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Run the demonstration
demonstrateAggregateQueries().catch(console.error);