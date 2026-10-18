import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: true,
  rejectUnauthorized: false
});

try {
  const [columns] = await connection.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'users' AND TABLE_SCHEMA = DATABASE()
  `);
  
  console.log('Users table columns:');
  columns.forEach(col => console.log('  -', col.COLUMN_NAME));
  
  const hasAvatarUrl = columns.some(col => col.COLUMN_NAME === 'avatarUrl');
  console.log('\navatarUrl column exists:', hasAvatarUrl);
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await connection.end();
}
