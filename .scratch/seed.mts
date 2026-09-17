import { seedMenuPlan, disconnectDb } from '/Users/amirmhp/Desktop/MyMac/Learning/Bozhan VibeCoding Course/Dietyaar/e2e/helpers/db.ts';
const r = await seedMenuPlan(process.argv[2]);
console.log(JSON.stringify(r.slots.map(s => ({ id: s.id, label: s.englishLabel, n: s.options.length }))));
await disconnectDb();
