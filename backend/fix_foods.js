const mongoose = require('mongoose');

const uri = "mongodb+srv://leelakumardj:RgG7Gw32FXgZJ9Ul@healthybites.yi1xnfr.mongodb.net/healthySubscription?retryWrites=true&w=majority&appName=healthybites";

async function fixData() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    // 1. Ensure all foods have valid title, sellerId, isAvailable
    const result = await db.collection('foods').updateMany(
      {},
      {
        $set: {
          isAvailable: true,
          sellerId: 'tests',
          sellerName: 'tests',
          city: 'Vijayawada',
          areaName: 'Vijayawada'
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} food items to active status!`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixData();
