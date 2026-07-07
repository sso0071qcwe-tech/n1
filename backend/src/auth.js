import crypto from 'crypto';
import { findOneWhere } from './db.js';

const JWT_SECRET = crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Simple JWT-like token (HMAC-signed JSON)
export function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  
  if (signature !== expectedSig) return null;
  
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp < Date.now()) return null;
  
  return payload;
}

export function hashPin(pin) {
  return crypto.createHash('sha256').update(pin + 'merling-salt').digest('hex');
}

export function authenticateStaff(pin) {
  const hashedPin = hashPin(pin);
  const staff = findOneWhere('staff', s => s.pin_hash === hashedPin);
  if (!staff) return null;
  
  const token = createToken({
    staffId: staff.id,
    name: staff.name,
    role: staff.role,
    homeId: staff.home_id
  });
  
  return { token, staff: { id: staff.id, name: staff.name, role: staff.role, initials: staff.initials } };
}

// Middleware-style auth check
export function requireAuth(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export function requireRole(user, ...roles) {
  if (!user) return false;
  return roles.includes(user.role);
}
