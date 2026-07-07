// In-memory database using plain JS objects
// Replaces SQLite/Postgres for zero-dependency operation

const db = {
  homes: [],
  rooms: [],
  staff: [],
  checklistTemplates: [],
  taskDefinitions: [],
  taskInstances: [],
  issues: [],
  auditLog: []
};

// Simple ID generator
let idCounter = 1000;
export function generateId() {
  return `id_${Date.now()}_${idCounter++}`;
}

// Query helpers
export function findAll(table) {
  return db[table] || [];
}

export function findById(table, id) {
  return (db[table] || []).find(r => r.id === id);
}

export function findWhere(table, predicate) {
  return (db[table] || []).filter(predicate);
}

export function findOneWhere(table, predicate) {
  return (db[table] || []).find(predicate);
}

export function insert(table, record) {
  if (!record.id) record.id = generateId();
  record.created_at = record.created_at || new Date().toISOString();
  db[table].push(record);
  return record;
}

export function update(table, id, updates) {
  const idx = (db[table] || []).findIndex(r => r.id === id);
  if (idx === -1) return null;
  db[table][idx] = { ...db[table][idx], ...updates, updated_at: new Date().toISOString() };
  return db[table][idx];
}

export function remove(table, id) {
  const idx = (db[table] || []).findIndex(r => r.id === id);
  if (idx === -1) return false;
  db[table].splice(idx, 1);
  return true;
}

export default db;
