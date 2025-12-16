// js/admin.js
import { auth, db } from './firebase_config.js'; 
import { 
    collection, getDoc, doc, getDocs, 
    addDoc, updateDoc, deleteDoc, 
    query, onSnapshot, orderBy 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js"; 
import { signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// --- GLOBAL STATE ---
let currentEditingItemId = null; 

// --- UTILITIES ---
const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => document.querySelectorAll(selector);

// --- 1. ADMIN AUTHORIZATION ---
const checkAdminStatus = async (user) => {
    if (!user) {
        // Redirect to login/home if no user is signed in
        window.location.href = 'index.html'; 
        return false;
    }
    
    try {
        const userDocRef = doc(db, "users", user.uid); 
        const userDoc = await getDoc(userDocRef);

        // Check if document exists AND role is explicitly 'admin'
        if (userDoc.exists() && userDoc.data().role === 'admin') {
            return true;
        } else {
            alert("Access Denied: You are not authorized as an administrator.");
            await signOut(auth); 
            window.location.href = 'index.html'; 
            return false;
        }
    } catch (error) {
        console.error("Error checking admin status:", error);
        // Fallback safety: sign out and redirect on error
        await signOut(auth);
        window.location.href = 'index.html';
        return false;
    }
};

// --- 2. INITIALIZATION & LISTENERS ---
// Main entry point after Firebase auth state changes
auth.onAuthStateChanged(async (user) => {
    // Only proceed if user is confirmed as admin
    if (await checkAdminStatus(user)) {
        loadItems(); 
        listenForOrders(); 
        setupEventListeners();
    }
});

const setupEventListeners = () => {
    qs('#addItemForm').addEventListener('submit', handleItemFormSubmit);
    qs('#itemImage').addEventListener('input', updateImagePreview);
    
    // Event delegation for order status updates
    qs('#allOrdersContainer').addEventListener('click', (e) => {
        if (e.target.classList.contains('status-badge')) {
            handleStatusClick(e);
        }
    });
    
    // Logout button listener
    const logoutBtn = qs('#logoutBtn');
    if (logoutBtn) {
        // Clear global state on logout
        logoutBtn.addEventListener('click', () => {
             currentEditingItemId = null;
             signOut(auth).then(() => window.location.href = 'index.html');
        });
    }
};

const updateImagePreview = () => {
    const url = qs('#itemImage').value;
    const imgPreview = qs('#imagePreview');
    const previewText = qs('.preview-text');

    if (url) {
        imgPreview.src = url;
        imgPreview.style.display = 'block';
        previewText.style.display = 'none';
    } else {
        imgPreview.style.display = 'none';
        previewText.textContent = "Image Preview";
        previewText.style.display = 'block';
    }
};

// --- 3. ITEM MANAGEMENT (CRUD) ---
const handleItemFormSubmit = async (e) => {
    e.preventDefault();
    const statusMessage = qs('#statusMessage');
    const submitBtn = qs('#item-submit-btn'); 

    const originalButtonText = currentEditingItemId ? '<i class="fas fa-edit"></i> Update Item' : '<i class="fas fa-plus-circle"></i> Add to Menu';
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${currentEditingItemId ? 'Updating...' : 'Adding...'}`;

    const itemData = {
        name: qs('#itemName').value,
        // FIX: Added Description field capture
        description: qs('#itemDescription').value, 
        // Ensure price is stored as a number/float
        price: parseFloat(qs('#itemPrice').value),
        category: qs('#itemCategory').value,
        imageUrl: qs('#itemImage').value,
        stock: 999, // Static value for stock, adjust as needed
        timestamp: new Date()
    };
    
    if (isNaN(itemData.price) || itemData.price < 0) {
        statusMessage.textContent = 'Error: Invalid price entered.';
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalButtonText;
        return;
    }

    try {
        if (currentEditingItemId) {
            // UPDATE operation
            await updateDoc(doc(db, "items", currentEditingItemId), itemData);
            statusMessage.textContent = `${itemData.name} updated successfully!`;
        } else {
            // CREATE operation
            await addDoc(collection(db, "items"), itemData);
            statusMessage.textContent = `${itemData.name} added successfully and is visible on the menu page!`;
        }
        
        resetItemForm();
        loadItems(); // Reload the item list to show changes
    } catch (error) {
        console.error("Error submitting item:", error);
        statusMessage.textContent = `Error: Failed to connect to database. ${error.message}`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalButtonText; // Reset button text after failure
    }
};

const resetItemForm = () => {
    qs('#addItemForm').reset();
    currentEditingItemId = null;
    qs('#item-submit-btn').innerHTML = '<i class="fas fa-plus-circle"></i> Add to Menu';
    // Manually trigger preview update to clear the image
    qs('#itemImage').dispatchEvent(new Event('input')); 
};

/**
 * Renders the existing menu items for the admin panel.
 */
const loadItems = async () => {
    const itemListContainer = qs('#itemList');
    
    // Clear previous content and show loading state
    itemListContainer.innerHTML = '<h3>Current Menu Items</h3><p style="padding:15px; color:#555;">Loading items...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, "items"));
        
        if (querySnapshot.empty) {
             itemListContainer.innerHTML = '<h3>Current Menu Items</h3><p style="padding:15px; color:var(--warning);">No items found. Add one above!</p>';
             return;
        }

        itemListContainer.innerHTML = '<h3>Current Menu Items</h3>';
        
        querySnapshot.forEach((docSnap) => { 
            const item = docSnap.data();
            const itemId = docSnap.id;
            const price = item.price ? item.price.toFixed(2) : 'N/A';
            const imageUrl = item.imageUrl || 'https://via.placeholder.com/50x50/cccccc/ffffff?text=Food';
            
            // Display description if it exists
            const descriptionSnippet = item.description 
                ? `<span class="item-description-snippet" title="${item.description}">${item.description.substring(0, 40)}...</span>` 
                : '';
            
            // Create the item row container with the dedicated CSS classes
            const itemRow = document.createElement('div');
            itemRow.className = 'item-row'; 
            
            itemRow.innerHTML = `
                <div class="item-info">
                    <img src="${imageUrl}" alt="${item.name} thumbnail" loading="lazy">
                    <div class="item-details">
                        <strong>${item.name || 'Unnamed Dish'}</strong>
                        <span>Category: ${item.category || 'N/A'} | Price: ₹${price}</span>
                        ${descriptionSnippet}
                    </div>
                </div>
                <div class="item-actions">
                    <button class="edit-btn" data-id="${itemId}" aria-label="Edit ${item.name}">
                        <i class="fas fa-pen"></i> Edit
                    </button>
                    <button class="delete-btn" data-id="${itemId}" aria-label="Delete ${item.name}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            itemListContainer.appendChild(itemRow);
        });

        // Attach listeners for newly created Edit/Delete buttons
        itemListContainer.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', editItem));
        itemListContainer.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', deleteItem));

    } catch (error) {
        console.error("Error loading items:", error);
        itemListContainer.innerHTML = '<h3>Error loading items. Check console.</h3>';
    }
};

const editItem = async (e) => {
    const itemId = e.currentTarget.dataset.id;
    const statusMessage = qs('#statusMessage');
    
    statusMessage.textContent = `Loading item ${itemId.substring(0, 5)}...`;

    try {
        const itemDoc = await getDoc(doc(db, "items", itemId));
        
        if (itemDoc.exists()) {
            const item = itemDoc.data();
            currentEditingItemId = itemId;

            // Populate the form fields
            qs('#itemName').value = item.name;
            // FIX: Populate the description field
            qs('#itemDescription').value = item.description || ''; 
            qs('#itemPrice').value = item.price;
            qs('#itemCategory').value = item.category;
            qs('#itemImage').value = item.imageUrl;
            
            // Update button text and image preview
            qs('#item-submit-btn').innerHTML = '<i class="fas fa-edit"></i> Update Item';
            qs('#itemImage').dispatchEvent(new Event('input')); // Trigger preview
            
            // Smooth scroll to the form for a good UX
            qs('.admin-form-card').scrollIntoView({ behavior: 'smooth' });
            
            statusMessage.textContent = `Editing item: ${item.name}`;
        }
    } catch (error) {
        console.error("Error loading item for edit:", error);
        statusMessage.textContent = "Failed to load item data for editing.";
    }
};

const deleteItem = async (e) => {
    const itemId = e.currentTarget.dataset.id;
    const itemName = e.currentTarget.getAttribute('aria-label').replace('Delete ', '');
    
    if (confirm(`Are you sure you want to permanently delete "${itemName}"? This cannot be undone.`)) {
        try {
            await deleteDoc(doc(db, "items", itemId));
            qs('#statusMessage').textContent = `${itemName} deleted successfully!`;
            loadItems(); // Refresh the list
        } catch (error) {
            console.error("Error deleting item:", error);
            qs('#statusMessage').textContent = `Error deleting ${itemName}. Check console.`;
        }
    }
};


// --- 4. ORDER MANAGEMENT (REAL-TIME) ---
const getStatusClass = (status) => {
    // Helper function to map status string to CSS class
    switch (status) {
        case 'New': return 'status-new';
        case 'Processing': return 'status-processing';
        case 'Delivered': return 'status-delivered';
        case 'Cancelled': return 'status-cancelled';
        default: return 'status-new';
    }
};

const listenForOrders = () => {
    const ordersContainer = qs('#allOrdersContainer');
    const ordersRef = collection(db, "orders");
    
    // Query to get orders ordered by newest first
    const q = query(ordersRef, orderBy("timestamp", "desc"));

    // Real-time listener
    onSnapshot(q, (snapshot) => {
        ordersContainer.innerHTML = ''; 
        const fragment = document.createDocumentFragment();

        if (snapshot.empty) {
            ordersContainer.innerHTML = '<p style="text-align: center; color: #888; padding: 30px;">No active orders found.</p>';
            return;
        }

        snapshot.forEach((document) => {
            const order = document.data();
            const orderId = document.id;

            // Data extraction and formatting
            const customerName = order.customerName || order.customerEmail || 'Guest User';
            const customerPhone = order.customerPhone || 'N/A';
            const customerAddress = order.shippingAddress || 'No Address Provided';
            const total = order.total || 0;
            const status = order.status || 'New';
            const statusClass = getStatusClass(status);
            const isCompleted = status === 'Delivered' || status === 'Cancelled';
            
            const summary = order.orderItems 
                ? order.orderItems.map(item => `${item.quantity}x ${item.name}`).join(', ') 
                : 'Items not listed.';
                
            const timestamp = order.timestamp ? new Date(order.timestamp.seconds * 1000).toLocaleString() : 'N/A';
            
            const orderRow = document.createElement('div');
            orderRow.className = 'order-row';
            orderRow.dataset.status = status.toLowerCase();
            orderRow.style.opacity = isCompleted ? 0.6 : 1; // Visually fade completed orders

            orderRow.innerHTML = `
                <div class="order-id">#${orderId.substring(0, 5)}</div>
                <div class="customer-info">
                    <strong>${customerName}</strong>
                    <span>Ph: ${customerPhone}</span>
                    <span class="order-address">${customerAddress}</span>
                </div>
                <div class="order-summary">
                    ${summary}
                    <span class="order-time"><i class="far fa-clock"></i> ${timestamp}</span>
                </div>
                <div class="order-total">₹${total.toFixed(2)}</div>
                <div class="status-badge ${statusClass}" data-id="${orderId}" data-status="${status}">
                    ${status}
                </div>
            `;
            
            fragment.appendChild(orderRow);
        });

        ordersContainer.appendChild(fragment);
        
        const endMsg = document.createElement('p');
        endMsg.style.cssText = "text-align: center; color: #888; padding: 30px;";
        endMsg.textContent = `-- End of Real-time Orders Feed --`;
        ordersContainer.appendChild(endMsg);
        
    }, (error) => {
        console.error("Real-time order listener failed:", error);
        ordersContainer.innerHTML = 'Error fetching real-time orders. Please check network connection.';
    });
};

const handleStatusClick = async (e) => {
    const badge = e.currentTarget;
    const orderId = badge.dataset.id;
    const currentStatus = badge.dataset.status;

    // Define the standard cycle: New -> Processing -> Delivered
    const statusCycle = { 'New': 'Processing', 'Processing': 'Delivered', 'Delivered': 'New', 'Cancelled': 'New' };
    let nextStatus = statusCycle[currentStatus];
    
    if(currentStatus === 'Cancelled') {
        // Special case: force confirmation for resetting a cancelled order
        nextStatus = prompt(`Order ${orderId.substring(0, 5)} is CANCELLED. Do you want to reset it? Enter 'New' or 'Cancelled' to confirm the current status.`).trim();
        if(nextStatus !== 'New' && nextStatus !== 'Cancelled') return;
    } else if (!confirm(`Update status for order #${orderId.substring(0, 5)} from ${currentStatus} to ${nextStatus}?`)) {
        return; // User cancelled the confirmation
    }

    try {
        // Perform the Firestore update
        await updateDoc(doc(db, "orders", orderId), {
            status: nextStatus,
            updatedBy: auth.currentUser.email,
            updateTimestamp: new Date()
        });
        qs('#statusMessage').textContent = `Order ${orderId.substring(0, 5)} updated to ${nextStatus}.`;
    } catch (error) {
        console.error("Error updating order status:", error);
        qs('#statusMessage').textContent = "Failed to update order status. Check database rules.";
    }
};