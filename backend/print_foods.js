const mongoose = require('mongoose');

const uri = "mongodb+srv://leelakumardj:RgG7Gw32FXgZJ9Ul@healthybites.yi1xnfr.mongodb.net/healthySubscription?retryWrites=true&w=majority&appName=healthybites";

async function printAll() {
  try {
    await mongoose.connect(uri);
    const foods = await mongoose.connection.db.collection('foods').find().toArray();
    console.log(`\nFound ${foods.length} dishes in DB:`);
    foods.forEach((f, idx) => {
      console.log(`[${idx + 1}] Title: "${f.title || f.name}" | Price: ₹${f.price} | SellerId: "${f.sellerId}" | isAvailable: ${f.isAvailable}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

printAll();
