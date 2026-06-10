// scripts/seedDepots.js
// Seeds a starter set of PalmTrent depots / bus-station counters.
const mongoose = require('mongoose');
const Depot = require('../models/Depot');

const depots = [
  { name: 'Harare Central Depot', code: 'HRE01', city: 'Harare', address: 'Mbare Musika Long Distance Rank', phone: '+263242700000' },
  { name: 'Bulawayo Depot', code: 'BYO01', city: 'Bulawayo', address: 'Renkini Bus Terminus', phone: '+263292200000' },
  { name: 'Mutare Depot', code: 'MUT01', city: 'Mutare', address: 'Sakubva Bus Terminus', phone: '+263202060000' },
  { name: 'Gweru Depot', code: 'GWE01', city: 'Gweru', address: 'Gweru Town Terminus', phone: '+263542220000' },
  { name: 'Masvingo Depot', code: 'MSV01', city: 'Masvingo', address: 'Masvingo Town Rank', phone: '+263392260000' }
];

async function seedDepots() {
  let created = 0;
  for (const depot of depots) {
    const result = await Depot.updateOne(
      { code: depot.code },
      { $setOnInsert: depot },
      { upsert: true }
    );
    if (result.upsertedCount) created += 1;
  }
  console.log(`✅ Depots seeded. New: ${created}, total defined: ${depots.length}`);
}

if (require.main === module) {
  require('dotenv').config();
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transport_db';
  mongoose.connect(MONGODB_URI)
    .then(() => seedDepots())
    .then(() => process.exit(0))
    .catch((error) => { console.error('❌ Error seeding depots:', error); process.exit(1); });
}

module.exports = seedDepots;
