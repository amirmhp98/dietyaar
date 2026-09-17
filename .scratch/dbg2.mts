import 'dotenv/config';
process.env.NODE_ENV ??= 'development';
const { getDayView } = await import('/Users/amirmhp/Desktop/MyMac/Learning/Bozhan VibeCoding Course/Dietyaar/src/services/day-view.service.ts');
const r = await getDayView('cmu5zpbg4002lafqoiktdk7eh', '2026-09-17', new Date());
console.log(JSON.stringify({ plan: r.plan?.status, confirmed: r.plan?.confirmedAt, slots: r.view.slots.length, zone: r.zone }));
process.exit(0);
