// Shared Vitest setup placeholder.
// Initialize in-memory SQLite for unit tests that need a real DB.
export {};

process.env.SQLITE_DB_PATH = ':memory:';
process.env.DISABLE_EMBEDDINGS = 'true';

// Import the client to trigger singleton creation and schema migration.
// This must happen before any test file imports a service.
if (process.env.SKIP_DB_SETUP !== 'true') {
  await import('@/services/database/sqlite-client');
}
