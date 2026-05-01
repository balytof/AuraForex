require('dotenv').config();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "auraforex_default_jwt_secret";

// Generate a valid token for the admin user
const token = jwt.sign(
  { id: "d94dfa53-5d68-4452-8732-4487c2bd5204", email: "admin@auratrade.ai", role: "ADMIN" },
  JWT_SECRET,
  { expiresIn: "7d" }
);

console.log("JWT_SECRET in use:", JWT_SECRET.substring(0, 20) + "...");
console.log("\nValid token for admin:");
console.log(token);
console.log("\nPaste this in browser localStorage:\nlocalStorage.setItem('aura_token', '" + token + "')");
