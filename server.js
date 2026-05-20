const nodemailer = require("nodemailer");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const path = require("node:path");
const fs = require("fs");
const pgp = require("pg-promise")();

const app = express();
const PORT = process.env.PORT || 3000;

const db = pgp(process.env.DATABASE_URL,  {
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER || "megashopbg8@gmail.com",
        pass: process.env.EMAIL_PASS || "PUNE_APP_PASSWORD_AICI"
    }
});

app.use(cors());
app.use(express.json());

app.use("/css", express.static(path.join(process.cwd(), "css")));
app.use("/js", express.static(path.join(process.cwd(), "js")));

async function initDb() {
    await db.none(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            phone TEXT,
            role TEXT
        );

        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT,
            price REAL,
            oldPrice REAL,
            image TEXT,
            description TEXT,
            longDescription TEXT,
            category TEXT,
            subcategory TEXT,
            stock INTEGER,
            rating INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS favorites (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            product_id INTEGER
        );

        CREATE TABLE IF NOT EXISTS cart (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            product_id INTEGER,
            quantity INTEGER
        );

        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            email TEXT,
            fullName TEXT,
            county TEXT,
            city TEXT,
            address TEXT,
            phone TEXT,
            payment TEXT,
            notes TEXT,
            total REAL,
            status TEXT DEFAULT 'Nouă',
            created_at TEXT
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            order_id INTEGER,
            product_id INTEGER,
            product_name TEXT,
            product_image TEXT,
            price REAL,
            quantity INTEGER
        );

        CREATE TABLE IF NOT EXISTS password_resets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            token TEXT UNIQUE,
            expires_at BIGINT
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id SERIAL PRIMARY KEY,
            product_id INTEGER,
            user_id INTEGER,
            user_name TEXT,
            rating INTEGER,
            comment TEXT,
            created_at TEXT
        );
    `);

    const admin = await db.oneOrNone("SELECT * FROM users WHERE role='admin'");

    if (!admin) {
        const hash = await bcrypt.hash("1", 10);
        await db.none(`
            INSERT INTO users (name, email, password, phone, role)
            VALUES ($1, $2, $3, $4, $5)
        `, ["Administrator", "1", hash, "0700000000", "admin"]);
    }

    console.log("Baza de date PostgreSQL este pregătită.");
}

initDb().catch(err => console.log("EROARE DB:", err));

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    const userFull = await db.oneOrNone("SELECT * FROM users WHERE email=$1", [email]);

    if (!userFull) {
        return res.status(401).json({ message: "Email sau parolă greșită." });
    }

    const passwordOk = await bcrypt.compare(password, userFull.password);

    if (!passwordOk) {
        return res.status(401).json({ message: "Email sau parolă greșită." });
    }

    res.json({
        user: {
            id: userFull.id,
            name: userFull.name,
            email: userFull.email,
            role: userFull.role
        }
    });
});

app.post("/api/register", async (req, res) => {
    const { name, email, password, phone } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.none(`
            INSERT INTO users (name, email, password, phone, role)
            VALUES ($1, $2, $3, $4, $5)
        `, [name, email, hashedPassword, phone, "user"]);

        const user = await db.one(`
            SELECT id, name, email, role FROM users WHERE email=$1
        `, [email]);

        await transporter.sendMail({
            from: "MegaShop <megashopbg8@gmail.com>",
            to: email,
            subject: "Cont creat MegaShop",
            html: `
                <h2>Bine ai venit, ${name}!</h2>
                <p>Contul tău MegaShop a fost creat cu succes.</p>
            `
        });

        res.json({ message: "Cont creat.", user });
    } catch (error) {
        console.log(error);
        res.status(400).json({ message: "Email existent sau eroare la creare cont." });
    }
});

app.get("/api/products", async (req, res) => {
    const products = await db.any("SELECT * FROM products ORDER BY id DESC");
    res.json(products);
});

app.post("/api/products", async (req, res) => {
    const p = req.body;

    await db.none(`
        INSERT INTO products 
        (name, price, oldPrice, image, description, longDescription, category, subcategory, stock, rating)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [
        p.name,
        p.price,
        p.oldPrice,
        p.image,
        p.description,
        p.longDescription,
        p.category,
        p.subcategory,
        p.stock,
        p.rating || 0
    ]);

    res.json({ message: "Produs adăugat" });
});

app.get("/api/products/:id", async (req, res) => {
    const product = await db.oneOrNone("SELECT * FROM products WHERE id=$1", [req.params.id]);

    if (!product) {
        return res.status(404).json({ message: "Produs inexistent" });
    }

    res.json(product);
});

app.delete("/api/products/:id", async (req, res) => {
    await db.none("DELETE FROM products WHERE id=$1", [req.params.id]);
    res.json({ message: "Produs șters" });
});

app.put("/api/products/:id", async (req, res) => {
    const p = req.body;

    await db.none(`
        UPDATE products
        SET name=$1, price=$2, oldPrice=$3, image=$4, description=$5,
            longDescription=$6, category=$7, subcategory=$8, stock=$9
        WHERE id=$10
    `, [
        p.name,
        p.price,
        p.oldPrice,
        p.image,
        p.description,
        p.longDescription,
        p.category,
        p.subcategory,
        p.stock,
        req.params.id
    ]);

    res.json({ message: "Produs actualizat" });
});

app.put("/api/products/:id/stock", async (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Cantitate invalidă." });
    }

    await db.none("UPDATE products SET stock = stock + $1 WHERE id=$2", [amount, req.params.id]);

    res.json({ message: "Stoc actualizat." });
});

app.put("/api/products/:id/stock/remove", async (req, res) => {
    const { amount } = req.body;

    const product = await db.oneOrNone("SELECT stock FROM products WHERE id=$1", [req.params.id]);

    if (!product) {
        return res.status(404).json({ message: "Produsul nu există." });
    }

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Cantitate invalidă." });
    }

    if (product.stock - amount < 0) {
        return res.status(400).json({ message: "Nu poți avea stoc negativ." });
    }

    await db.none("UPDATE products SET stock = stock - $1 WHERE id=$2", [amount, req.params.id]);

    res.json({ message: "Stoc scăzut." });
});

app.put("/api/products/:id/price", async (req, res) => {
    const { price } = req.body;

    if (!price || price <= 0) {
        return res.status(400).json({ message: "Preț invalid." });
    }

    await db.none("UPDATE products SET price=$1 WHERE id=$2", [price, req.params.id]);

    res.json({ message: "Preț actualizat." });
});

app.get("/api/favorites/:id", async (req, res) => {
    const fav = await db.any(`
        SELECT products.* FROM favorites
        JOIN products ON products.id = favorites.product_id
        WHERE favorites.user_id=$1
    `, [req.params.id]);

    res.json(fav);
});

app.post("/api/favorites", async (req, res) => {
    const { userId, productId } = req.body;

    const exists = await db.oneOrNone(`
        SELECT * FROM favorites WHERE user_id=$1 AND product_id=$2
    `, [userId, productId]);

    if (exists) {
        await db.none(`
            DELETE FROM favorites WHERE user_id=$1 AND product_id=$2
        `, [userId, productId]);
    } else {
        await db.none(`
            INSERT INTO favorites (user_id, product_id)
            VALUES ($1,$2)
        `, [userId, productId]);
    }

    res.json({ message: "OK" });
});

app.get("/api/cart/:id", async (req, res) => {
    const cart = await db.any(`
        SELECT cart.id as "cartId", products.*, cart.quantity
        FROM cart
        JOIN products ON products.id = cart.product_id
        WHERE cart.user_id=$1
    `, [req.params.id]);

    res.json(cart);
});

app.post("/api/cart", async (req, res) => {
    const { userId, productId } = req.body;

    const existing = await db.oneOrNone(`
        SELECT * FROM cart WHERE user_id=$1 AND product_id=$2
    `, [userId, productId]);

    if (existing) {
        await db.none(`
            UPDATE cart SET quantity = quantity + 1 WHERE id=$1
        `, [existing.id]);
    } else {
        await db.none(`
            INSERT INTO cart (user_id, product_id, quantity)
            VALUES ($1,$2,1)
        `, [userId, productId]);
    }

    res.json({ message: "OK" });
});

app.delete("/api/cart/:cartId", async (req, res) => {
    await db.none("DELETE FROM cart WHERE id=$1", [req.params.cartId]);
    res.json({ message: "Produs șters din coș." });
});

app.post("/api/forgot-password", async (req, res) => {
    const { email } = req.body;

    const user = await db.oneOrNone("SELECT * FROM users WHERE email=$1", [email]);

    if (!user) {
        return res.status(404).json({ message: "Emailul nu există." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 15 * 60 * 1000;

    await db.none("DELETE FROM password_resets WHERE user_id=$1", [user.id]);

    await db.none(`
        INSERT INTO password_resets (user_id, token, expires_at)
        VALUES ($1,$2,$3)
    `, [user.id, token, expiresAt]);

    const resetLink = `http://127.0.0.1:5500/reset-password.html?token=${token}`;

    await transporter.sendMail({
        from: "MegaShop <megashopbg8@gmail.com>",
        to: email,
        subject: "Resetare parolă MegaShop",
        html: `
            <h2>Resetare parolă</h2>
            <p>Apasă pe linkul de mai jos:</p>
            <a href="${resetLink}">${resetLink}</a>
            <p>Expiră în 15 minute.</p>
        `
    });

    res.json({ message: "Link trimis pe email." });
});

app.post("/api/reset-password", async (req, res) => {
    const { token, password } = req.body;

    const reset = await db.oneOrNone(`
        SELECT * FROM password_resets WHERE token=$1
    `, [token]);

    if (!reset) {
        return res.status(400).json({ message: "Token invalid." });
    }

    if (Date.now() > Number(reset.expires_at)) {
        return res.status(400).json({ message: "Token expirat." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.none("UPDATE users SET password=$1 WHERE id=$2", [hashedPassword, reset.user_id]);
    await db.none("DELETE FROM password_resets WHERE user_id=$1", [reset.user_id]);

    res.json({ message: "Parola a fost resetată!" });
});

app.get("/api/products/:id/reviews", async (req, res) => {
    const reviews = await db.any(`
        SELECT * FROM reviews WHERE product_id=$1 ORDER BY id DESC
    `, [req.params.id]);

    res.json(reviews);
});

app.post("/api/products/:id/reviews", async (req, res) => {
    const { userId, userName, rating, comment } = req.body;

    if (!rating || !comment) {
        return res.status(400).json({ message: "Completează toate câmpurile." });
    }

    const date = new Date().toLocaleString();

    await db.none(`
        INSERT INTO reviews (product_id, user_id, user_name, rating, comment, created_at)
        VALUES ($1,$2,$3,$4,$5,$6)
    `, [req.params.id, userId, userName, rating, comment, date]);

    res.json({ message: "Review adăugat!" });
});

app.get("/api/products/:id/related", async (req, res) => {
    const product = await db.oneOrNone("SELECT * FROM products WHERE id=$1", [req.params.id]);

    if (!product) return res.json([]);

    const related = await db.any(`
        SELECT * FROM products
        WHERE category=$1 AND id<>$2
        LIMIT 4
    `, [product.category, product.id]);

    res.json(related);
});

app.post("/api/orders", async (req, res) => {
    const o = req.body;

    const cartItems = await db.any(`
        SELECT cart.*, products.name, products.image, products.price
        FROM cart
        JOIN products ON products.id = cart.product_id
        WHERE cart.user_id=$1
    `, [o.userId]);

    if (cartItems.length === 0) {
        return res.status(400).json({ message: "Coșul este gol." });
    }

    const date = new Date().toLocaleString();

    const result = await db.one(`
        INSERT INTO orders 
        (user_id, email, fullName, county, city, address, phone, payment, notes, total, status, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id
    `, [
        o.userId,
        o.email,
        o.fullName,
        o.county,
        o.city,
        o.address,
        o.phone,
        o.payment,
        o.notes,
        o.total,
        "Nouă",
        date
    ]);

    const orderId = result.id;

    for (const item of cartItems) {
        await db.none(`
            INSERT INTO order_items 
            (order_id, product_id, product_name, product_image, price, quantity)
            VALUES ($1,$2,$3,$4,$5,$6)
        `, [
            orderId,
            item.product_id,
            item.name,
            item.image,
            item.price,
            item.quantity
        ]);

        await db.none(`
            UPDATE products SET stock = stock - $1 WHERE id=$2
        `, [item.quantity, item.product_id]);
    }

    await db.none("DELETE FROM cart WHERE user_id=$1", [o.userId]);

    await transporter.sendMail({
        from: "MegaShop <megashopbg8@gmail.com>",
        to: o.email,
        subject: "Comanda ta MegaShop a fost plasată",
        html: `
            <h2>Comandă plasată cu succes!</h2>
            <p>Comanda #${orderId} a fost înregistrată.</p>
            <p>Total: <strong>${o.total} lei</strong></p>
            <a href="http://127.0.0.1:5500/my-orders.html?orderId=${orderId}">Vezi comanda ta</a>
        `
    });

    res.json({ message: "Comandă plasată!", orderId });
});

app.get("/api/orders", async (req, res) => {
    const orders = await db.any("SELECT * FROM orders ORDER BY id DESC");
    res.json(orders);
});

app.get("/api/orders/:id", async (req, res) => {
    const order = await db.oneOrNone("SELECT * FROM orders WHERE id=$1", [req.params.id]);

    if (!order) {
        return res.status(404).json({ message: "Comanda nu există." });
    }

    res.json(order);
});

app.get("/api/orders/:id/items", async (req, res) => {
    const items = await db.any("SELECT * FROM order_items WHERE order_id=$1", [req.params.id]);
    res.json(items);
});

app.put("/api/orders/:id/status", async (req, res) => {
    const { status } = req.body;

    const order = await db.oneOrNone("SELECT * FROM orders WHERE id=$1", [req.params.id]);

    if (!order) {
        return res.status(404).json({ message: "Comanda nu există." });
    }

    await db.none("UPDATE orders SET status=$1 WHERE id=$2", [status, req.params.id]);

    if (status === "Predată curierului") {
        await transporter.sendMail({
            from: "MegaShop <megashopbg8@gmail.com>",
            to: order.email,
            subject: "Comanda ta a fost predată curierului",
            html: `
                <h2>Comanda #${order.id} a fost predată curierului 🚚</h2>
                <p>În curând va ajunge la tine.</p>
                <a href="http://127.0.0.1:5500/my-orders.html?orderId=${order.id}">Vezi statusul comenzii</a>
            `
        });
    }

    res.json({ message: "Status actualizat." });
});

if (process.env.NODE_ENV !== "production") {
    const server = app.listen(PORT, () => {
        console.log("Server pornit pe http://localhost:3000");
    });

    server.on("error", (error) => {
        console.log("EROARE SERVER:", error);
    });
}

module.exports = app;