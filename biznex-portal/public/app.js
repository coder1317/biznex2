// ════════════════════════════════════════════════════════════════════════════
// BIZNEX Portal - Redesigned Dashboard
// ════════════════════════════════════════════════════════════════════════════

const API_URL = window.location.origin;
let currentUser = null;

// ════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════════════

function initializePage() {
    const userEmail = localStorage.getItem('currentUserEmail');
    const userName = localStorage.getItem('currentUserName');
    
    if (userEmail && userName) {
        // User was previously logged in, restore their session
        currentUser = {
            id: localStorage.getItem('currentUserId') || 1,
            name: userName,
            email: userEmail
        };
        showDashboard();
    } else {
        // No active session, show login
        showPage('login');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE NAVIGATION
// ════════════════════════════════════════════════════════════════════════════

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const el = document.getElementById('page-' + page);
    if (el) el.style.display = 'block';
}

function goToLogin() { showPage('login'); }
function goToSignup() { showPage('signup'); }
function backToLogin() { showPage('login'); }

function switchTab(tab) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(t => {
        t.style.display = 'none';
        t.classList.remove('active');
    });
    
    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    // Show the selected tab
    const tabElement = document.getElementById('tab-' + tab);
    if (tabElement) {
        tabElement.style.display = 'block';
        tabElement.classList.add('active');
    }
    
    // Activate the nav item using data-tab attribute
    const navItem = document.querySelector('.nav-item[data-tab="' + tab + '"]');
    if (navItem) navItem.classList.add('active');
    
    // Load data for this tab
    loadTabData(tab);
}

function loadTabData(tab) {
    if (!currentUser) return;
    
    if (tab === 'overview') loadOverview();
    if (tab === 'stores') loadStores();
    if (tab === 'inventory') loadInventory();
    if (tab === 'licenses') loadLicenses();
    if (tab === 'employees') loadEmployees();
}

// ════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const res = await fetch(API_URL + '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (res.ok && data.account) {
            currentUser = data.account;
            localStorage.setItem('currentUserEmail', email);
            localStorage.setItem('currentUserName', data.account.name || email);
            localStorage.setItem('currentUserId', data.account.id || 1);
            showDashboard();
        } else if (data.requiresCode) {
            document.getElementById('otp-email-display').textContent = email;
            localStorage.setItem('loginEmail', email);
            showPage('login-otp');
        } else {
            alert('Login failed: ' + (data.error || 'Invalid response from server'));
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// Verify OTP during login (REMOVED - using password now)

// ════════════════════════════════════════════════════════════════════════════
// SIGNUP - SIMPLE: EMAIL + PASSWORD
// ════════════════════════════════════════════════════════════════════════════

document.getElementById('signupEmailForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;
    
    if (!email || !password) {
        alert('Email and password are required.');
        return;
    }
    
    if (password !== passwordConfirm) {
        alert('Passwords do not match');
        return;
    }
    
    try {
        const res = await fetch(API_URL + '/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, plan: 'starter' })
        });
        const data = await res.json();
        
        if (res.ok && data.account && data.key) {
            // Account created successfully!
            currentUser = data.account;
            localStorage.setItem('currentUserEmail', email);
            localStorage.setItem('currentUserName', data.account.name || email);
            localStorage.setItem('currentUserId', data.account.id || 1);
            
            // Show license key page
            showLicenseKeyPage(data.key, data.plan);
        } else {
            alert('Error creating account: ' + (data.error || 'Try again'));
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

// ════════════════════════════════════════════════════════════════════════════
// LICENSE KEY DISPLAY
// ════════════════════════════════════════════════════════════════════════════

function showLicenseKeyPage(licenseKey, plan) {
    document.getElementById('displayLicenseKey').textContent = licenseKey;
    document.getElementById('displayPlan').textContent = (plan || 'starter').toUpperCase();
    document.getElementById('displayEmail').textContent = currentUser?.email || localStorage.getItem('currentUserEmail');
    showPage('license-key');
}

function copyLicenseKey() {
    const key = document.getElementById('displayLicenseKey').textContent;
    if (!key) {
        alert('No key found');
        return;
    }
    navigator.clipboard.writeText(key).then(() => {
        alert('License key copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy: ' + err);
    });
}

function goToDashboard() {
    localStorage.removeItem('newLicenseKey');
    localStorage.removeItem('newLicensePlan');
    showDashboard();
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUserEmail');
    localStorage.removeItem('currentUserName');
    localStorage.removeItem('currentUserId');
    goToLogin();
}

function showDashboard() {
    if (!currentUser) {
        alert('Please log in first');
        goToLogin();
        return;
    }
    showPage('dashboard');
    document.getElementById('userDisplayName').textContent = currentUser?.name || 'User';
    loadOverview();
}

async function loadOverview() {
    try {
        if (!currentUser) {
            console.warn('No current user when loading overview');
            return;
        }
        
        // Safely update metrics
        const elements = {
            totalIncome: document.getElementById('totalIncome'),
            storeCount: document.getElementById('storeCount'),
            employeeCount: document.getElementById('employeeCount'),
            licenseCount: document.getElementById('licenseCount'),
            incomeByStore: document.getElementById('incomeByStore'),
            restockAlerts: document.getElementById('restockAlerts')
        };
        
        // Check if elements exist before updating
        if (elements.totalIncome) elements.totalIncome.textContent = '₹0';
        if (elements.storeCount) elements.storeCount.textContent = '0';
        if (elements.employeeCount) elements.employeeCount.textContent = '0';
        if (elements.licenseCount) elements.licenseCount.textContent = '1';
        
        if (elements.incomeByStore) {
            elements.incomeByStore.innerHTML = '<p style="padding: 16px; color: #94a3b8;">No stores created yet. Go to the Stores tab to create one.</p>';
        }
        if (elements.restockAlerts) {
            elements.restockAlerts.innerHTML = '<p style="padding: 16px; color: #94a3b8;">All stocks in good condition.</p>';
        }
    } catch (err) {
        console.error('Error loading overview:', err);
    }
}

async function loadStores() {
    try {
        if (!currentUser) {
            console.warn('No current user when loading stores');
            return;
        }
        
        const storesGrid = document.getElementById('storesGrid');
        if (!storesGrid) {
            console.error('storesGrid element not found');
            return;
        }
        
        storesGrid.innerHTML = '<div style="padding: 24px; text-align: center; color: #94a3b8; grid-column: 1 / -1;"><p>No stores yet. Click "+ Add Store" to create one.</p></div>';
    } catch (err) {
        console.error('Error loading stores:', err);
    }
}

async function loadInventory() {
    try {
        if (!currentUser) {
            console.warn('No current user when loading inventory');
            return;
        }
        
        const inventoryTable = document.getElementById('inventoryTable');
        if (inventoryTable) {
            inventoryTable.innerHTML = '<p style="padding: 16px; color: #94a3b8;">Inventory data coming soon...</p>';
        }
    } catch (err) {
        console.error('Error loading inventory:', err);
    }
}

async function loadLicenses() {
    try {
        if (!currentUser) {
            console.warn('No current user when loading licenses');
            return;
        }
        
        const licensesList = document.getElementById('licensesList');
        
        if (licensesList) {
            const html = '<div style="background:#1e293b;padding:20px;border-radius:8px;margin:12px 0;border-left:3px solid #4f46e5;">' +
                '<p style="color:#a5b4fc;font-weight:bold;margin:0 0 12px 0;">License Information</p>' +
                '<p style="color:#94a3b8;margin:0 0 8px 0;">Your license key was displayed when you created your account.</p>' +
                '<p style="color:#94a3b8;margin:0;font-size:12px;">For security reasons, license keys are only shown at account creation time.</p>' +
                '</div>';
            licensesList.innerHTML = html;
        }
    } catch (err) {
        console.error('Error loading licenses:', err);
    }
}

async function loadEmployees() {
    try {
        if (!currentUser) {
            console.warn('No current user when loading employees');
            return;
        }
        
        const employeesTable = document.getElementById('employeesTable');
        if (employeesTable) {
            employeesTable.innerHTML = '<p style="padding: 16px; color: #94a3b8;">Employee data coming soon...</p>';
        }
    } catch (err) {
        console.error('Error loading employees:', err);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// MODALS
// ════════════════════════════════════════════════════════════════════════════

function showAddStoreModal() {
    document.getElementById('addStoreModal').style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

document.getElementById('addStoreForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('storeName').value;
    const location = document.getElementById('storeLocation').value;
    const type = document.getElementById('storeType').value;
    
    try {
        const res = await fetch(API_URL + '/api/stores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: currentUser.id, name, location, type })
        });
        const data = await res.json();
        
        if (res.ok) {
            alert('Store created!');
            closeModal('addStoreModal');
            loadStores();
        } else {
            alert('Error: ' + (data.error || 'Failed'));
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUserEmail');
    showPage('login');
}

// ════════════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════════════

window.addEventListener('load', () => {
    showPage('login');
});
