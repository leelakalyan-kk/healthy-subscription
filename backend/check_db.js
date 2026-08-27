const mongoose = require('mongoose');

const uri = "mongodb+srv://leelakumardj:RgG7Gw32FXgZJ9Ul@healthybites.yi1xnfr.mongodb.net/?retryWrites=true&w=majority&appName=healthybites";

async function check() {
  try {
    console.log('Connecting to Atlas...');
    await mongoose.connect(uri);
    console.log('✅ Connected successfully!');
    
    const admin = new mongoose.mongo.Admin(mongoose.connection.db);
    const dbs = await admin.listDatabases();
    console.log('\n--- DATABASES IN YOUR ATLAS ---');
    for (let d of dbs.databases) {
      console.log(`📁 Database: ${d.name} (${(d.sizeOnDisk / 1024).toFixed(2)} KB)`);
      const currentDb = mongoose.connection.useDb(d.name);
      const collections = await currentDb.db.listCollections().toArray();
      for (let c of collections) {
        const count = await currentDb.db.collection(c.name).countDocuments();
        console.log(`   📑 Collection: "${c.name}" -> ${count} documents`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Connection Error:', err.message);
    process.exit(1);
  }
}

check();
