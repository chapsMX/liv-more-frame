const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  try {
    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'migrations', '002_add_refresh_token.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Ejecutar la migración
    await sql(migrationSQL);

    console.log('Migración ejecutada exitosamente');
  } catch (error) {
    console.error('Error ejecutando migración:', error);
    process.exit(1);
  }
}

runMigration(); 