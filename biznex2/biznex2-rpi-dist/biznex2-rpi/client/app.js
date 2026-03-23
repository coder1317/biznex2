// ─── Global State ──────────────────────────────────────────────────────────
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
let currentStoreId = parseInt(localStorage.getItem('storeId')) || 1;
let products = [];
let cart = [];
let orders = [];

const API_BASE_URL = 'http://localhost:3000';

// ─── Toast Notifications ─────────────────────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ─── API Calls ──────────────────────────────────────────────────────────────
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API Error');
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast(error.message, 'error');
        throw error;
    }
}

// ─── Setup Wizard ──────────────────────────────────────────────────────────
async function checkSetup() {
    try {
        const result = await apiCall('/api/setup/check', 'POST');
        return result.setupComplete;
    } catch (error) {
        showToast('Error checking setup status', 'error');
        return false;
    }
}

function showSetupWizard() {
    document.getElementById('setupWizard').classList.remove('hidden');
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
}

function showLoginModal() {
    document.getElementById('setupWizard').classList.add('hidden');
    document.getElementById('loginModal').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

function showApp() {
    document.getElementById('setupWizard').classList.add('hidden');
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
}

// ─── Setup Form Handler ────────────────────────────────────────────────────
document.getElementById('setupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const storeName = document.getElementById('storeName').value;
    const username = document.getElementById('adminUsername').value;
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        document.getElementById('setupError').textContent = 'Passwords do not match';
        document.getElementById('setupError').style.display = 'block';
        return;
    }

    try {
        const result = await apiCall('/api/setup/initialize', 'POST', {
            storeName, username, email, password
        });

        authToken = result.token;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify({ username, role: 'admin' }));

        showToast('✓ Setup completed! Welcome to Biznex2', 'success');
        showApp();
        loadDashboard();
    } catch (error) {
        document.getElementById('setupError').textContent = error.message;
        document.getElementById('setupError').style.display = 'block';
    }
});

// ─── Login Handler ─────────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const result = await apiCall('/api/auth/login', 'POST', { username, password });

        authToken = result.token;
        currentUser = result.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        showToast('✓ Login successful', 'success');
        showApp();
        loadDashboard();
    } catch (error) {
        document.getElementById('loginError').textContent = error.message;
        document.getElementById('loginError').style.display = 'block';
    }
});

// ─── Logout Handlers ───────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
});

document.getElementById('logoutSettingsBtn').addEventListener('click', () => {
    logout();
});

function logout() {
    authToken = null;
    currentUser = {};
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showToast('Logged out successfully', 'success');
    showLoginModal();
}

// ─── Navigation ────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.getAttribute('data-section');

        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));

        item.classList.add('active');
        document.getElementById(`${section}Section`).classList.add('active');

        if (section === 'dashboard') loadDashboard();
        else if (section === 'pos') loadPOS();
        else if (section === 'products') loadProductsManagement();
        else if (section === 'orders') loadOrders();
        else if (section === 'stores') loadStores();
    });
});

// ─── Dashboard ──────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const stats = await apiCall('/api/dashboard/stats', 'GET');
        document.getElementById('totalSales').textContent = '$' + stats.totalSales.toFixed(2);
        document.getElementById('ordersCount').textContent = stats.orderCount;
        document.getElementById('totalStock').textContent = stats.totalStock;
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// ─── POS Section ───────────────────────────────────────────────────────────
async function loadPOS() {
    try {
        products = await apiCall('/api/products', 'GET');
        renderProducts();
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function renderProducts() {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <h4>${product.name}</h4>
            <p class="product-price">$${product.price.toFixed(2)}</p>
            <small>Stock: ${product.stock}</small>
        `;
        card.addEventListener('click', () => addToCart(product));
        container.appendChild(card);
    });
}

function addToCart(product) {
    if (product.stock <= 0) {
        showToast('Out of stock', 'warn');
        return;
    }

    const existingItem = cart.find(item => item.product_id === product.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            product_id: product.id,
            product_name: product.name,
            unit_price: product.price,
            quantity: 1,
            subtotal: product.price
        });
    }

    renderCart();
}

function renderCart() {
    const tbody = document.getElementById('cartBody');
    tbody.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        item.subtotal = item.unit_price * item.quantity;
        total += item.subtotal;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.product_name}</td>
            <td><input type="number" value="${item.quantity}" min="1" onchange="updateQty(${index}, this.value)"></td>
            <td>$${item.unit_price.toFixed(2)}</td>
            <td>$${item.subtotal.toFixed(2)}</td>
            <td><button class="remove-btn" onclick="removeFromCart(${index})">Remove</button></td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('cartTotal').textContent = '$' + total.toFixed(2);
}

function updateQty(index, value) {
    cart[index].quantity = parseInt(value) || 1;
    renderCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

document.getElementById('checkoutBtn').addEventListener('click', async () => {
    if (cart.length === 0) {
        showToast('Cart is empty', 'warn');
        return;
    }

    const customerName = document.getElementById('customerName').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

    try {
        const result = await apiCall('/api/orders', 'POST', {
            items: cart,
            customerName,
            paymentMethod,
            total
        });

        cart = [];
        document.getElementById('customerName').value = '';
        renderCart();
        showToast(`✓ Order ${result.orderNo} completed!`, 'success');
    } catch (error) {
        showToast('Order creation failed', 'error');
    }
});

// ─── Products Management ───────────────────────────────────────────────────
async function loadProductsManagement() {
    try {
        products = await apiCall('/api/products', 'GET');
        renderProductsTable();
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '';

    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${product.sku || '-'}</td>
            <td>$${product.price.toFixed(2)}</td>
            <td>${product.stock}</td>
            <td>${product.category || '-'}</td>
        `;
        tbody.appendChild(row);
    });
}

document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        name: document.getElementById('productName').value,
        sku: document.getElementById('productSku').value,
        price: parseFloat(document.getElementById('productPrice').value),
        costPrice: parseFloat(document.getElementById('productCost').value),
        stock: parseInt(document.getElementById('productStock').value),
        category: document.getElementById('productCategory').value
    };

    try {
        await apiCall('/api/products', 'POST', data);
        showToast('✓ Product added successfully', 'success');
        e.target.reset();
        loadProductsManagement();
    } catch (error) {
        showToast('Failed to add product', 'error');
    }
});

// ─── Orders ────────────────────────────────────────────────────────────────
async function loadOrders() {
    try {
        orders = await apiCall('/api/orders', 'GET');
        renderOrdersTable();
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = '';

    orders.forEach(order => {
        const row = document.createElement('tr');
        const date = new Date(order.created_at).toLocaleDateString();
        row.innerHTML = `
            <td>${order.order_no}</td>
            <td>${order.customer_name}</td>
            <td>${order.item_count || 0}</td>
            <td>$${order.total.toFixed(2)}</td>
            <td>${order.payment_method}</td>
            <td>${date}</td>
        `;
        tbody.appendChild(row);
    });
}

// ─── Stores (Multi-Store) ──────────────────────────────────────────────────
async function loadStores() {
    try {
        const stores = await apiCall('/api/stores', 'GET');
        renderStoresTable(stores);
    } catch (error) {
        console.error('Error loading stores:', error);
    }
}

function renderStoresTable(stores) {
    const tbody = document.getElementById('storesTableBody');
    tbody.innerHTML = '';

    stores.forEach(store => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${store.name}</td>
            <td>${store.location || '-'}</td>
            <td>${store.phone || '-'}</td>
            <td>${store.email || '-'}</td>
        `;
        tbody.appendChild(row);
    });
}

document.getElementById('addStoreForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        name: document.getElementById('storeName').value,
        location: document.getElementById('storeLocation').value,
        email: document.getElementById('storeEmail').value,
        phone: document.getElementById('storePhone').value,
        address: document.getElementById('storeAddress').value
    };

    try {
        await apiCall('/api/stores', 'POST', data);
        showToast('✓ Store added successfully', 'success');
        e.target.reset();
        loadStores();
    } catch (error) {
        showToast('Failed to add store', 'error');
    }
});

// ─── Initialize App ────────────────────────────────────────────────────────
async function initializeApp() {
    const setupComplete = await checkSetup();

    if (!setupComplete) {
        showSetupWizard();
    } else if (!authToken) {
        showLoginModal();
    } else {
        // Update user display
        document.getElementById('userDisplay').textContent = currentUser.username || 'User';
        showApp();
        loadDashboard();
    }
}

// Start on page load
window.addEventListener('DOMContentLoaded', initializeApp);
