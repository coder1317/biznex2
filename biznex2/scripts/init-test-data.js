const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../server/biznex2.json');

const testData = {
    system_settings: [],
    stores: [
        {
            id: 1,
            name: "Main Store",
            location: "Headquarters",
            phone: "+1-555-0001",
            email: "main@biznex.com",
            address: "123 Business Ave, City, State 12345",
            is_active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 2,
            name: "Downtown Branch",
            location: "Downtown",
            phone: "+1-555-0002",
            email: "downtown@biznex.com",
            address: "456 Commerce St, City, State 12345",
            is_active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 3,
            name: "Mall Store",
            location: "Shopping Mall",
            phone: "+1-555-0003",
            email: "mall@biznex.com",
            address: "789 Shopping Center, City, State 12345",
            is_active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ],
    products: [
        {
            id: 1,
            name: "Laptop",
            price: 999.99,
            stock: 15,
            store_id: 1,
            category: "Electronics",
            sku: "LAP-001",
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            name: "Wireless Mouse",
            price: 29.99,
            stock: 50,
            store_id: 1,
            category: "Accessories",
            sku: "MOU-001",
            created_at: new Date().toISOString()
        },
        {
            id: 3,
            name: "Mechanical Keyboard",
            price: 149.99,
            stock: 30,
            store_id: 1,
            category: "Accessories",
            sku: "KEY-001",
            created_at: new Date().toISOString()
        },
        {
            id: 4,
            name: "USB-C Cable",
            price: 14.99,
            stock: 100,
            store_id: 1,
            category: "Cables",
            sku: "USB-001",
            created_at: new Date().toISOString()
        },
        {
            id: 5,
            name: "Monitor 27 inch",
            price: 299.99,
            stock: 12,
            store_id: 1,
            category: "Electronics",
            sku: "MON-001",
            created_at: new Date().toISOString()
        },
        {
            id: 6,
            name: "Desk Lamp",
            price: 49.99,
            stock: 25,
            store_id: 2,
            category: "Furniture",
            sku: "LAM-001",
            created_at: new Date().toISOString()
        },
        {
            id: 7,
            name: "Office Chair",
            price: 199.99,
            stock: 8,
            store_id: 2,
            category: "Furniture",
            sku: "CHR-001",
            created_at: new Date().toISOString()
        },
        {
            id: 8,
            name: "Headphones",
            price: 79.99,
            stock: 40,
            store_id: 3,
            category: "Audio",
            sku: "HEAD-001",
            created_at: new Date().toISOString()
        }
    ],
    orders: [
        {
            id: 1,
            customer_name: "John Doe",
            store_id: 1,
            total: 1079.98,
            payment_method: "card",
            items: [
                { product_id: 1, product_name: "Laptop", quantity: 1, price: 999.99 },
                { product_id: 2, product_name: "Wireless Mouse", quantity: 1, price: 29.99 }
            ],
            created_at: new Date(Date.now() - 2*24*60*60*1000).toISOString(),
            updated_at: new Date(Date.now() - 2*24*60*60*1000).toISOString()
        },
        {
            id: 2,
            customer_name: "Jane Smith",
            store_id: 1,
            total: 194.97,
            payment_method: "cash",
            items: [
                { product_id: 3, product_name: "Mechanical Keyboard", quantity: 1, price: 149.99 },
                { product_id: 4, product_name: "USB-C Cable", quantity: 3, price: 14.99 }
            ],
            created_at: new Date(Date.now() - 1*24*60*60*1000).toISOString(),
            updated_at: new Date(Date.now() - 1*24*60*60*1000).toISOString()
        },
        {
            id: 3,
            customer_name: "Bob Johnson",
            store_id: 2,
            total: 249.98,
            payment_method: "card",
            items: [
                { product_id: 6, product_name: "Desk Lamp", quantity: 2, price: 49.99 }
            ],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ],
    order_items: [
        { id: 1, order_id: 1, product_id: 1, quantity: 1, price: 999.99 },
        { id: 2, order_id: 1, product_id: 2, quantity: 1, price: 29.99 },
        { id: 3, order_id: 2, product_id: 3, quantity: 1, price: 149.99 },
        { id: 4, order_id: 2, product_id: 4, quantity: 3, price: 14.99 },
        { id: 5, order_id: 3, product_id: 6, quantity: 2, price: 49.99 }
    ],
    users: [
        {
            id: 1,
            username: "admin",
            email: "admin@biznex.com",
            password: bcrypt.hashSync("admin", 10),
            role: "admin",
            store_id: 1,
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            username: "manager",
            email: "manager@biznex.com",
            password: bcrypt.hashSync("manager123", 10),
            role: "manager",
            store_id: 2,
            created_at: new Date().toISOString()
        },
        {
            id: 3,
            username: "staff",
            email: "staff@biznex.com",
            password: bcrypt.hashSync("staff123", 10),
            role: "staff",
            store_id: 1,
            created_at: new Date().toISOString()
        }
    ],
    stock_movements: [],
    categories: [
        { id: 1, name: "Electronics", store_id: 1 },
        { id: 2, name: "Accessories", store_id: 1 },
        { id: 3, name: "Cables", store_id: 1 },
        { id: 4, name: "Furniture", store_id: 2 },
        { id: 5, name: "Audio", store_id: 3 }
    ],
    suppliers: [
        {
            id: 1,
            name: "Tech Supplies Inc",
            contact_person: "Michael Chen",
            email: "contact@techsupplies.com",
            phone: "+1-555-1001",
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            name: "Global Distributors",
            contact_person: "Sarah Wilson",
            email: "sales@globaldist.com",
            phone: "+1-555-1002",
            created_at: new Date().toISOString()
        },
        {
            id: 3,
            name: "Premium Electronics Ltd",
            contact_person: "David Kumar",
            email: "procurement@premium-elec.com",
            phone: "+1-555-1003",
            created_at: new Date().toISOString()
        }
    ]
};

fs.writeFileSync(dbPath, JSON.stringify(testData, null, 2));
console.log('✅ Test data initialized successfully!');
console.log(`📊 Database location: ${dbPath}`);
console.log('📦 Data included:');
console.log(`   - 3 stores`);
console.log(`   - 8 products`);
console.log(`   - 3 orders`);
console.log(`   - 3 users (admin, manager, staff)`);
console.log(`   - 3 suppliers`);
console.log('\n🔐 Test Login Credentials:');
console.log('   Username: admin, Password: admin');
console.log('   Username: manager, Password: manager123');
console.log('   Username: staff, Password: staff123');
