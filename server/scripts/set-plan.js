import { db, migrate } from "../src/db.js";

const [email, planName = "pro", paymentStatus = "paid"] = process.argv.slice(2);

if (!email) {
  console.error("Usage: npm run set-plan -w server -- owner@example.com pro paid");
  process.exit(1);
}

migrate();

const result = db.prepare(`
  UPDATE users
  SET plan_name = ?, payment_status = ?
  WHERE email = ?
`).run(planName, paymentStatus, email.toLowerCase());

if (!result.changes) {
  console.error(`No shop found for ${email}`);
  process.exit(1);
}

const user = db.prepare("SELECT email, shop_name, plan_name, payment_status FROM users WHERE email = ?").get(email.toLowerCase());
console.log(JSON.stringify(user, null, 2));
