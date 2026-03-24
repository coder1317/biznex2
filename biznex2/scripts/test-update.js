#!/usr/bin/env node
/**
 * UPDATE Operations Test for Biznex2
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
let token = null;

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path,
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
    console.log('  🧪 UPDATE OPERATIONS TEST');
    console.log('='.repeat(70) + '\n');

    try {
        // Login
        console.log('📋 1. LOGIN');
        const loginRes = await makeRequest('POST', '/api/auth/login', {
            username: 'admin',
            password: 'admin'
        });
        
        if (loginRes.status !== 200) {
            console.log('   ❌ Login failed');
            return;
        }
        
        token = loginRes.data.token || loginRes.data.accessToken;
        console.log('   ✅ Login successful\n');

        // Test Product Update
        console.log('📦 2. PRODUCT UPDATE');
        const getProd = await makeRequest('GET', '/api/products');
        if (getProd.data.length > 0) {
            const productId = getProd.data[0].id;
            const updateRes = await makeRequest('PUT', `/api/products/${productId}`, {
                name: 'Updated Product ' + Date.now(),
                price: 99.99,
                stock: 100
            });
            if (updateRes.status === 200) {
                console.log('   ✅ Product UPDATE: Success');
            } else {
                console.log('   ❌ Product UPDATE failed:', updateRes.status, updateRes.data);
            }
        }

        // Test Store Update
        console.log('🏪 3. STORE UPDATE');
        const getStore = await makeRequest('GET', '/api/stores');
        if (getStore.data.length > 0) {
            const storeId = getStore.data[0].id;
            const updateRes = await makeRequest('PUT', `/api/stores/${storeId}`, {
                name: 'Updated Store ' + Date.now(),
                location: 'New Location'
            });
            if (updateRes.status === 200) {
                console.log('   ✅ Store UPDATE: Success');
            } else {
                console.log('   ❌ Store UPDATE failed:', updateRes.status, updateRes.data);
            }
        }

        // Test Supplier Update
        console.log('🚚 4. SUPPLIER UPDATE');
        const getSupp = await makeRequest('GET', '/api/suppliers');
        if (getSupp.data.length > 0) {
            const supplierId = getSupp.data[0].id;
            const updateRes = await makeRequest('PUT', `/api/suppliers/${supplierId}`, {
                name: 'Updated Supplier ' + Date.now(),
                contact_person: 'New Contact',
                email: 'new@email.com',
                phone: '555-1234'
            });
            if (updateRes.status === 200) {
                console.log('   ✅ Supplier UPDATE: Success');
            } else {
                console.log('   ❌ Supplier UPDATE failed:', updateRes.status, updateRes.data);
            }
        }

        // Test User Update
        console.log('👥 5. USER UPDATE');
        const getUser = await makeRequest('GET', '/api/users');
        if (getUser.data.length > 1) {  // Skip admin user
            const userId = getUser.data[1].id;
            const updateRes = await makeRequest('PUT', `/api/users/${userId}`, {
                username: 'updated' + Date.now(),
                email: 'updated' + Date.now() + '@email.com',
                role: 'manager'
            });
            if (updateRes.status === 200) {
                console.log('   ✅ User UPDATE: Success');
            } else {
                console.log('   ❌ User UPDATE failed:', updateRes.status, updateRes.data);
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log('  ✅ UPDATE TESTS COMPLETED!');
        console.log('='.repeat(70) + '\n');

    } catch (err) {
        console.error('\n❌ Test error:', err.message);
    }
}

runTests().catch(console.error);
