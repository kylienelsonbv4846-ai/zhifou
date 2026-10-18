import mysql from 'mysql2/promise';

async function fixAvatarColumn() {
  let connection;
  try {
    connection = await mysql.createConnection({
      uri: process.env.DATABASE_URL,
      ssl: true,
      rejectUnauthorized: false,
      waitForConnections: true,
      connectionLimit: 1,
      queueLimit: 0
    });

    console.log('Connected to database');

    // Check if column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' AND TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'avatarUrl'
    `);

    if (columns.length > 0) {
      console.log('✅ avatarUrl column already exists');
      return;
    }

    console.log('Adding avatarUrl column...');
    await connection.query(`
      ALTER TABLE users ADD COLUMN avatarUrl LONGTEXT NULL AFTER passwordHash
    `);
    console.log('✅ avatarUrl column added successfully');

    // Verify
    const [verify] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'avatarUrl'
    `);
    
    if (verify.length > 0) {
      console.log('✅ Column verified in database');
    }
  } catch (error) {
    if (error.message && error.message.includes('Duplicate column')) {
      console.log('✅ Column already exists (duplicate error)');
    } else {
      console.error('Error:', error.message || error);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixAvatarColumn();
