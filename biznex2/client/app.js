const BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || "http://localhost:3000";
const _origFetch = window.fetch.bind(window);
window.fetch = (url, opts) => {
    if (typeof url === "string" && url.startsWith("http://localhost:3000")) {
        url = BASE_URL + url.slice("http://localhost:3000".length);
    }
    return _origFetch(url, opts);
};

let authToken = localStorage.getItem("authToken");
let currentUser = null;
let currentPage = "dashboard";
let currentStore = null;
let allProducts = [];
let allOrders = [];
let allUsers = [];
let allSuppliers = [];
let cart = [];

const pages = ["dashboard", "pos", "products", "orders", "stores", "suppliers", "users", "settings"];

// Initialize app
async function init() {
    if (!authToken) {
        document.getElementById("loginModal").style.display = "flex";
        document.getElementById("app").classList.add("hidden");
        setupLoginForm();
    } else {
        await loadAppData();
        setupApp();
    }
}

function setupLoginForm() {
    document.getElementById("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        
        try {
            const res = await fetch(`${BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            
            if (!res.ok) {
                document.getElementById("loginError").textContent = "Invalid credentials";
                document.getElementById("loginError").style.display = "block";
                return;
            }
            
            const data = await res.json();
            authToken = data.token || data.accessToken;
            localStorage.setItem("authToken", authToken);
            init();
        } catch (err) {
            console.error(err);
            document.getElementById("loginError").textContent = "Login failed";
            document.getElementById("loginError").style.display = "block";
        }
    });
}

async function loadAppData() {
    try {
        const res = await fetch(`${BASE_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error("Failed to load user");
        currentUser = await res.json();
        
        const productsRes = await fetch(`${BASE_URL}/api/products`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        if (productsRes.ok) allProducts = await productsRes.json();
        
        const ordersRes = await fetch(`${BASE_URL}/api/orders`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        if (ordersRes.ok) allOrders = await ordersRes.json();
    } catch (err) {
        console.error("Failed to load app data:", err);
    }
}

function setupApp() {
    document.getElementById("loginModal").style.display = "none";
    document.getElementById("app").classList.remove("hidden");
    
    // Setup navigation
    const navMenu = document.getElementById("navMenu");
    const navItems = [
        { id: "dashboard", label: "📊 Dashboard" },
        { id: "pos", label: "🛒 POS" },
        { id: "products", label: "📦 Products" },
        { id: "orders", label: "📋 Orders" },
        { id: "stores", label: "🏪 Stores" },
        { id: "suppliers", label: "🚚 Suppliers" },
        { id: "users", label: "👥 Users" },
        { id: "settings", label: "⚙️ Settings" }
    ];
    
    navMenu.innerHTML = navItems.map(item => 
        `<button class="nav-item ${item.id === 'dashboard' ? 'active' : ''}" data-page="${item.id}">${item.label}</button>`
    ).join("");
    
    navMenu.addEventListener("click", (e) => {
        if (e.target.classList.contains("nav-item")) {
            const page = e.target.dataset.page;
            showPage(page);
        }
    });
    
    // Setup logout
    document.getElementById("logoutBtn").onclick = logout;
    document.getElementById("logoutSettingsBtn") && (document.getElementById("logoutSettingsBtn").onclick = logout);
    
    // Setup forms
    document.getElementById("addProductForm").addEventListener("submit", addProduct);
    document.getElementById("addStoreForm").addEventListener("submit", addStore);
    document.getElementById("addSupplierForm").addEventListener("submit", addSupplier);
    document.getElementById("addUserForm").addEventListener("submit", addUser);
    
    // Update user display
    document.getElementById("userDisplay").textContent = currentUser?.username || "User";
    
    // Load initial data
    showPage("dashboard");
    loadDashboard();
    loadProducts();
    loadOrders();
    loadStores();
}

function showPage(page) {
    currentPage = page;
    pages.forEach(p => {
        const el = document.getElementById(p + "Page");
        if (el) el.classList.toggle("active", p === page);
    });
    
    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.page === page);
    });
    
    document.getElementById("pageTitle").textContent = {
        dashboard: "Dashboard",
        pos: "Point of Sale",
        products: "Manage Products",
        orders: "Order History",
        stores: "Manage Stores",
        suppliers: "Manage Suppliers",
        users: "Manage Users",
        settings: "Settings"
    }[page] || "Dashboard";
    
    if (page === "dashboard") loadDashboard();
    else if (page === "products") loadProducts();
    else if (page === "orders") loadOrders();
    else if (page === "stores") loadStores();
    else if (page === "suppliers") loadSuppliers();
    else if (page === "users") loadUsers();
}

async function loadDashboard() {
    const totalSales = allOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    document.getElementById("totalSales").textContent = "$" + totalSales.toFixed(2);
    document.getElementById("ordersCount").textContent = allOrders.length;
    document.getElementById("totalStock").textContent = allProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
}

async function loadProducts() {
    const container = document.getElementById("productsContainer");
    if (!container) return;
    
    container.innerHTML = allProducts.map(p => `
        <div class="stat-card" onclick="addToCart(${p.id})">
            <strong>${p.name}</strong>
            <p style="margin: 4px 0; color: var(--primary); font-weight: 700;">$${p.price}</p>
            <small style="color: #999;">Stock: ${p.stock}</small>
        </div>
    `).join("");
    
    const table = document.getElementById("productsTableBody");
    if (table) {
        table.innerHTML = allProducts.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>$${p.price}</td>
                <td>${p.stock}</td>
                <td><button class="btn btn-secondary" onclick="deleteProduct(${p.id})">Delete</button></td>
            </tr>
        `).join("");
    }
}

async function loadOrders() {
    const table = document.getElementById("ordersTableBody");
    if (!table) return;
    table.innerHTML = allOrders.map(o => `
        <tr>
            <td>#${o.id}</td>
            <td>${o.customer_name || "N/A"}</td>
            <td>$${o.total}</td>
            <td>${o.payment_method}</td>
            <td>${new Date(o.created_at).toLocaleDateString()}</td>
            <td>${new Date(o.created_at).toLocaleTimeString()}</td>
        </tr>
    `).join("");
}

async function loadStores() {
    const table = document.getElementById("storesTableBody");
    if (!table) return;
    try {
        const res = await fetch(`${BASE_URL}/api/stores`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
            const stores = await res.json();
            table.innerHTML = stores.map(s => `
                <tr>
                    <td>${s.name}</td>
                    <td>${s.location || "N/A"}</td>
                    <td><span class="status-badge active">Active</span></td>
                </tr>
            `).join("");
        }
    } catch (err) {
        console.error("Failed to load stores:", err);
    }
}

async function loadSuppliers() {
    const table = document.getElementById("suppliersTableBody");
    if (!table) return;
    try {
        const res = await fetch(`${BASE_URL}/api/suppliers`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
            allSuppliers = await res.json();
            table.innerHTML = allSuppliers.map(s => `
                <tr>
                    <td>${s.name}</td>
                    <td>${s.contact_person}</td>
                    <td>${s.email}</td>
                    <td>${s.phone}</td>
                    <td><button class="btn btn-secondary" onclick="deleteSupplier(${s.id})">Delete</button></td>
                </tr>
            `).join("");
        }
    } catch (err) {
        console.error("Failed to load suppliers:", err);
    }
}

async function loadUsers() {
    const table = document.getElementById("usersTableBody");
    if (!table) return;
    try {
        const res = await fetch(`${BASE_URL}/api/users`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) {
            allUsers = await res.json();
            table.innerHTML = allUsers.map(u => `
                <tr>
                    <td>${u.username}</td>
                    <td>${u.email}</td>
                    <td><span class="status-badge">${u.role || 'staff'}</span></td>
                    <td><span class="status-badge active">Active</span></td>
                    <td><button class="btn btn-secondary" onclick="deleteUser(${u.id})">Delete</button></td>
                </tr>
            `).join("");
        }
    } catch (err) {
        console.error("Failed to load users:", err);
    }
}

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    const existing = cart.find(c => c.product_id === productId);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ product_id: productId, product_name: product.name, price: product.price, quantity: 1 });
    }
    updateCart();
}

function removeFromCart(productId) {
    cart = cart.filter(c => c.product_id !== productId);
    updateCart();
}

function updateCart() {
    const items = document.getElementById("cartItems");
    const total = cart.reduce((sum, c) => sum + (c.price * c.quantity), 0);
    
    document.getElementById("cartTotal").textContent = "$" + total.toFixed(2);
    items.innerHTML = cart.map(c => `
        <tr style="padding: 8px 0; border-bottom: 1px solid #ddd;">
            <td style="padding: 6px 0;">${c.product_name}</td>
            <td style="text-align: right;">${c.quantity}x</td>
            <td style="text-align: right;">$${(c.price * c.quantity).toFixed(2)}</td>
            <td style="text-align: right;"><button class="btn btn-danger" style="padding: 2px 6px; font-size: 11px;" onclick="removeFromCart(${c.product_id})">✕</button></td>
        </tr>
    `).join("");
}

document.getElementById("checkoutBtn") && (document.getElementById("checkoutBtn").onclick = async () => {
    if (cart.length === 0) { showToast("Cart is empty", "warning"); return; }
    const total = cart.reduce((sum, c) => sum + (c.price * c.quantity), 0);
    try {
        const res = await fetch(`${BASE_URL}/api/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({
                customer_name: document.getElementById("customerName").value || "Walk-in",
                items: cart,
                total,
                payment_method: document.getElementById("paymentMethod").value
            })
        });
        if (res.ok) { showToast("Order completed!", "success"); cart = []; updateCart(); loadOrders(); }
    } catch (err) { showToast("Order failed: " + err.message, "danger"); }
});

document.getElementById("clearCartBtn") && (document.getElementById("clearCartBtn").onclick = () => { cart = []; updateCart(); });

async function addProduct(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById("productName").value,
        price: parseFloat(document.getElementById("productPrice").value),
        stock: parseInt(document.getElementById("productStock").value)
    };
    try {
        const res = await fetch(`${BASE_URL}/api/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
            body: JSON.stringify(data)
        });
        if (res.ok) { showToast("Product added!", "success"); loadProducts(); e.target.reset(); }
    } catch (err) { showToast("Failed: " + err.message, "danger"); }
}

async function deleteProduct(id) {
    if (!confirm("Delete this product?")) return;
    try {
        const res = await fetch(`${BASE_URL}/api/products/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) { showToast("Product deleted", "success"); loadProducts(); }
    } catch (err) { showToast("Failed: " + err.message, "danger"); }
}

async function addStore(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById("storeName").value,
        location: document.getElementById("storeLocation").value
    };
    try {
        const res = await fetch(`${BASE_URL}/api/stores`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
            body: JSON.stringify(data)
        });
        if (res.ok) { showToast("Store added!", "success"); loadStores(); e.target.reset(); }
    } catch (err) { showToast("Failed: " + err.message, "danger"); }
}

async function addSupplier(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById("supplierName").value,
        contact_person: document.getElementById("supplierContact").value,
        email: document.getElementById("supplierEmail").value,
        phone: document.getElementById("supplierPhone").value
    };
    try {
        const res = await fetch(`${BASE_URL}/api/suppliers`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
            body: JSON.stringify(data)
        });
        if (res.ok) { showToast("Supplier added!", "success"); loadSuppliers(); e.target.reset(); }
    } catch (err) { showToast("Failed: " + err.message, "danger"); }
}

async function deleteSupplier(id) {
    if (!confirm("Delete this supplier?")) return;
    try {
        const res = await fetch(`${BASE_URL}/api/suppliers/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) { showToast("Supplier deleted", "success"); loadSuppliers(); }
    } catch (err) { showToast("Failed: " + err.message, "danger"); }
}

async function addUser(e) {
    e.preventDefault();
    const data = {
        username: document.getElementById("userName").value,
        email: document.getElementById("userEmail").value,
        password: document.getElementById("userPassword").value,
        role: document.getElementById("userRole").value
    };
    try {
        const res = await fetch(`${BASE_URL}/api/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
            body: JSON.stringify(data)
        });
        if (res.ok) { showToast("User added!", "success"); loadUsers(); e.target.reset(); }
    } catch (err) { showToast("Failed: " + err.message, "danger"); }
}

async function deleteUser(id) {
    if (!confirm("Delete this user?")) return;
    try {
        const res = await fetch(`${BASE_URL}/api/users/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.ok) { showToast("User deleted", "success"); loadUsers(); }
    } catch (err) { showToast("Failed: " + err.message, "danger"); }
}

function switchStore() {
    const storeId = document.getElementById("storeSelect").value;
    if (storeId) {
        currentStore = storeId;
        loadAppData().then(() => {
            loadDashboard();
            loadProducts();
            loadOrders();
        });
    }
}

function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function logout() {
    localStorage.removeItem("authToken");
    location.reload();
}

// Initialize
init();
