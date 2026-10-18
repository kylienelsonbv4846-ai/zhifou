import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: true,
  rejectUnauthorized: false
});

try {
  console.log('Adding avatarUrl column to users table...');
  await connection.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatarUrl LONGTEXT NULL AFTER passwordHash
  `);
  console.log('✅ avatarUrl column added successfully');
  
  // Verify the column exists
  const [columns] = await connection.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'avatarUrl'
  `);
  
  if (columns.length > 0) {
    console.log('✅ Column verified in database');
  } else {
    console.log('❌ Column not found after creation');
  }
} catch (error) {
  if (error.message.includes('Duplicate column')) {
    console.log('✅ Column already exists');
  } else {
    console.error('Error:', error.message);
  }
} finally {
  await connection.end();
}
