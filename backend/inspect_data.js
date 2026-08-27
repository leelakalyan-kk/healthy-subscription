const mongoose = require('mongoose');

const uri = "mongodb+srv://leelakumardj:RgG7Gw32FXgZJ9Ul@healthybites.yi1xnfr.mongodb.net/healthySubscription?retryWrites=true&w=majority&appName=healthybites";

async function inspect() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    const sampleFoods = await db.collection('foods').find().limit(3).toArray();
    console.log('\n--- SAMPLE FOODS (3 ITEMS) ---');
    console.log(JSON.stringify(sampleFoods, null, 2));

    const sampleOrders = await db.collection('orders').find().limit(3).toArray();
    console.log('\n--- SAMPLE ORDERS (3 ITEMS) ---');
    console.log(JSON.stringify(sampleOrders, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspect();
