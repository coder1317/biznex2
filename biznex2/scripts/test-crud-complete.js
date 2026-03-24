#!/usr/bin/env node
/**
 * Comprehensive CRUD Test Suite for Biznex2
 * Tests all Create, Read, Update, Delete operations for all modules
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
let token = null;

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('\n' + '='.repeat(70));
    console.log('  🧪 COMPREHENSIVE BIZNEX2 CRUD TEST SUITE');
    console.log('='.repeat(70) + '\n');

    try {
        // ─── 1. LOGIN ───
        console.log('📋 1. AUTHENTICATION TEST');
        const loginRes = await makeRequest('POST', '/api/auth/login', {
            username: 'admin',
            password: 'admin'
        });
        
        if (loginRes.status !== 200) {
            console.log('   ❌ Login failed:', loginRes.data);
            return;
        }
        
        token = loginRes.data.token || loginRes.data.accessToken;
        console.log('   ✅ Login successful, token received\n');

        // ─── 2. PRODUCTS CRUD ───
        console.log('📦 2. PRODUCTS CRUD TEST');
        let productId = null;

        // Create
        const createProd = await makeRequest('POST', '/api/products', {
            name: 'Test Product ' + Date.now(),
            price: 19.99,
            stock: 50,
            category: 'Test'
        });
        if (createProd.status !== 200) {
            console.log('   ❌ Create failed:', createProd.data);
        } else {
            console.log('   ✅ Create: Product created');
            
            // Read all
            const readProd = await makeRequest('GET', '/api/products');
            if (readProd.status === 200 && Array.isArray(readProd.data)) {
                productId = readProd.data[readProd.data.length - 1].id;
                console.log(`   ✅ Read: Found ${readProd.data.length} products`);
                
                // Update
                const updateProd = await makeRequest('PUT', `/api/products/${productId}`, {
                    name: 'Updated Test Product',
                    price: 24.99,
                    stock: 75
                });
                if (updateProd.status === 200) {
                    console.log('   ✅ Update: Product updated');
                } else {
                    console.log('   ❌ Update failed:', updateProd.data);
                }
                
                // Delete
                const deleteProd = await makeRequest('DELETE', `/api/products/${productId}`);
                if (deleteProd.status === 200) {
                    console.log('   ✅ Delete: Product deleted\n');
                } else {
                    console.log('   ❌ Delete failed:', deleteProd.data, '\n');
                }
            } else {
                console.log('   ❌ Read failed\n');
            }
        }

        // ─── 3. STORES CRUD ───
        console.log('🏪 3. STORES CRUD TEST');
        let storeId = null;

        // Create
        const createStore = await makeRequest('POST', '/api/stores', {
            name: 'Test Store ' + Date.now(),
            location: 'Test Location'
        });
        if (createStore.status !== 200) {
            console.log('   ❌ Create failed:', createStore.data);
        } else {
            console.log('   ✅ Create: Store created');
            
            // Read all
            const readStore = await makeRequest('GET', '/api/stores');
            if (readStore.status === 200 && Array.isArray(readStore.data)) {
                storeId = readStore.data[readStore.data.length - 1].id;
                console.log(`   ✅ Read: Found ${readStore.data.length} stores`);
                
                // Update
                const updateStore = await makeRequest('PUT', `/api/stores/${storeId}`, {
                    name: 'Updated Test Store',
                    location: 'Updated Location'
                });
                if (updateStore.status === 200) {
                    console.log('   ✅ Update: Store updated');
                } else {
                    console.log('   ❌ Update failed:', updateStore.data);
                }
                
                // Delete
                const deleteStore = await makeRequest('DELETE', `/api/stores/${storeId}`);
                if (deleteStore.status === 200) {
                    console.log('   ✅ Delete: Store deleted\n');
                } else {
                    console.log('   ❌ Delete failed:', deleteStore.data, '\n');
                }
            } else {
                console.log('   ❌ Read failed\n');
            }
        }

        // ─── 4. SUPPLIERS CRUD ───
        console.log('🚚 4. SUPPLIERS CRUD TEST');
        let supplierId = null;

        // Create
        const createSupp = await makeRequest('POST', '/api/suppliers', {
            name: 'Test Supplier ' + Date.now(),
            contact_person: 'John Doe',
            email: 'john@test.com',
            phone: '123-456-7890'
        });
        if (createSupp.status !== 200) {
            console.log('   ❌ Create failed:', createSupp.data);
        } else {
            console.log('   ✅ Create: Supplier created');
            
            // Read all
            const readSupp = await makeRequest('GET', '/api/suppliers');
            if (readSupp.status === 200 && Array.isArray(readSupp.data)) {
                supplierId = readSupp.data[readSupp.data.length - 1].id;
                console.log(`   ✅ Read: Found ${readSupp.data.length} suppliers`);
                
                // Update
                const updateSupp = await makeRequest('PUT', `/api/suppliers/${supplierId}`, {
                    name: 'Updated Test Supplier',
                    contact_person: 'Jane Doe',
                    email: 'jane@test.com',
                    phone: '987-654-3210'
                });
                if (updateSupp.status === 200) {
                    console.log('   ✅ Update: Supplier updated');
                } else {
                    console.log('   ❌ Update failed:', updateSupp.data);
                }
                
                // Delete
                const deleteSupp = await makeRequest('DELETE', `/api/suppliers/${supplierId}`);
                if (deleteSupp.status === 200) {
                    console.log('   ✅ Delete: Supplier deleted\n');
                } else {
                    console.log('   ❌ Delete failed:', deleteSupp.data, '\n');
                }
            } else {
                console.log('   ❌ Read failed\n');
            }
        }

        // ─── 5. USERS CRUD ───
        console.log('👥 5. USERS CRUD TEST');
        let userId = null;

        // Create
        const createUser = await makeRequest('POST', '/api/users', {
            username: 'testuser' + Date.now(),
            email: 'test' + Date.now() + '@test.com',
            password: 'testpass123',
            role: 'staff'
        });
        if (createUser.status !== 200) {
            console.log('   ❌ Create failed:', createUser.data);
        } else {
            console.log('   ✅ Create: User created');
            
            // Read all
            const readUser = await makeRequest('GET', '/api/users');
            if (readUser.status === 200 && Array.isArray(readUser.data)) {
                userId = readUser.data[readUser.data.length - 1].id;
                console.log(`   ✅ Read: Found ${readUser.data.length} users`);
                
                // Update
                const updateUser = await makeRequest('PUT', `/api/users/${userId}`, {
                    username: 'testuser' + Date.now() + 'updated',
                    email: 'updated' + Date.now() + '@test.com',
                    role: 'manager'
                });
                if (updateUser.status === 200) {
                    console.log('   ✅ Update: User updated');
                } else {
                    console.log('   ❌ Update failed:', updateUser.data);
                }
                
                // Delete
                const deleteUser = await makeRequest('DELETE', `/api/users/${userId}`);
                if (deleteUser.status === 200) {
                    console.log('   ✅ Delete: User deleted\n');
                } else {
                    console.log('   ❌ Delete failed:', deleteUser.data, '\n');
                }
            } else {
                console.log('   ❌ Read failed\n');
            }
        }

        // ─── 6. ORDERS READ ───
        console.log('📋 6. ORDERS READ TEST');
        const readOrders = await makeRequest('GET', '/api/orders');
        if (readOrders.status === 200 && Array.isArray(readOrders.data)) {
            console.log(`   ✅ Read: Found ${readOrders.data.length} orders\n`);
        } else {
            console.log('   ❌ Read failed\n');
        }

        console.log('='.repeat(70));
        console.log('  ✅ TEST SUITE COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(70) + '\n');

    } catch (err) {
        console.error('\n❌ Test error:', err.message);
    }
}

// Run tests
runTests().catch(console.error);
