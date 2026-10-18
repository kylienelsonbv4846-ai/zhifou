import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: 'Amazon RDS'
});

try {
  // Check if column exists
  const [rows] = await connection.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'avatarUrl'
  `);
  
  if (rows.length === 0) {
    console.log('Adding avatarUrl column...');
    await connection.query(`
      ALTER TABLE users ADD COLUMN avatarUrl LONGTEXT NULL AFTER passwordHash
    `);
    console.log('✅ avatarUrl column added successfully');
  } else {
    console.log('✅ avatarUrl column already exists');
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await connection.end();
}
