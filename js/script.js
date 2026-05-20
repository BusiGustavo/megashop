const API = "/api";
const newsletter = document.getElementById("newsletterSection");

let currentUser = JSON.parse(localStorage.getItem("currentUser"));
function showWelcomeMessage() {
    const box = document.getElementById("welcomeMessage");

    if (!box || !currentUser) return;

    if (currentUser.name && currentUser.name.toLowerCase() === "guille") {
        box.innerHTML = "👋 Bună, Guille! Bine ai revenit în contul tău MegaShop!";
    } else {
        box.innerHTML = "👋 Bună, " + currentUser.name + "! Bine ai revenit!";
    }
}

async function getProducts() {
    const res = await fetch(`${API}/products`);
    return await res.json();
}

function requireLogin() {
    if (!currentUser) {
        alert("Trebuie să fii logat!");
        window.location.href = "login.html";
        return false;
    }
    return true;
}

function isFavorite(productId) {
    let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
    return favorites.some(p => p.id === productId);
}

async function loadFavoritesCache() {
    if (!currentUser) return;

    const res = await fetch(`${API}/favorites/${currentUser.id}`);
    const favorites = await res.json();

    localStorage.setItem("favorites", JSON.stringify(favorites));
}


async function addToCart(productId, button) {
    if (!requireLogin()) return;

    await fetch(`${API}/cart`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            userId: currentUser.id,
            productId: productId
        })
    });

    button.innerText = "Adăugat ✓";
    button.style.background = "#16a34a";

    setTimeout(() => {
        button.innerText = "Adaugă în coș";
        button.style.background = "#1237ff";
    }, 1200);
}

async function toggleFavorite(productId) {
    currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (!currentUser || !currentUser.id) {
        alert("Trebuie să te loghezi din nou!");
        window.location.href = "login.html";
        return;
    }

    const res = await fetch(`${API}/favorites`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            userId: currentUser.id,
            productId: productId
        })
    });

    const data = await res.json();

    if (!res.ok) {
        alert(data.message || "Eroare la favorite.");
        return;
    }

    await loadFavoritesCache();
    await renderProducts();
}

function setupSearchAndSort() {
    const searchInput = document.getElementById("searchInput");
    const sortSelect = document.getElementById("sortSelect");
    const grid = document.getElementById("productsGrid");

    if (searchInput) {
        searchInput.addEventListener("input", function () {
            let value = searchInput.value.toLowerCase();

            document.querySelectorAll(".product-card").forEach(card => {
                card.style.display = card.dataset.name.includes(value) ? "block" : "none";
            });
        });
    }

    if (sortSelect && grid) {
        sortSelect.addEventListener("change", function () {
            let cards = Array.from(document.querySelectorAll(".product-card"));

            if (sortSelect.value === "low") {
                cards.sort((a, b) => Number(a.dataset.price) - Number(b.dataset.price));
            }

            if (sortSelect.value === "high") {
                cards.sort((a, b) => Number(b.dataset.price) - Number(a.dataset.price));
            }

            cards.forEach(card => grid.appendChild(card));
        });
    }
}

function logout() {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("favorites");
    sessionStorage.removeItem("welcomeShown");
    window.location.href = "index.html";
}
function renderUserMenu() {
    const box = document.getElementById("userActions");
    if (!box) return;

    if (!currentUser) {
        box.innerHTML = `
            <a href="login.html">👤 Cont</a>
            <a href="favorite.html">❤️ Favorite</a>
            <a href="cos.html">🛒 Coș</a>
        `;
    } else {
        box.innerHTML = `
            <span class="user-name">👋 ${currentUser.name}</span>
            <a href="favorite.html">❤️ Favorite</a>
            <a href="cos.html">🛒 Coș</a>
            <button onclick="logout()" class="logout-btn">Logout</button>
        `;
    }
}

function renderUserMenu() {
    const box = document.getElementById("userActions");
    if (!box) return;

    let currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (!currentUser) {
        box.innerHTML = `
            <a href="login.html">👤 Cont</a>
            <a href="favorite.html">❤️ Favorite</a>
            <a href="cos.html">🛒 Coș</a>
        `;
    } else {
        box.innerHTML = `
           
            <a href="favorite.html">❤️ Favorite</a>
            <a href="cos.html">🛒 Coș</a>

            ${currentUser.role === "admin" ? `
                <a href="admin.html" style="color:#ffcc00;font-weight:bold;">⚙️ Admin</a>
            ` : ""}

            <button onclick="logout()" class="logout-btn">Logout</button>
        `;
    }
}

let allProductsCache = [];

async function renderProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    await loadFavoritesCache();

    const products = await getProducts();
    allProductsCache = products;

    displayProducts(products);
}

function displayProducts(products) {
    const grid = document.getElementById("productsGrid");
    grid.innerHTML = "";

    if (products.length === 0) {
        grid.innerHTML = "<p>Nu există produse în această categorie.</p>";
        return;
    }

    products.forEach(product => {
        grid.innerHTML += `
            <div class="product-card" data-id="${product.id}" data-name="${product.name.toLowerCase()}" data-price="${product.price}">
                ${product.oldPrice > product.price ? `<span class="discount">Ofertă</span>` : ""}

                <button class="favorite-btn ${isFavorite(product.id) ? "active" : ""}" onclick="toggleFavorite(${product.id})">
                    ${isFavorite(product.id) ? "♥" : "♡"}
                </button>

                <a href="produs.html?id=${product.id}">
                    <img src="${product.image}" alt="${product.name}">
                </a>

                <h3>
                    <a href="produs.html?id=${product.id}">${product.name}</a>
                </h3>

                <p>${product.description}</p>

                <div class="price-row">
                    <span class="old-price">${product.oldPrice} lei</span>
                    <span class="price">${product.price} lei</span>
                </div>

                ${
                    product.stock <= 0
                    ? `<button class="cart-btn out-of-stock-btn" disabled>Stoc epuizat</button>`
                    : `<button class="cart-btn" onclick="addToCart(${product.id}, this)">Adaugă în coș</button>`
                }
            </div>
        `;
    });
}

function filterCategory(category) {
    const hero = document.getElementById("heroSection");
    const categories = document.getElementById("categoriesSection");
    const benefits = document.getElementById("benefitsSection");
    const newsletter = document.getElementById("newsletterSection");

    if (hero) hero.style.display = "none";
    if (categories) categories.style.display = "none";
    if (benefits) benefits.style.display = "none";
    if (newsletter) newsletter.style.display = "none";

    const text = category.toLowerCase();

    const filtered = allProductsCache.filter(product => {
        const cat = (product.category || "").toLowerCase();
        const sub = (product.subcategory || "").toLowerCase();
        const name = (product.name || "").toLowerCase();

        if (text === "telefoane") {
            return sub.includes("telefon") || cat.includes("telefon") || name.includes("telefon");
        }

        if (text === "laptopuri") {
            return sub.includes("laptop") || cat.includes("laptop") || name.includes("laptop");
        }

        return cat.includes(text) || sub.includes(text) || name.includes(text);
    });

    displayProducts(filtered);

    document.getElementById("productsGrid").scrollIntoView({
        behavior: "smooth"
    });
}
function showOffers() {
    const offers = allProductsCache.filter(product =>
        Number(product.oldPrice) > Number(product.price)
    );

    displayProducts(offers);

    document.getElementById("productsGrid").scrollIntoView({
        behavior: "smooth"
    });
}


function toggleCategoryMenu() {
    const nav = document.querySelector(".category-nav");
    const menu = document.getElementById("categoryLinks");

    if (nav) nav.classList.toggle("mobile-open");
    if (menu) menu.classList.toggle("show");
}
renderProducts();
setupSearchAndSort();
showWelcomeMessage();
renderUserMenu();
showLoginPopup();