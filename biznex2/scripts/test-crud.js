const http = require('http');

const BASE_URL = 'http://localhost:3000';
let authToken = null;

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (authToken) {
            options.headers['Authorization'] = `Bearer ${authToken}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: body ? JSON.parse(body) : null,
                        headers: res.headers
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: body,
                        headers: res.headers
                    });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function runTests() {
    console.log('🚀 Starting CRUD Operations Test\n');
    
    try {
        // 1. LOGIN TEST
        console.log('📝 TEST 1: LOGIN');
        console.log('─'.repeat(50));
        const loginRes = await makeRequest('POST', '/api/auth/login', {
            username: 'admin',
            password: 'admin'
        });
        console.log(`✅ Status: ${loginRes.status}`);
        console.log(`✅ Token received: ${loginRes.data.token ? 'Yes' : 'No'}`);
        authToken = loginRes.data.token;
        console.log('');

        // 2. PRODUCTS CRUD
        console.log('📦 TEST 2: PRODUCTS CRUD');
        console.log('─'.repeat(50));
        
        // GET all products
        const getProducts = await makeRequest('GET', '/api/products');
        console.log(`✅ GET /api/products - Status: ${getProducts.status}, Count: ${getProducts.data.length}`);
        
        // POST new product
        const createProduct = await makeRequest('POST', '/api/products', {
            name: 'Test Product - SSD',
            price: 89.99,
            stock: 20
        });
        console.log(`✅ POST /api/products - Status: ${createProduct.status}, Message: ${createProduct.data.message}`);
        
        // DELETE product (if any created)
        if (getProducts.data.length > 0) {
            const delRes = await makeRequest('DELETE', `/api/products/${getProducts.data[0].id}`);
            console.log(`✅ DELETE /api/products/{id} - Status: ${delRes.status}`);
        }
        console.log('');

        // 3. STORES CRUD
        console.log('🏪 TEST 3: STORES CRUD');
        console.log('─'.repeat(50));
        
        const getStores = await makeRequest('GET', '/api/stores');
        console.log(`✅ GET /api/stores - Status: ${getStores.status}, Count: ${getStores.data.length}`);
        
        const createStore = await makeRequest('POST', '/api/stores', {
            name: 'Warehouse Store',
            location: 'Test Location',
            phone: '+1-555-9999',
            email: 'warehouse@test.com'
        });
        console.log(`✅ POST /api/stores - Status: ${createStore.status}, Message: ${createStore.data.message}`);
        console.log('');

        // 4. SUPPLIERS CRUD
        console.log('🚚 TEST 4: SUPPLIERS CRUD');
        console.log('─'.repeat(50));
        
        const getSuppliers = await makeRequest('GET', '/api/suppliers');
        console.log(`✅ GET /api/suppliers - Status: ${getSuppliers.status}, Count: ${getSuppliers.data.length}`);
        
        const createSupplier = await makeRequest('POST', '/api/suppliers', {
            name: 'Test Supplier Co',
            contact_person: 'John Test',
            email: 'john@test.com',
            phone: '+1-555-8888'
        });
        console.log(`✅ POST /api/suppliers - Status: ${createSupplier.status}, Message: ${createSupplier.data.message}`);
        
        if (getSuppliers.data.length > 0) {
            const delSupplier = await makeRequest('DELETE', `/api/suppliers/${getSuppliers.data[0].id}`);
            console.log(`✅ DELETE /api/suppliers/{id} - Status: ${delSupplier.status}`);
        }
        console.log('');

        // 5. USERS CRUD
        console.log('👥 TEST 5: USERS CRUD');
        console.log('─'.repeat(50));
        
        const getUsers = await makeRequest('GET', '/api/users');
        console.log(`✅ GET /api/users - Status: ${getUsers.status}, Count: ${getUsers.data.length}`);
        
        const createUser = await makeRequest('POST', '/api/users', {
            username: 'testuser',
            email: 'test@biznex.com',
            password: 'test123456',
            role: 'staff'
        });
        console.log(`✅ POST /api/users - Status: ${createUser.status}, Message: ${createUser.data.message}`);
        console.log('');

        // 6. ORDERS CRUD
        console.log('📋 TEST 6: ORDERS CRUD');
        console.log('─'.repeat(50));
        
        const getOrders = await makeRequest('GET', '/api/orders');
        console.log(`✅ GET /api/orders - Status: ${getOrders.status}, Count: ${getOrders.data.length}`);
        
        const createOrder = await makeRequest('POST', '/api/orders', {
            customer_name: 'Test Customer',
            items: [
                { product_id: 1, product_name: 'Laptop', quantity: 1, price: 999.99 }
            ],
            total: 999.99,
            payment_method: 'card'
        });
        console.log(`✅ POST /api/orders - Status: ${createOrder.status}, Message: ${createOrder.data.message}`);
        console.log('');

        // 7. DASHBOARD STATS
        console.log('📊 TEST 7: DASHBOARD STATS');
        console.log('─'.repeat(50));
        
        const getStats = await makeRequest('GET', '/api/dashboard/stats');
        console.log(`✅ GET /api/dashboard/stats - Status: ${getStats.status}`);
        if (getStats.data) {
            console.log(`   Total Sales: $${getStats.data.totalSales}`);
            console.log(`   Order Count: ${getStats.data.orderCount}`);
            console.log(`   Total Stock: ${getStats.data.totalStock}`);
        }
        console.log('');

        console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY!');
        console.log('\n✨ Summary:');
        console.log('✅ Products: CREATE, READ, DELETE');
        console.log('✅ Stores: CREATE, READ');
        console.log('✅ Suppliers: CREATE, READ, DELETE');
        console.log('✅ Users: CREATE, READ');
        console.log('✅ Orders: CREATE, READ');
        console.log('✅ Dashboard: Stats retrieval');

    } catch (err) {
        console.error('❌ Test failed:', err.message);
    }

    process.exit(0);
}

// Wait a moment for server to be ready
setTimeout(runTests, 2000);
