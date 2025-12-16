// js/payment.js
import { auth, db } from './firebase_config.js';
import { addDoc, collection, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js"; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// ================= CONFIGURATION & STATE =================
const DELIVERY_FEE = 40;
const TAX_RATE = 0.05;

let currentUser = null;
// Ensure we handle 'quantity' vs 'qty' for consistency with menu.js
let currentCart = JSON.parse(localStorage.getItem('foodHeavenCart')) || []; 
let totalAmount = 0;
let currentServiceType = 'delivery'; // Default to Delivery
let currentPaymentMethod = 'card'; // Default to Card

// ================= DOM ACCESS & UTILITIES =================
const qs = (id) => document.getElementById(id);
const qsa = (sel) => document.querySelectorAll(sel);
const toCurrency = (value) => `₹${Number(value || 0).toFixed(2)}`;

// ================= CALCULATION & RENDERING LOGIC =================

const calculateTotal = () => {
    // 1. Calculate Subtotal
    let subtotal = currentCart.reduce((sum, item) => sum + (item.price * (item.qty || item.quantity || 1)), 0);
    
    const isDelivery = currentServiceType === 'delivery';
    const deliveryCharge = isDelivery ? DELIVERY_FEE : 0;
    
    // 2. Calculate Tax
    const taxableBase = subtotal + deliveryCharge;
    const taxAmount = taxableBase * TAX_RATE;
    
    // 3. Final Total
    totalAmount = taxableBase + taxAmount;

    // 4. Update DOM
    qs('subtotal').textContent = toCurrency(subtotal);
    qs('delivery-fee').textContent = isDelivery ? toCurrency(DELIVERY_FEE) : 'N/A';
    qs('delivery-fee').style.color = isDelivery ? 'var(--text-main)' : 'gray';
    qs('tax').textContent = toCurrency(taxAmount);
    qs('final-total').textContent = toCurrency(totalAmount);
    
    // 5. Update Pay Button Text
    const payBtn = qs('pay-btn');
    if (payBtn) {
        payBtn.textContent = currentPaymentMethod === 'cod' 
            ? `Place Order (${toCurrency(totalAmount)})` 
            : `Pay Now (${toCurrency(totalAmount)})`;
    }
};

const renderCartSummary = () => {
    const itemsListContainer = qs('items-list-container');
    if (!itemsListContainer) return;
    
    itemsListContainer.innerHTML = '';

    if (currentCart.length === 0) {
        itemsListContainer.innerHTML = '<p style="color:var(--primary); text-align:center; padding: 10px;">Your cart is empty! Add items from the menu.</p>';
        qs('pay-btn').disabled = true;
        return;
    }
    
    qs('pay-btn').disabled = false;

    currentCart.forEach(item => {
        const itemQty = item.qty || item.quantity || 1;
        const itemTotal = item.price * itemQty;

        const row = document.createElement('div');
        row.className = 'item-summary-row';
        row.innerHTML = `
            <span>${item.name} x ${itemQty}</span>
            <span>${toCurrency(itemTotal)}</span>
        `;
        itemsListContainer.appendChild(row);
    });
    
    calculateTotal();
};


// ================= AUTHENTICATION & PREFILL (Firebase) =================

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const authStatus = qs('auth-status');
    
    if (user) {
        authStatus.textContent = `Logged in as: ${user.email}`;
        
        // 1. Prefill Contact Details (Email is direct from Auth)
        qs('firebase-email').value = user.email || ''; 
        loadUserDetails(user.uid); 
        
    } else {
        authStatus.textContent = 'Guest checkout (Login for saved addresses)';
    }
});

async function loadUserDetails(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const data = userDoc.data();
            
            // 2. Prefill Contact Details (Name and Phone)
            qs('firebase-name').value = data.name || '';
            qs('firebase-phone').value = data.phone || '';
            
            // 3. Populate Saved Addresses
            if (data.savedAddresses && data.savedAddresses.length > 0) {
                const select = qs('saved-address-select');
                
                // Clear existing options except the default 'Use New Address Below'
                select.innerHTML = '<option value="new">Use New Address Below</option>'; 
                
                data.savedAddresses.forEach((addr, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = `${addr.addressLine}, ${addr.city} (${addr.pincode})`;
                    
                    // If a 'default' property exists and is true, select this address
                    if (addr.isDefault) {
                        option.selected = true;
                        prefillAddressInputs(addr);
                    }
                    select.appendChild(option);
                });
                
                // Event listener to switch address inputs when dropdown changes
                select.addEventListener('change', (e) => {
                    if (e.target.value === 'new') {
                        prefillAddressInputs(null);
                    } else {
                        prefillAddressInputs(data.savedAddresses[e.target.value]);
                    }
                });
            }
        }
    } catch (error) {
        console.error("Could not load user details for checkout:", error);
    }
}

/** Helper to update delivery inputs based on selected address object */
function prefillAddressInputs(addr) {
    qs('address').value = addr ? addr.addressLine || '' : '';
    qs('city').value = addr ? addr.city || '' : '';
    qs('zip').value = addr ? addr.pincode || '' : '';
}

// ================= UI & FORM LOGIC =================

/** Toggles visibility and required attributes between Delivery and Dine-In forms. */
window.toggleService = () => {
    const deliveryDetails = qs('delivery-details');
    const dineinDetails = qs('dinein-details');
    const isDelivery = qs('delivery-opt').checked;
    
    currentServiceType = isDelivery ? 'delivery' : 'dinein';

    // Toggle Visibility
    if (deliveryDetails) deliveryDetails.style.display = isDelivery ? 'block' : 'none';
    if (dineinDetails) dineinDetails.style.display = isDelivery ? 'none' : 'block';

    // Update Required Fields for Delivery vs Dine-in
    qsa('#delivery-details input, #delivery-details textarea').forEach(input => {
        input.required = isDelivery;
        if (!isDelivery) input.value = ''; // Clear non-required fields
    });
    qsa('#dinein-details input').forEach(input => {
        input.required = !isDelivery;
        if (isDelivery) input.value = input.type === 'number' ? 2 : ''; // Set defaults or clear
    });
    
    calculateTotal();
};

/** Selects a payment method, updates UI, and shows/hides corresponding input fields. */
window.selectPayment = (method) => {
    currentPaymentMethod = method;
    
    qsa('.payment-card').forEach(card => card.classList.remove('selected'));
    qs(`opt-${method}`).classList.add('selected');

    qsa('.payment-inputs').forEach(inputBlock => inputBlock.style.display = 'none');
    qs(`pay-${method}`).style.display = 'block';

    // Update Pay Button Text
    calculateTotal();
};

/** Handles form submission and simulates payment processing. */
window.processOrder = async (e) => {
    e.preventDefault();
    
    const checkoutForm = qs('checkoutForm');
    if (!checkoutForm.checkValidity()) {
        checkoutForm.reportValidity();
        return;
    }
    
    const submitBtn = qs('pay-btn');
    submitBtn.disabled = true;
    
    qs('processing-overlay').style.display = 'flex';

    // Gather order data
    const orderData = {
        userId: currentUser ? currentUser.uid : 'GUEST_' + Date.now(),
        customerEmail: qs('firebase-email').value,
        customerName: qs('firebase-name').value,
        customerPhone: qs('firebase-phone').value,
        orderItems: currentCart.map(item => ({ 
            id: item.id, name: item.name, quantity: item.qty || item.quantity || 1, price: item.price 
        })),
        total: totalAmount,
        service: currentServiceType,
        details: currentServiceType === 'delivery' ? {
            address: qs('address').value,
            city: qs('city').value,
            zip: qs('zip').value,
            instructions: qs('instructions').value,
        } : {
            people: qs('dinein-people').value,
            time: qs('dinein-time').value,
        },
        paymentMethod: currentPaymentMethod, 
        status: 'New', 
        timestamp: new Date(),
    };
    
    try {
        const docRef = await addDoc(collection(db, "orders"), orderData);
        console.log("Order placed successfully with ID:", docRef.id);
        
        // Show success modal
        qs('processing-overlay').style.display = 'none';
        qs('success-modal').style.display = 'flex';

    } catch (error) {
        console.error("Error placing order:", error);
        alert(`Order submission failed. Please try again. Error: ${error.message}`);
        
        qs('processing-overlay').style.display = 'none';
        submitBtn.disabled = false;
    }
};

/** Final step after order success: clears cart and redirects to the menu. */
window.finishOrder = () => {
    // Clear the cart from local storage
    localStorage.removeItem('foodHeavenCart');
    // Redirect
    window.location.href = 'menu.html';
};


// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Load: Check cart and render summary (and calculate initial totals)
    renderCartSummary(); 
    
    // 2. Set initial time for dine-in if present
    const timeInput = qs('dinein-time');
    if (timeInput) {
        timeInput.value = new Date().toTimeString().split(' ')[0].substring(0, 5);
    }
    
    // 3. Initial setup for delivery/dine-in visibility and requirements
    // Set the state based on the checked radio button
    const deliveryOpt = qs('delivery-opt');
    const dineinOpt = qs('dinein-opt');
    if (deliveryOpt && deliveryOpt.checked) {
        toggleService(); 
        selectPayment('card');
    } else if (dineinOpt && dineinOpt.checked) {
        toggleService();
        selectPayment('card');
    }

});

// Expose functions globally for use in HTML event handlers
window.toggleService = toggleService;
window.selectPayment = selectPayment;
window.processOrder = window.processOrder;