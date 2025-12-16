# 🍽️ Food Heaven – Multi-Cuisine Ordering System

**Food Heaven** is a production-ready **Single Page Application (SPA)** that demonstrates advanced front-end development, structured state management, and secure **Firebase integration** for authentication, data storage, and order processing.

The system simulates a real-world online food ordering platform where menu items are **managed by an Admin module**, dynamically served to users, and processed through a complete checkout and billing workflow.

---

## 🚀 Project Overview

Food Heaven is a modern, client-side **multi-cuisine restaurant ordering platform** inspired by popular food delivery applications.  
Menu items are **uploaded and maintained via an Admin interface**, stored in **Firebase Firestore**, and rendered dynamically on the user interface in real time.

The application provides a **persistent shopping cart and wishlist**, secure user authentication, and a **dynamic checkout system** with automatic bill generation and download support.  
It also features a fully responsive UI with **Light/Dark mode**, ensuring accessibility and a consistent user experience across devices.

The project is implemented using **Pure Vanilla JavaScript (ES Modules)** without external frameworks, emphasizing performance optimization, modular architecture, and industry best practices.

---
## ✨ Key Features

- 🔄 **Admin-Managed Dynamic Menu**  
  Menu items are uploaded and managed through an **Admin interface** and dynamically fetched from **Firebase Firestore** in real time.

- 📌 **Dual Sticky Navigation System**  
  Includes a primary navbar and a secondary sticky category bar with **active section highlighting** based on user scroll position.

- 🛒 **Persistent Shopping Cart**  
  Cart data (items, quantity, price) is stored in **Local Storage**, ensuring persistence across page refreshes and sessions.

- ❤️ **Cross-Device Wishlist Synchronization**  
  Users can save favorite items, which are stored in **Firebase Firestore** and synchronized across multiple devices.

- 👤 **Secure User Authentication & Profile Management**  
  Firebase Authentication is used to manage user sessions, profile sidebar access, and protected features.

- 💳 **Dynamic Checkout & Billing System**  
  Checkout page calculates **subtotal, tax, and delivery charges** dynamically based on cart contents and service type.

- 🧾 **Downloadable Invoice / Bill Generation**  
  After order confirmation, users can **download the generated bill** for reference and record keeping.

- 🌗 **Theme Toggle with Preference Persistence**  
  Light and Dark mode support with user preference saved using **Local Storage**.

- 🔐 **Secure Configuration & Best Practices**  
  Sensitive Firebase configuration is stored in a local file and protected using `.gitignore`.

---


## 🛠️ Technology Stack

| Category | Technology |
|--------|-----------|
| Frontend | HTML5, CSS3 (Flexbox, Grid) |
| Client Logic | Vanilla JavaScript (ES Modules) |
| Backend (BaaS) | Firebase |
| Database | Firebase Firestore |
| Authentication | Firebase Auth |
| State Persistence | Local Storage |
| Version Control | Git & GitHub |

---

## 📸 Screenshots

> 📌 All screenshots are captured from the live application and demonstrate key features and UI states.

---

### 🏠 Home & Menu Page

<p align="center">
  <img src="https://github.com/user-attachments/assets/17bfb0b2-1ded-4581-8211-31a9b15aa56e" alt="Home Menu Page" width="90%">
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/2dee55c1-b8e7-4193-b59a-43f86d54f7ff" alt="Menu Categories View" width="90%">
</p>

---

### 📌 Sticky Category Navigation

<p align="center">
  <img src="https://github.com/user-attachments/assets/69b83676-fc11-41f7-adb6-2730bc8c65db" alt="Sticky Category Navigation" width="90%">
</p>

---

### 🛒 Cart Sidebar (Real-Time Updates)

<p align="center">
  <img src="https://github.com/user-attachments/assets/b4d76a81-7501-4dd1-8a87-3620dea9becb" alt="Cart Sidebar" width="90%">
</p>

---

### ❤️ Profile Sidebar & Wishlist

<p align="center">
  <img src="https://github.com/user-attachments/assets/d05d0722-92ac-4b9a-a934-69d97ce6a63a" alt="Profile Sidebar and Wishlist" width="90%">
</p>

---

### 💳 Checkout Page

<p align="center">
  <img src="https://github.com/user-attachments/assets/07ac81b8-2a0b-4064-b360-271d79b916b1" alt="Checkout Page" width="90%">
</p>

---
### 🔐 Firebase Configuration

```js
authDomain: "YOUR_AUTH_DOMAIN",
projectId: "YOUR_PROJECT_ID",
storageBucket: "YOUR_STORAGE_BUCKET",
messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
appId: "YOUR_APP_ID"
};




### 📚 Learning Outcomes

- Understanding of **Single Page Application (SPA)** architecture using Vanilla JavaScript  
- Integration of **Firebase Authentication and Firestore**  
- Client-side **state management** using Local Storage  
- Secure handling of **API keys and configuration files**  
- Implementation of a **real-world checkout and billing workflow**

---

### 🔮 Future Enhancements

- Online payment gateway integration (Razorpay / Stripe)  
- Admin dashboard for menu and order management  
- Order status tracking with real-time notifications  
- Progressive Web App (PWA) support for offline access and installability  
