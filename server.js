const nodemailer = require("nodemailer");
const express = require("express");
const cors = require("cors");
// const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const app = express();
const PORT = process.env.PORT || 3000;
const crypto = require("crypto");
const fs = require("fs")
const path = require("node:path");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "megashopbg8@gmail.com",
        pass: "fnksvegkakljuxix"
    }
});

app.use(cors());
app.use(express.json());
app.use("/css", express.static("../css"))
app.use("/js", express.static("../js"))
app.use("/", express.static("../html"))

// const db = new Database("magazin.db");

app.get("/", (req, res) => {
    fs.readFile(path.join(process.cwd(), "html", "index.html"), (error, file) => {
        res.writeHead(200, {"Content-Type": "text/html"})
        res.end(file)
    })
})

// USERS
// db.exec(`
// CREATE TABLE IF NOT EXISTS users (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     name TEXT,
//     email TEXT UNIQUE,
//     password TEXT,
//     phone TEXT,
//     role TEXT
// );
// `);

// PRODUCTS
// db.exec(`
// CREATE TABLE IF NOT EXISTS products (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     name TEXT,
//     price REAL,
//     oldPrice REAL,
//     image TEXT,
//     description TEXT,
//     longDescription TEXT,
//     category TEXT,
//     stock INTEGER,
//     rating INTEGER
// );
// `);

// FAVORITES
// db.exec(`
// CREATE TABLE IF NOT EXISTS favorites (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     user_id INTEGER,
//     product_id INTEGER
// );
// `);

// CART
// db.exec(`
// CREATE TABLE IF NOT EXISTS cart (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     user_id INTEGER,
//     product_id INTEGER,
//     quantity INTEGER
// );
// `);

// ORDERS
// db.exec(`
// CREATE TABLE IF NOT EXISTS orders (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     user_id INTEGER,
//     email TEXT,
//     fullName TEXT,
//     county TEXT,
//     city TEXT,
//     address TEXT,
//     phone TEXT,
//     payment TEXT,
//     notes TEXT,
//     total REAL,
//     status TEXT DEFAULT 'Nouă',
//     created_at TEXT
// );
// `);

// db.exec(`
// CREATE TABLE IF NOT EXISTS order_items (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     order_id INTEGER,
//     product_id INTEGER,
//     product_name TEXT,
//     product_image TEXT,
//     price REAL,
//     quantity INTEGER
// );
// `);

// db.exec(`
// CREATE TABLE IF NOT EXISTS password_resets (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     user_id INTEGER,
//     token TEXT UNIQUE,
//     expires_at INTEGER
// );
// `);

// db.exec(`
// CREATE TABLE IF NOT EXISTS reviews (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     product_id INTEGER,
//     user_id INTEGER,
//     user_name TEXT,
//     rating INTEGER,
//     comment TEXT,
//     created_at TEXT
// );
// `);


// ADMIN DEFAULT
const adminPasswordHash = bcrypt.hashSync("1", 10);

// db.prepare("DELETE FROM users WHERE role = 'admin'").run();

// db.prepare(`
// INSERT INTO users (name, email, password, phone, role)
// VALUES (?, ?, ?, ?, ?)
// `).run("Administrator", "1", adminPasswordHash, "0700000000", "admin");

console.log("ADMIN CREAT CU 1 / 1");



// LOGIN
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    const userFull = db.prepare(`
        SELECT * FROM users WHERE email = ?
    `).get(email);

    if (!userFull) {
        return res.status(401).json({ message: "Email sau parolă greșită." });
    }

    const passwordOk = await bcrypt.compare(password, userFull.password);

    if (!passwordOk) {
        return res.status(401).json({ message: "Email sau parolă greșită." });
    }

    const user = {
        id: userFull.id,
        name: userFull.name,
        email: userFull.email,
        role: userFull.role
    };

    res.json({ user });
});

// PRODUCTS
// app.get("/api/products", (req, res) => {
//     const products = db.prepare("SELECT * FROM products").all();
//     res.json(products);
// });

// ADD PRODUCT
app.post("/api/products", (req, res) => {
    const p = req.body;

    db.prepare(`
        INSERT INTO products (name, price, oldPrice, image, description, longDescription, category, stock, rating)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        p.name,
        p.price,
        p.oldPrice,
        p.image,
        p.description,
        p.longDescription,
        p.category,
        p.stock,
        p.rating
    );

    res.json({ message: "Produs adăugat" });
});

// FAVORITES
app.get("/api/favorites/:id", (req, res) => {
    const fav = db.prepare(`
        SELECT products.* FROM favorites
        JOIN products ON products.id = favorites.product_id
        WHERE favorites.user_id = ?
    `).all(req.params.id);

    res.json(fav);
});

app.post("/api/favorites", (req, res) => {
    const { userId, productId } = req.body;

    const exists = db.prepare(`
        SELECT * FROM favorites WHERE user_id=? AND product_id=?
    `).get(userId, productId);

    if (exists) {
        db.prepare(`
            DELETE FROM favorites WHERE user_id=? AND product_id=?
        `).run(userId, productId);
    } else {
        db.prepare(`
            INSERT INTO favorites (user_id, product_id)
            VALUES (?, ?)
        `).run(userId, productId);
    }

    res.json({ message: "OK" });
});

// CART
app.get("/api/cart/:id", (req, res) => {
    const cart = db.prepare(`
        SELECT cart.id as cartId, products.*, cart.quantity
        FROM cart
        JOIN products ON products.id = cart.product_id
        WHERE cart.user_id = ?
    `).all(req.params.id);

    res.json(cart);
});

app.post("/api/cart", (req, res) => {
    const { userId, productId } = req.body;

    const existing = db.prepare(`
        SELECT * FROM cart WHERE user_id=? AND product_id=?
    `).get(userId, productId);

    if (existing) {
        db.prepare(`
            UPDATE cart SET quantity = quantity + 1 WHERE id=?
        `).run(existing.id);
    } else {
        db.prepare(`
            INSERT INTO cart (user_id, product_id, quantity)
            VALUES (?, ?, 1)
        `).run(userId, productId);
    }

    res.json({ message: "OK" });
});


// RESET PASSWORD
app.post("/api/forgot-password", async (req, res) => {
    const { email } = req.body;

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user) {
        return res.status(404).json({ message: "Emailul nu există." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 15 * 60 * 1000;

    db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(user.id);

    db.prepare(`
        INSERT INTO password_resets (user_id, token, expires_at)
        VALUES (?, ?, ?)
    `).run(user.id, token, expiresAt);

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


// REGISTER
app.post("/api/register", async (req, res) => {
    const { name, email, password, phone } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.prepare(`
            INSERT INTO users (name, email, password, phone, role)
            VALUES (?, ?, ?, ?, ?)
        `).run(name, email, hashedPassword, phone, "user");

        const user = db.prepare(`
            SELECT id, name, email, role FROM users WHERE email = ?
        `).get(email);

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



app.post("/api/reset-password", async (req, res) => {
    const { token, password } = req.body;

    const reset = db.prepare(`
        SELECT * FROM password_resets WHERE token = ?
    `).get(token);

    if (!reset) {
        return res.status(400).json({ message: "Token invalid." });
    }

    if (Date.now() > reset.expires_at) {
        return res.status(400).json({ message: "Token expirat." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.prepare(`
        UPDATE users SET password = ? WHERE id = ?
    `).run(hashedPassword, reset.user_id);

    db.prepare(`
        DELETE FROM password_resets WHERE user_id = ?
    `).run(reset.user_id);

    res.json({ message: "Parola a fost resetată!" });
});


app.get("/api/products/:id", (req, res) => {
    const product = db.prepare(`
        SELECT * FROM products WHERE id = ?
    `).get(req.params.id);

    if (!product) {
        return res.status(404).json({ message: "Produs inexistent" });
    }

    res.json(product);
});

app.get("/api/products/:id/reviews", (req, res) => {
    const reviews = db.prepare(`
        SELECT * FROM reviews WHERE product_id = ?
        ORDER BY id DESC
    `).all(req.params.id);

    res.json(reviews);
});

app.post("/api/products/:id/reviews", (req, res) => {
    const { userId, userName, rating, comment } = req.body;

    if (!rating || !comment) {
        return res.status(400).json({ message: "Completează toate câmpurile." });
    }

    const date = new Date().toLocaleString();

    db.prepare(`
        INSERT INTO reviews (product_id, user_id, user_name, rating, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, userId, userName, rating, comment, date);

    res.json({ message: "Review adăugat!" });
});
app.get("/api/products/:id/related", (req, res) => {
    const product = db.prepare(`
        SELECT * FROM products WHERE id = ?
    `).get(req.params.id);

    if (!product) return res.json([]);

    const related = db.prepare(`
        SELECT * FROM products 
        WHERE category = ? AND id != ?
        LIMIT 4
    `).all(product.category, product.id);

    res.json(related);
});
app.delete("/api/products/:id", (req, res) => {
    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ message: "Produs șters" });
});


app.put("/api/products/:id", (req, res) => {
    const p = req.body;

    db.prepare(`
        UPDATE products
        SET name=?, price=?, oldPrice=?, image=?, description=?, longDescription=?, category=?, stock=?
        WHERE id=?
    `).run(
        p.name,
        p.price,
        p.oldPrice,
        p.image,
        p.description,
        p.longDescription,
        p.category,
        p.stock,
        req.params.id
    );

    res.json({ message: "Produs actualizat" });
});


app.post("/api/orders", async (req, res) => {
    const o = req.body;

    const cartItems = db.prepare(`
        SELECT cart.*, products.name, products.image, products.price
        FROM cart
        JOIN products ON products.id = cart.product_id
        WHERE cart.user_id = ?
    `).all(o.userId);

    if (cartItems.length === 0) {
        return res.status(400).json({ message: "Coșul este gol." });
    }

    const date = new Date().toLocaleString();

    const result = db.prepare(`
        INSERT INTO orders 
        (user_id, email, fullName, county, city, address, phone, payment, notes, total, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
    );

    const orderId = result.lastInsertRowid;

    cartItems.forEach(item => {
        db.prepare(`
            INSERT INTO order_items 
            (order_id, product_id, product_name, product_image, price, quantity)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            orderId,
            item.product_id,
            item.name,
            item.image,
            item.price,
            item.quantity
        );

        db.prepare(`
            UPDATE products SET stock = stock - ? WHERE id = ?
        `).run(item.quantity, item.product_id);
    });

    db.prepare("DELETE FROM cart WHERE user_id = ?").run(o.userId);

    await transporter.sendMail({
        from: "MegaShop <megashopbg8@gmail.com>",
        to: o.email,
        subject: "Comanda ta MegaShop a fost plasată",
        html: `
            <h2>Comandă plasată cu succes!</h2>
            <p>Comanda #${orderId} a fost înregistrată.</p>
            <p>Total: <strong>${o.total} lei</strong></p>
            <a href="http://127.0.0.1:5500/my-orders.html">Vezi comanda ta</a>
        `
    });

    res.json({ message: "Comandă plasată!", orderId });
});

app.get("/api/orders", (req, res) => {
    const orders = db.prepare(`
        SELECT * FROM orders ORDER BY id DESC
    `).all();

    res.json(orders);
});

app.get("/api/orders/:id/items", (req, res) => {
    const items = db.prepare(`
        SELECT * FROM order_items WHERE order_id = ?
    `).all(req.params.id);

    res.json(items);
});

app.put("/api/orders/:id/status", async (req, res) => {
    const { status } = req.body;

    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);

    if (!order) {
        return res.status(404).json({ message: "Comanda nu există." });
    }

    db.prepare(`
        UPDATE orders SET status = ? WHERE id = ?
    `).run(status, req.params.id);

    if (status === "Predată curierului") {
        await transporter.sendMail({
            from: "MegaShop <megashopbg8@gmail.com>",
            to: order.email,
            subject: "Comanda ta a fost predată curierului",
            html: `
                <h2>Comanda #${order.id} a fost predată curierului 🚚</h2>
                <p>În curând va ajunge la tine.</p>
                <a href="http://127.0.0.1:5500/my-orders.html">Vezi statusul comenzii</a>
            `
        });
    }

    res.json({ message: "Status actualizat." });
});

app.put("/api/products/:id/stock", (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Cantitate invalidă." });
    }

    db.prepare(`
        UPDATE products SET stock = stock + ? WHERE id = ?
    `).run(amount, req.params.id);

    res.json({ message: "Stoc actualizat." });
});
app.put("/api/products/:id/stock/remove", (req, res) => {
    const { amount } = req.body;

    const product = db.prepare(`
        SELECT stock FROM products WHERE id = ?
    `).get(req.params.id);

    if (!product) {
        return res.status(404).json({ message: "Produsul nu există." });
    }

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Cantitate invalidă." });
    }

    if (product.stock - amount < 0) {
        return res.status(400).json({ message: "Nu poți avea stoc negativ." });
    }

    db.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
    `).run(amount, req.params.id);

    res.json({ message: "Stoc scăzut." });
});
app.put("/api/products/:id/price", (req, res) => {
    const { price } = req.body;

    if (!price || price <= 0) {
        return res.status(400).json({ message: "Preț invalid." });
    }

    db.prepare(`
        UPDATE products SET price = ? WHERE id = ?
    `).run(price, req.params.id);

    res.json({ message: "Preț actualizat." });
});
app.delete("/api/cart/:cartId", (req, res) => {
    db.prepare("DELETE FROM cart WHERE id = ?").run(req.params.cartId);

    res.json({ message: "Produs șters din coș." });
});
const server = app.listen(PORT, () => {
    console.log("Server pornit pe http://localhost:3000");
  });
  
  server.on("error", (error) => {
    console.log("EROARE SERVER:", error);
  });