require('dotenv').config();
const jwt = require("jsonwebtoken");

const token = jwt.sign({ id: "a48888d4-cbe9-4d72-a15c-e38424886beb", email: "user@auraforex.com", role: "USER" }, process.env.JWT_SECRET || "AURA_SUPER_SECRET_KEY_123", { expiresIn: "7d" });

fetch("http://127.0.0.1:3000/api/affiliate/stats", {
  headers: { "Authorization": "Bearer " + token }
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
