const crypto = require("crypto");
require("dotenv").config();

// Requer uma key de 32 bytes (256 bits). Em produção, defina no .env
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') 
  : crypto.scryptSync("auraforex_default_secure_password", "salt", 32); 

const ALGORITHM = "aes-256-gcm";

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12); // Vector GCM
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedData) {
  if (!encryptedData) return null;
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error("Falha ao descriptografar token:", err.message);
    return null;
  }
}

module.exports = { encrypt, decrypt };
