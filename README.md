# NexaMart Backend API

E-commerce backend built with Node.js, Express, and MongoDB.

---

## ✨ Features

- **Auth**: Register, login, JWT with refresh tokens, logout
- **Roles**: Customer and Admin with permissions
- **Products**: CRUD, search, filter, pagination
- **Orders**: Create, track status, stock validation
- **Payments**: Paystack integration (test mode)
- **Images**: Cloudinary upload
- **Security**: Helmet, CORS, bcrypt, validation

---

## 🛠️ Tech Stack

Node.js · Express · MongoDB · Mongoose · JWT · Cloudinary · Paystack

---

## 🚀 Quick Start

```bash
git clone <repo-url>
cd nexaMart/nexamart-backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
