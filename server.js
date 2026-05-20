const nodemailer = require("nodemailer");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const path = require("node:path");
const fs = require("fs");

const { neon } = require("@neondatabase/serverless");

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// NEON DB
// =========================

const sql = neon("postgresql://neondb_owner:npg_LhkUKmMSW7e8@ep-lively-union-aq4vfppe-pooler.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require");

// =========================
// MAIL
// =========================

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
app.use("/", express.static(path.join(process.cwd(), "content")));
app.use("/", express.static(path.join(process.cwd(), "html")));

app.use((req, res, next) => {
    console.log(`Incoming request for ${req.originalUrl}`);
    next();
});

app.get("/", (req, res) => {
    fs.readFile(
        path.join(process.cwd(), "html", "index.html"),
        (error, file) => {
            console.log("here", error);

            res.writeHead(200, {
                "Content-Type": "text/html"
            });

            res.end(file);
        }
    );
});

// =========================
// DB HELPERS
// =========================

async function query(text, params = []) {
    return sql.query(text, params);
}

async function one(text, params = []) {
    const rows = await sql.query(text, params);

    if (rows.length === 0) {
        throw new Error("No rows found");
    }

    return rows[0];
}

async function oneOrNone(text, params = []) {
    const rows = await sql.query(text, params);
    return rows[0] || null;
}

async function any(text, params = []) {
    return sql.query(text, params);
}

async function none(text, params = []) {
    await sql.query(text, params);
}

// =========================
// INIT DB
// =========================

async function initDb() {
    await none(`
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

    const admin = await oneOrNone(
        "SELECT * FROM users WHERE role = $1",
        ["admin"]
    );

    if (!admin) {
        const hash = await bcrypt.hash("1", 10);

        await none(`
            INSERT INTO users
            (
                name,
                email,
                password,
                phone,
                role
            )
            VALUES ($1, $2, $3, $4, $5)
        `, [
            "Administrator",
            "1",
            hash,
            "0700000000",
            "admin"
        ]);
    }

    console.log("Baza de date PostgreSQL este pregătită.");
}

initDb().catch(err => {
    console.log("EROARE DB:", err);
});

// =========================
// LOGIN
// =========================

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const userFull = await oneOrNone(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (!userFull) {
            return res.status(401).json({
                message: "Email sau parolă greșită."
            });
        }

        const passwordOk = await bcrypt.compare(
            password,
            userFull.password
        );

        if (!passwordOk) {
            return res.status(401).json({
                message: "Email sau parolă greșită."
            });
        }

        res.json({
            user: {
                id: userFull.id,
                name: userFull.name,
                email: userFull.email,
                role: userFull.role
            }
        });

    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Eroare server."
        });
    }
});

// =========================
// REGISTER
// =========================

app.post("/api/register", async (req, res) => {
    const { name, email, password, phone } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await none(`
            INSERT INTO users
            (
                name,
                email,
                password,
                phone,
                role
            )
            VALUES ($1, $2, $3, $4, $5)
        `, [
            name,
            email,
            hashedPassword,
            phone,
            "user"
        ]);

        const user = await one(`
            SELECT
                id,
                name,
                email,
                role
            FROM users
            WHERE email = $1
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

        res.json({
            message: "Cont creat.",
            user
        });

    } catch (error) {
        console.log(error);

        res.status(400).json({
            message: "Email existent sau eroare la creare cont."
        });
    }
});

// =========================
// PRODUCTS
// =========================

app.get("/api/products", async (req, res) => {
    try {
        const products = await any(`
            SELECT *
            FROM products
            ORDER BY id DESC
        `);

        res.json(products);

    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Eroare server."
        });
    }
});

app.post("/api/products", async (req, res) => {
    try {
        const p = req.body;

        await none(`
            INSERT INTO products
            (
                name,
                price,
                oldPrice,
                image,
                description,
                longDescription,
                category,
                subcategory,
                stock,
                rating
            )
            VALUES
                (
                    $1,$2,$3,$4,$5,
                    $6,$7,$8,$9,$10
                )
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

        res.json({
            message: "Produs adăugat"
        });

    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Eroare server."
        });
    }
});

// =========================
// START SERVER
// =========================

if (process.env.NODE_ENV !== "production") {
    const server = app.listen(PORT, () => {
        console.log(`Server pornit pe http://localhost:${PORT}`);
    });

    server.on("error", (error) => {
        console.log("EROARE SERVER:", error);
    });
}

module.exports = app;