#!/usr/bin/env node

/**
 * Biznex2 Demo Data Generator
 * 
 * Populates the database with sample products, stores, and orders
 * for demonstration purposes
 * 
 * Usage:
 *   node scripts/generate-demo-data.js
 */

require('dotenv').config();
const db = require('../server/db');
const bcrypt = require('bcryptjs');

// Sample data
const SAMPLE_PRODUCTS = [
    { name: 'Smartphone Pro', sku: 'SP-001', price: 999.99, costPrice: 500, stock: 15, category: 'Electronics' },
    { name: 'Laptop 15"', sku: 'LP-001', price: 1299.99, costPrice: 700, stock: 8, category: 'Electronics' },
    { name: 'USB-C Cable', sku: 'AC-001', price: 19.99, costPrice: 5, stock: 50, category: 'Accessories' },
    { name: 'Wireless Mouse', sku: 'MS-001', price: 29.99, costPrice: 10, stock: 30, category: 'Accessories' },
    { name: 'Mechanical Keyboard', sku: 'KB-001', price: 79.99, costPrice: 40, stock: 20, category: 'Accessories' },
    { name: '4K Monitor', sku: 'MN-001', price: 399.99, costPrice: 200, stock: 5, category: 'Electronics' },
    { name: 'Laptop Stand', sku: 'ST-001', price: 49.99, costPrice: 20, stock: 25, category: 'Accessories' },
    { name: 'Phone Case', sku: 'CA-001', price: 24.99, costPrice: 8, stock: 60, category: 'Accessories' },
    { name: 'Screen Protector', sku: 'SP-002', price: 9.99, costPrice: 2, stock: 100, category: 'Accessories' },
    { name: 'Portable Charger', sku: 'CH-001', price: 39.99, costPrice: 15, stock: 35, category: 'Electronics' }
];

const SAMPLE_STORES = [
    { name: 'Downtown Store', location: 'Main Street', phone: '555-0100', email: 'downtown@biznex.local' },
    { name: 'Mall Location', location: 'Shopping Center', phone: '555-0101', email: 'mall@biznex.local' },
    { name: 'Airport Hub', location: 'Terminal 2', phone: '555-0102', email: 'airport@biznex.local' }
];

const SAMPLE_ORDERS = [
    { customerName: 'Alice Johnson', items: [1, 2, 5], quantities: [1, 1, 2], payment: 'card' },
    { customerName: 'Bob Smith', items: [3, 4], quantities: [2, 1], payment: 'cash' },
    { customerName: 'Carol Davis', items: [1, 6], quantities: [1, 1], payment: 'card' },
    { customerName: 'David Wilson', items: [7, 8, 9], quantities: [1, 3, 5], payment: 'cash' },
    { customerName: 'Eve Martinez', items: [2, 10], quantities: [1, 1], payment: 'card' }
];

// Helper function to wait for db
function waitForDb() {
    return new Promise((resolve) => {
        if (db._isReady) {
            resolve();
        } else {
            db.once('ready', resolve);
        }
        // Safety timeout
        setTimeout(resolve, 2000);
    });
}

async function generateDemoData() {
    console.log('🚀 Generating Biznex2 Demo Data...\n');

    try {
        await waitForDb();

        // 1. Add sample products
        console.log('📦 Adding sample products...');
        for (const product of SAMPLE_PRODUCTS) {
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO products (store_id, name, sku, price, cost_price, stock, category)
                    VALUES (1, ?, ?, ?, ?, ?, ?)
                `, [1, product.name, product.sku, product.price, product.costPrice, product.stock, product.category],
                    (err) => {
                        if (err) {
                            console.warn(`  ⚠️  Could not add "${product.name}": ${err.message}`);
                        } else {
                            console.log(`  ✅ Added: ${product.name}`);
                        }
                        resolve();
                    }
                );
            });
        }

        // 2. Add sample stores
        console.log('\n🏪 Adding sample stores...');
        for (const store of SAMPLE_STORES) {
            await new Promise((resolve) => {
                db.run(`
                    INSERT INTO stores (name, location, phone, email, is_active)
                    VALUES (?, ?, ?, ?, 1)
                `, [store.name, store.location, store.phone, store.email],
                    (err) => {
                        if (err) {
                            console.warn(`  ⚠️  Could not add "${store.name}": ${err.message}`);
                        } else {
                            console.log(`  ✅ Added: ${store.name}`);
                        }
                        resolve();
                    }
                );
            });
        }

        // 3. Add sample orders
        console.log('\n📋 Adding sample orders...');
        for (const order of SAMPLE_ORDERS) {
            const orderNo = `ORD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
            let total = 0;

            // Calculate total
            for (let i = 0; i < order.items.length; i++) {
                const productId = order.items[i];
                const quantity = order.quantities[i];
                const product = SAMPLE_PRODUCTS[productId - 1];
                total += product.price * quantity;
            }

            await new Promise((resolve) => {
                db.run(`
                    INSERT INTO orders (store_id, order_no, customer_name, payment_method, total, status)
                    VALUES (1, ?, ?, ?, ?, 'completed')
                `, [orderNo, order.customerName, order.payment, total.toFixed(2)],
                    function(err) {
                        if (err) {
                            console.warn(`  ⚠️  Could not add order for "${order.customerName}"`);
                            resolve();
                        } else {
                            const orderId = this.lastID;

                            // Add order items
                            let itemsAdded = 0;
                            for (let i = 0; i < order.items.length; i++) {
                                const productId = order.items[i];
                                const quantity = order.quantities[i];
                                const product = SAMPLE_PRODUCTS[productId - 1];
                                const subtotal = (product.price * quantity).toFixed(2);

                                db.run(`
                                    INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
                                    VALUES (?, ?, ?, ?, ?)
                                `, [orderId, productId, quantity, product.price.toFixed(2), subtotal],
                                    (err) => {
                                        itemsAdded++;
                                        if (itemsAdded === order.items.length) {
                                            console.log(`  ✅ Added order ${orderNo} - ${order.customerName} ($${total.toFixed(2)})`);
                                            resolve();
                                        }
                                    }
                                );
                            }
                        }
                    }
                );
            });
        }

        console.log('\n✅ Demo data generation complete!\n');
        console.log('📊 Summary:');
        console.log(`   - ${SAMPLE_PRODUCTS.length} products added`);
        console.log(`   - ${SAMPLE_STORES.length} stores added`);
        console.log(`   - ${SAMPLE_ORDERS.length} sample orders created`);
        console.log('\n🎯 You can now:');
        console.log('   1. Login with your admin credentials');
        console.log('   2. Go to the POS section to make a test sale');
        console.log('   3. View the Dashboard for sales stats');
        console.log('   4. Check Order History for all transactions');
        console.log('   5. Manage Products from the Products section');
        console.log('\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error generating demo data:', error);
        process.exit(1);
    }
}

// Run the generator
generateDemoData();
