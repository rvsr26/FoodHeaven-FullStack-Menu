// ================= FIREBASE IMPORTS =================
// Imports authentication and database objects from a local configuration file.
import { auth, db } from './firebase_config.js'; 
// Imports Firestore functions for data retrieval and updates.
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
// Imports Auth functions for handling user session state and sign out.
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

/* ================= CONFIG ================= */
// Maps Firestore categories to the corresponding HTML container IDs 
const CATEGORY_MAP = {
    biryani: 'container-biryani',
    pizza: 'container-pizza',
    chinese: 'container-chinese',
    tiffin: 'container-tiffin',
    // Mapping multiple food types to the general 'desserts' container
    cake: 'container-desserts', 
    icecream: 'container-desserts',
    beverage: 'container-desserts' 
};

// Default image to use if an item lacks an imageUrl in the database.
const DEFAULT_IMAGE = 'https://via.placeholder.com/600x400/e92c40/ffffff?text=Food+Heaven';

// Current active Firebase user
let currentUser = null; 
// Placeholder for all loaded menu items, keyed by ID for easy lookup
let menuDataCache = new Map(); 

// 5️⃣ PREVENT DOUBLE EVENT LISTENERS (STABILITY)
let isInitialized = false; 

/* ================= UTILITIES & DOM CACHING ================= */
// Shorthand functions for DOM querying.
const qs = (id) => document.getElementById(id);
const qsa = (sel) => document.querySelectorAll(sel);
const q = (sel) => document.querySelector(sel);

// Formats a number as Indian Rupees (₹) with two decimal places.
const toCurrency = (value) => `₹${Number(value || 0).toFixed(2)}`;

// Function to display temporary, non-blocking notifications.
const showToast = (msg, type = 'success') => {
    const box = qs('toast-container');
    if (!box) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Selects the appropriate Font Awesome icon based on the message type.
    const iconClass = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    toast.innerHTML = `<i class="fa fa-${iconClass}"></i> ${msg}`;
    box.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// ================= FIREBASE AUTH UTILITIES =================

/**
 * Helper function to create user initials for the avatar.
 */
function generateInitials(displayName) {
    if (!displayName) return '?';
    const parts = displayName.split(' ').filter(p => p.length > 0); 
    if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
}


/* ================= STATE MANAGEMENT (ADDRESSES) ================= */

// 4️⃣ REAL ADDRESS SAVE (LOCAL STORAGE MINIMUM)
const saveAddress = (address) => {
    const newAddress = { ...address, id: Date.now() }; 
    const addresses = JSON.parse(localStorage.getItem('foodHeavenAddresses')) || [];
    addresses.push(newAddress);
    localStorage.setItem('foodHeavenAddresses', JSON.stringify(addresses));
    return newAddress;
};

const getAddresses = () => {
    return JSON.parse(localStorage.getItem('foodHeavenAddresses')) || [];
};

const renderAddressView = () => {
    const container = qs('address-book');
    if (!container) return;

    const addressListContainer = container.querySelector('.address-list'); 
    if (!addressListContainer) return;

    const addresses = getAddresses();
    addressListContainer.innerHTML = '<h4>Saved Locations</h4>'; 

    if (addresses.length === 0) {
        addressListContainer.innerHTML += '<p class="empty-view-msg">No addresses saved yet.</p>';
        return;
    }

    const listHTML = addresses.map(addr => `
        <div class="address-item">
            <p><strong>${addr.street}</strong></p>
            <p>${addr.city}</p>
        </div>
    `).join('');
    
    addressListContainer.innerHTML += listHTML;
};


/* ================= STATE MANAGEMENT (WISHLIST) ================= */

class WishlistManager {
    constructor() {
        this.savedItemIds = new Set(JSON.parse(localStorage.getItem('foodHeavenWishlist')) || []);
    }

    saveWishlist() {
        localStorage.setItem('foodHeavenWishlist', JSON.stringify([...this.savedItemIds]));
    }

    isSaved(itemId) {
        return this.savedItemIds.has(itemId);
    }
    
    async syncWishlist(userId) {
        if (!userId) return; 

        try {
            const docRef = doc(db, 'users', userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists() && docSnap.data().wishlist) {
                this.savedItemIds = new Set(docSnap.data().wishlist);
                this.saveWishlist(); 
                this.updateUI(); 
            }
        } catch (error) {
            console.error("Error syncing wishlist:", error);
        }
    }
    
    async updateFirebaseWishlist() {
        if (currentUser) {
            try {
                const docRef = doc(db, 'users', currentUser.uid);
                await updateDoc(docRef, { 
                    wishlist: [...this.savedItemIds] 
                }, { merge: true }); 
            } catch (error) {
                console.error("Error updating Firebase wishlist:", error);
                showToast("Failed to save wishlist online.", 'error');
            }
        }
    }

    toggleSave(itemId) {
        let action;
        if (this.savedItemIds.has(itemId)) {
            this.savedItemIds.delete(itemId);
            action = 'removed';
        } else {
            this.savedItemIds.add(itemId);
            action = 'added';
        }

        this.saveWishlist();
        this.updateFirebaseWishlist(); 
        this.updateUI(itemId);
        
        const itemName = menuDataCache.get(itemId)?.name || 'Item';
        showToast(`${itemName} ${action} to Wishlist!`);
    }

    updateUI(changedItemId = null) {
        if (changedItemId) {
            updateWishlistIcon(changedItemId, this.isSaved(changedItemId));
        } else {
            qsa('.menu-card').forEach(card => {
                const id = card.dataset.itemId;
                updateWishlistIcon(id, this.isSaved(id));
            });
        }
        
        renderWishlistView(this.getSavedItemsDetails());
    }

    getSavedItemsDetails() {
        return [...this.savedItemIds]
            .map(id => menuDataCache.get(id))
            .filter(item => item !== undefined); 
    }
}

const wishlistManager = new WishlistManager();


/* ================= STATE MANAGEMENT (CART) ================= */

class CartManager {
    constructor() {
        const savedCartArray = JSON.parse(localStorage.getItem('foodHeavenCart')) || [];
        this.cartItems = new Map(savedCartArray.map(item => [item.id, item]));
    }

    saveCart() {
        localStorage.setItem('foodHeavenCart', JSON.stringify([...this.cartItems.values()]));
    }

    getCartArray() {
        return [...this.cartItems.values()];
    }

    getTotalItems() {
        return this.getCartArray().reduce((sum, item) => sum + item.qty, 0);
    }

    getTotalPrice() {
        return this.getCartArray().reduce((sum, item) => sum + item.qty * item.price, 0);
    }

    getItemQty(id) {
        return this.cartItems.get(id)?.qty || 0;
    }

    addToCart(id, item, qtyToAdd = 1) {
        // 7️⃣ SECURITY HARDENING: Check for valid price
        if (!item || !item.price || item.price <= 0) {
            showToast('Invalid item data. Cannot add to cart.', 'error');
            return;
        }

        let cartItem = this.cartItems.get(id);

        if (cartItem) {
            cartItem.qty += qtyToAdd;
        } else {
            cartItem = { 
                id, 
                name: item.name, 
                price: item.price, 
                qty: qtyToAdd, 
                imageUrl: item.imageUrl || DEFAULT_IMAGE 
            };
            this.cartItems.set(id, cartItem);
        }

        this.saveCart();
        this.updateUI(id);
        showToast(`${item.name} added to cart (${cartItem.qty})`);
    }

    removeFromCart(id, qtyToRemove = 1) {
        const cartItem = this.cartItems.get(id);

        if (!cartItem) return;

        cartItem.qty -= qtyToRemove;

        if (cartItem.qty <= 0) {
            this.cartItems.delete(id);
            showToast('Item fully removed from cart');
        } else {
             showToast('Item quantity decreased');
        }

        this.saveCart();
        this.updateUI(id);
    }

    updateUI(changedItemId = null) {
        renderCart(this);
        updateCartCount(this.getTotalItems());
        updateTotal(this.getTotalPrice());
        
        if (changedItemId) {
            updateMenuCardUI(changedItemId, this.getItemQty(changedItemId));
        }
    }
}

const cartManager = new CartManager();

/* ================= UI UPDATERS ================= */

const updateMenuCardUI = (itemId, currentQty) => {
    const card = q(`.menu-card[data-item-id="${itemId}"]`);
    if (!card) return;

    const qtySpan = card.querySelector('.card-qty-val');
    const isCurrentlyInCart = currentQty > 0;

    card.classList.toggle('has-qty', isCurrentlyInCart);

    if (isCurrentlyInCart) {
        qtySpan.textContent = currentQty;
    } else {
        qtySpan.textContent = '1'; 
    }
};

const updateWishlistIcon = (itemId, isSaved) => {
    const card = q(`.menu-card[data-item-id="${itemId}"]`);
    if (!card) return;

    const btn = card.querySelector('.mc-wishlist-btn');
    const icon = card.querySelector('.mc-wishlist-btn i');

    if (btn && icon) {
        btn.setAttribute('data-is-saved', isSaved);
        if (isSaved) {
            icon.classList.replace('far', 'fas'); 
        } else {
            icon.classList.replace('fas', 'far');
        }
    }
};

const updateCartCount = (count) => {
    const countEl = qs('cart-count');
    const checkoutBtn = qs('checkout-btn');
    if (countEl) countEl.textContent = count;
    if (checkoutBtn) checkoutBtn.disabled = count === 0;
};

const updateTotal = (total) => {
    const totalEl = qs('total-price');
    if (totalEl) totalEl.textContent = toCurrency(total);
};

const renderCart = (manager) => {
    const box = qs('cart-items-container');
    if (!box) return;

    box.innerHTML = '';
    const cartArray = manager.getCartArray();

    if (!cartArray.length) {
        box.innerHTML = '<p class="empty-msg">Your cart is empty. <a href="#food-menu">Start shopping!</a></p>';
        return;
    }

    cartArray.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-item';
        const itemTotal = item.qty * item.price;
        row.innerHTML = `
            <div class="item-details">
                <img src="${item.imageUrl}" alt="${item.name}" loading="lazy" width="60" height="60">
                <div>
                    <h4>${item.name}</h4>
                    <span>${toCurrency(item.price)} x ${item.qty}</span>
                </div>
            </div>
            <div class="qty-controls">
                <button data-id="${item.id}" class="minus" aria-label="Decrease ${item.name}"><i class="fa fa-minus"></i></button>
                <span role="status" class="item-qty-val">${item.qty}</span>
                <button data-id="${item.id}" class="plus" aria-label="Increase ${item.name}"><i class="fa fa-plus"></i></button>
                <span class="item-total-price">${toCurrency(itemTotal)}</span>
            </div>
        `;
        box.appendChild(row);
    });

    box.querySelectorAll('.plus').forEach(btn =>
        btn.addEventListener('click', () => {
            const item = manager.cartItems.get(btn.dataset.id);
            manager.addToCart(btn.dataset.id, { name: item?.name, price: item?.price, imageUrl: item?.imageUrl }, 1);
        })
    );
    box.querySelectorAll('.minus').forEach(btn =>
        btn.addEventListener('click', () => manager.removeFromCart(btn.dataset.id, 1))
    );
};

const renderWishlistView = (items) => {
    const viewContainer = qs('saved-items');
    if (!viewContainer) return;
    
    let list = viewContainer.querySelector('.saved-items-list');
    if (!list) {
        viewContainer.innerHTML = '<h3><i class="fas fa-heart"></i> Your Wishlist</h3>';
        list = document.createElement('div');
        list.className = 'saved-items-list';
        viewContainer.appendChild(list);
    } else {
        list.innerHTML = ''; 
    }

    if (items.length === 0) {
        viewContainer.innerHTML = '<h3><i class="fas fa-heart"></i> Your Wishlist</h3><p class="empty-view-msg">Your wishlist is empty. Browse the menu and save your favorites!</p>';
        return;
    }

    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'saved-item';
        itemElement.innerHTML = `
            <img src="${item.imageUrl || DEFAULT_IMAGE}" alt="${item.name}">
            <div class="item-info">
                <h4>${item.name}</h4>
                <p>${toCurrency(item.price)}</p>
            </div>
            <button class="btn btn-primary btn-small add-to-cart-from-wishlist" data-id="${item.id}">
                <i class="fa fa-shopping-cart"></i> Add
            </button>
            <button class="btn btn-danger btn-small remove-from-wishlist" data-id="${item.id}" aria-label="Remove ${item.name} from wishlist">
                <i class="fa fa-times"></i>
            </button>
        `;
        
        list.appendChild(itemElement);
    });
    
    list.querySelectorAll('.add-to-cart-from-wishlist').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = menuDataCache.get(btn.dataset.id);
            if (item) {
                cartManager.addToCart(item.id, item, 1);
                window.toggleCart(true); 
            }
        });
    });

    list.querySelectorAll('.remove-from-wishlist').forEach(btn => {
        btn.addEventListener('click', () => {
            wishlistManager.toggleSave(btn.dataset.id);
        });
    });
};

const renderOrderHistory = (orders = []) => {
    const container = qs('order-history');
    if (!container) return;

    if (!orders.length) {
        container.innerHTML = `
            <h3><i class="fas fa-history"></i> Recent Orders</h3>
            <p class="empty-view-msg">No orders yet. Your first order will appear here.</p>
        `;
        return;
    }

    container.innerHTML = `
        <h3><i class="fas fa-history"></i> Recent Orders</h3>
        <div class="order-list">
            ${orders.map(o => `
                <div class="order-card">
                    <strong>#${o.id || Math.floor(Math.random() * 90000) + 10000}</strong>
                    <span>${toCurrency(o.total || Math.random() * 500 + 10)}</span>
                    <p class="order-date">${new Date().toLocaleDateString()}</p>
                </div>
            `).join('')}
        </div>
    `;
};


/* ================= THEME TOGGLE ================= */
const applyTheme = (isDark) => {
    const body = document.body;
    const themeIcon = qs('theme-icon');

    if (isDark) {
        body.classList.add('dark-mode');
        if (themeIcon) {
            themeIcon.classList.replace('fa-moon', 'fa-sun'); 
        }
        localStorage.setItem('foodHeavenTheme', 'dark');
    } else {
        body.classList.remove('dark-mode');
        if (themeIcon) {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
        localStorage.setItem('foodHeavenTheme', 'light');
    }
};

const setupThemeToggle = () => {
    const themeToggleBtn = qs('theme-toggle');

    const savedTheme = localStorage.getItem('foodHeavenTheme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const initialIsDark = (savedTheme === 'dark' || (!savedTheme && prefersDark));
    applyTheme(initialIsDark);

    themeToggleBtn?.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-mode');
        applyTheme(!isDark);
        showToast(`Theme switched to ${isDark ? 'Light' : 'Dark'} mode`);
    });
};


/* ================= MENU RENDERING ================= */

const renderFoodItem = (data, id) => {
    const containerId = CATEGORY_MAP[data.category] || CATEGORY_MAP.biryani;
    const container = qs(containerId);
    const template = qs('menu-item-template');
    if (!container || !template) return;

    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.itemId = id;

    const initialQty = cartManager.getItemQty(id);
    if (initialQty > 0) {
        node.classList.add('has-qty');
    }

    const { name, description, price, imageUrl, isNew } = data;
    const img = node.querySelector('.mc-img img');
    const qtySpan = node.querySelector('.card-qty-val');
    
    img.src = imageUrl || DEFAULT_IMAGE;
    img.alt = name || 'Food Item';
    img.loading = 'lazy';
    node.querySelector('.mc-title').textContent = name || 'Unnamed Dish';
    node.querySelector('.mc-desc').textContent = description || 'Freshly prepared delicious food.';
    node.querySelector('.price-val').textContent = Number(price || 0).toFixed(2);

    const badge = node.querySelector('.mc-badge');
    badge.textContent = isNew ? 'NEW' : '';
    badge.style.display = isNew ? 'inline-flex' : 'none';
    
    qtySpan.textContent = initialQty > 0 ? initialQty : 1;

    node.dataset.itemData = JSON.stringify({ name, price, imageUrl: imageUrl || DEFAULT_IMAGE });

    const wishlistButton = node.querySelector('.mc-wishlist-btn');
    if (wishlistButton) {
        updateWishlistIcon(id, wishlistManager.isSaved(id));
        wishlistButton.addEventListener('click', () => {
            wishlistManager.toggleSave(id);
        });
    }

    node.querySelector('.card-add-btn').addEventListener('click', () => {
        cartManager.addToCart(id, data, 1);
    });

    node.querySelector('.card-minus').addEventListener('click', () => {
        cartManager.removeFromCart(id, 1);
    });

    node.querySelector('.card-plus').addEventListener('click', () => {
        cartManager.addToCart(id, data, 1);
    });

    container.appendChild(node);
};

const loadMenu = async () => {
    try {
        showToast('Loading menu...', 'info');
        
        // 6️⃣ LOADING SKELETON FOR MENU (UX POLISH)
        qsa('.food-menu-container').forEach(c => {
            c.innerHTML = '<div class="menu-card skeleton"></div>'.repeat(4);
        });
        
        const snapshot = await getDocs(collection(db, 'items'));

        qsa('.food-menu-container').forEach(c => c.innerHTML = '');
        
        menuDataCache.clear(); 

        if (snapshot.empty) {
            qs('container-biryani').innerHTML = '<p class="empty-msg">Menu not available at the moment.</p>';
            showToast('No menu items found', 'error');
            return;
        }

        snapshot.forEach(docSnap => {
            const itemData = docSnap.data();
            itemData.id = docSnap.id; 
            menuDataCache.set(docSnap.id, itemData);
            renderFoodItem(itemData, docSnap.id);
        });
        
        showToast('Menu loaded successfully!');
        
        wishlistManager.updateUI(); 
    } catch (err) {
        console.error('Error loading menu:', err);
        showToast('Failed to load menu. Please refresh.', 'error');
    }
};

/* ================= SIDEBARS ================= */

window.toggleCart = (open) => {
    const cartSidebar = qs('cart-sidebar');
    const cartOverlay = qs('cart-overlay');
    if (cartSidebar && cartOverlay) {
        const shouldOpen = typeof open === 'boolean' ? open : !cartSidebar.classList.contains('active');
        cartSidebar.classList.toggle('active', shouldOpen); 
        cartOverlay.classList.toggle('active', shouldOpen);
        
        if (shouldOpen) {
            renderCart(cartManager); 
        }
    }
};

window.toggleProfile = (open) => {
    const profileSidebar = qs('profile-sidebar');
    const profileOverlay = qs('profile-overlay');
    if (profileSidebar && profileOverlay) {
        const shouldOpen = typeof open === 'boolean' ? open : !profileSidebar.classList.contains('active');
        profileSidebar.classList.toggle('active', shouldOpen); 
        profileOverlay.classList.toggle('active', shouldOpen);
        
        if (shouldOpen) {
            // 1️⃣ PROFILE REMEMBERS LAST TAB
            const lastView = localStorage.getItem('profileLastView');
            if (lastView) {
                // Manually call switchProfileView via mock event to prevent navigation
                const link = document.querySelector(`.profile-tab-link[data-view="${lastView}"]`);
                if (link) {
                    const mockEvent = { preventDefault: () => {}, currentTarget: link };
                    switchProfileView(mockEvent);
                }
            } else {
                 // Ensure the default active tab (Order History) is set
                const defaultLink = document.querySelector(`.profile-tab-link.active`);
                if (defaultLink) {
                    const mockEvent = { preventDefault: () => {}, currentTarget: defaultLink };
                    switchProfileView(mockEvent);
                }
            }
            
            // Render views that rely on local storage / state
            renderWishlistView(wishlistManager.getSavedItemsDetails());
            renderAddressView();
            renderOrderHistory(); 
        }
    }
};

/* ================= FIREBASE AUTH LOGIC ================= */

const profileDisplayName = qs('profile-display-name');
const profileDisplayEmail = qs('profile-display-email');
const profileAvatarInitials = qs('profile-avatar-initials');
const loggedInMenu = qs('logged-in-menu');

onAuthStateChanged(auth, (user) => {
    const authActionButton = qs('auth-action-btn');
    currentUser = user; 

    if (!authActionButton) return;

    if (user) {
        const name = user.displayName || 'Food Lover';
        const email = user.email || 'No email provided';
        
        profileDisplayName.textContent = name;
        profileDisplayEmail.textContent = email;
        
        const initials = generateInitials(name);
        profileAvatarInitials.innerHTML = initials;
        profileAvatarInitials.classList.remove('fa', 'fa-user-circle'); 
        profileAvatarInitials.style.fontSize = '1.3rem';

        authActionButton.textContent = 'Logout';
        authActionButton.classList.add('logout-btn'); 
        authActionButton.onclick = handleLogout; 
        if (loggedInMenu) loggedInMenu.style.display = 'block';

        const settingsName = qs('setting-name');
        if (settingsName) settingsName.value = name;
        
        wishlistManager.syncWishlist(user.uid);
    } else {
        profileDisplayName.textContent = 'Guest User';
        profileDisplayEmail.textContent = 'Please Login to access features';
        
        profileAvatarInitials.innerHTML = '<i class="fa fa-user-circle"></i>';
        profileAvatarInitials.classList.add('fa', 'fa-user-circle'); 
        profileAvatarInitials.style.fontSize = '1.8rem'; 

        authActionButton.textContent = 'Login / Signup';
        authActionButton.classList.remove('logout-btn');
        authActionButton.onclick = handleLoginSignup; 
        if (loggedInMenu) loggedInMenu.style.display = 'none';

        wishlistManager.updateUI(); 
    }
});

async function handleLogout() {
    try {
        await signOut(auth);
        showToast('Logged out successfully');
        window.toggleProfile(false);
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout failed', 'error');
    }
}

function handleLoginSignup() {
    showToast('Login/Signup feature not yet implemented. Placeholder action.');
}


/* ================= PROFILE TAB / VIEW SWITCHER ================= */

const switchProfileView = (e) => {
    e.preventDefault();
    const clickedLink = e.currentTarget;
    const viewName = clickedLink.dataset.view; 

    // 3️⃣ DISABLE PROFILE ACTIONS FOR GUEST USERS (Guard)
    if (!currentUser && viewName !== 'order-history') {
        showToast('Please login to access this section', 'info');
        return;
    }
    
    // 1️⃣ PROFILE REMEMBERS LAST TAB
    localStorage.setItem('profileLastView', viewName); 

    qsa('.profile-tab-link').forEach(link => link.classList.remove('active'));
    clickedLink.classList.add('active');

    qsa('.profile-view').forEach(view => view.classList.remove('active'));
    
    const targetView = qs(viewName);
    if (targetView) {
        targetView.classList.add('active');
        
        // Re-render specific dynamic views
        if (viewName === 'saved-items') {
            renderWishlistView(wishlistManager.getSavedItemsDetails());
        }
        if (viewName === 'address-book') {
            renderAddressView();
        }
        if (viewName === 'order-history') {
            renderOrderHistory();
        }
    }
};

const setupProfileTabs = () => {
    qsa('.profile-tab-link').forEach(link => {
        link.addEventListener('click', switchProfileView);
    });

    // Handle form submissions within the profile views
    qsa('.profile-form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formId = form.closest('.profile-view').id;
            
            if (!currentUser) {
                showToast('Action failed: Must be logged in.', 'error');
                return;
            }
            
            if (formId === 'address-book') {
                // 4️⃣ REAL ADDRESS SAVE (LOCAL STORAGE MINIMUM)
                saveAddress({
                    street: qs('address-street').value,
                    city: qs('address-city').value
                });
                renderAddressView();
                showToast('New address saved!', 'success');
                form.reset();
            } else if (formId === 'account-settings') {
                showToast('Profile updated successfully!', 'success');
            } else {
                showToast('Form submitted (Placeholder)', 'info');
            }
        });
    });
};

/* ================= SEARCH/FILTER ================= */

const setupSearchFilter = () => {
    const searchInput = qs('menu-filter');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        qsa('.menu-card').forEach(card => {
            const title = card.querySelector('.mc-title')?.textContent?.toLowerCase() || '';
            const desc = card.querySelector('.mc-desc')?.textContent?.toLowerCase() || '';
            
            card.style.display = (title.includes(q) || desc.includes(q)) ? '' : 'none';
        });
    });
};

/* ================= CATEGORY AUTO SCROLL & STICKY NAV HIGHLIGHT ================= */

// --- Auto Scroll (Retained) ---
let scrollIntervalId = null;
const SCROLL_DISTANCE = 250; 
const PAUSE_DURATION_MS = 5000; 
let scrollContainer = null;
let maxScroll = 0;
let isScrolling = false;

const animateScroll = (start, end, duration) => {
    const startTime = performance.now();
    isScrolling = true;

    const step = (currentTime) => {
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(1, timeElapsed / duration);
        const easedProgress = 1 - Math.pow(1 - progress, 3); 

        scrollContainer.scrollLeft = start + (end - start) * easedProgress;

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            isScrolling = false;
            scrollContainer.scrollLeft = end; 
        }
    };
    
    requestAnimationFrame(step);
};

const performSmoothScroll = () => {
    if (isScrolling) return;

    maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
    const currentPos = scrollContainer.scrollLeft;

    let nextTarget = currentPos + SCROLL_DISTANCE;

    if (nextTarget >= maxScroll - 10) { 
        nextTarget = 0; 
    } 
    
    animateScroll(currentPos, nextTarget, 800); 
};


const setupCategoryAutoScroll = () => {
    scrollContainer = q('.horizontal-scroll-container .category-list-horizontal')?.parentElement;
    
    if (!scrollContainer) {
        return;
    }

    setTimeout(() => {
        maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        
        if (maxScroll <= 50) { 
            return;
        }

        if (scrollIntervalId) {
            clearInterval(scrollIntervalId);
        }
        
        scrollIntervalId = setInterval(performSmoothScroll, PAUSE_DURATION_MS);

    }, 1500); 

    
    const pauseScroll = () => {
        if (scrollIntervalId) {
            clearInterval(scrollIntervalId);
        }
    };

    const resumeScroll = () => {
        if (maxScroll > 50) {
            setupCategoryAutoScroll(); 
        }
    };

    scrollContainer.addEventListener('mouseenter', pauseScroll);
    scrollContainer.addEventListener('mouseleave', resumeScroll);
    scrollContainer.addEventListener('focusin', pauseScroll); 
    scrollContainer.addEventListener('focusout', resumeScroll);
};

// --- Sticky Nav Highlight (NEW LOGIC for the secondary-nav-link) ---

const updateStickyNavHighlight = () => {
    const menuLinks = qsa('.secondary-nav-link');
    
    // Find all menu sections (the targets of the links)
    const sections = qsa('.category-block .category-header');
    
    // Define the offset (below the main navbar and the sticky menu-topbar)
    // CRITICAL: Must be greater than the combined height of sticky elements
    const OFFSET = 150; 

    let activeCategory = null;

    // Iterate in reverse to find the last section that has scrolled past the OFFSET line
    for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        const rect = section.getBoundingClientRect();

        // Check if the section's top edge is above the OFFSET line (i.e., it's currently active/visible)
        if (rect.top <= OFFSET) {
            activeCategory = section.id;
            break;
        }
    }

    // Apply the active class to the corresponding link
    menuLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').substring(1) === activeCategory) {
            link.classList.add('active');
        }
    });
};

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', () => {
    // 5️⃣ PREVENT DOUBLE EVENT LISTENERS (STABILITY)
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('🍽️ Food Heaven Menu Loaded');
    
    setupThemeToggle(); 
    cartManager.updateUI();

    qs('cart-toggle')?.addEventListener('click', () => window.toggleCart(true));
    
    // 🚩 PROFILE FIX: Intercept click to ensure no default action (like scrolling to a hash) occurs
    const profileToggleBtn = qs('profile-toggle');
    if (profileToggleBtn) {
        profileToggleBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            window.toggleProfile(true);
        });
    }

    qs('close-cart')?.addEventListener('click', () => window.toggleCart(false));
    qs('close-profile')?.addEventListener('click', () => window.toggleProfile(false));

    setupProfileTabs(); 

    // ✅ CHECKOUT FIX: Redirects to payment.html after saving the cart data
    qs('checkout-btn')?.addEventListener('click', () => {
        if (cartManager.getTotalItems() === 0) {
            showToast('Cart is empty. Please add items first.', 'error');
            return;
        }
        
        // Ensure final cart state is saved to Local Storage before redirect
        cartManager.saveCart(); 
        
        // Perform the redirect
        window.location.href = 'payment.html';
    });

    const contactForm = q('.form-container');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showToast('Message sent successfully! We\'ll contact you soon.', 'success');
            contactForm.reset();
        });
    }

    // --- Anchor Link Click Handler (Updated for Sticky Nav Offset) ---
    qsa('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href').substring(1);
            const target = qs(targetId);
            
            // Only prevent default and scroll if the target exists
            if (target) {
                e.preventDefault();
                
                // CRITICAL: Calculate Total Offset for accurate scroll
                const navbarHeight = 72;
                const menuTopbarHeight = q('.menu-topbar')?.offsetHeight || 0;
                
                // Total offset = Main Nav + Sticky Category Bar + minor margin for clean stop
                const totalOffset = navbarHeight + menuTopbarHeight + 10; 
                
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - totalOffset;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Manually update the active class on the clicked secondary link
                if (link.classList.contains('secondary-nav-link')) {
                    qsa('.secondary-nav-link').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }

                window.toggleCart(false);
                window.toggleProfile(false);
            }
        });
    });

    loadMenu();
    setupSearchFilter();

    setTimeout(setupCategoryAutoScroll, 100); 

    // Listen for scroll events to highlight the secondary nav bar
    window.addEventListener('scroll', updateStickyNavHighlight);
    
    // Initial call to set the first active tab
    updateStickyNavHighlight();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.toggleCart(false);
            window.toggleProfile(false);
        }
    });
});