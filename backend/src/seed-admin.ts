/**
 * Admin bootstrap (Task 0 fix).
 *
 * `/usersignin` always assigns role: "user", so the admin-only routes are
 * unreachable out of the box. This script creates — or promotes — a single
 * admin account so the admin screens become usable.
 *
 * Usage (after `npm run build`):
 *   ADMIN_EMAIL=admin@surflibrary.dev node ./dist/src/seed-admin.js
 *
 * or in dev:
 *   ADMIN_EMAIL=admin@surflibrary.dev ts-node ./src/seed-admin.ts
 *
 * The admin then signs in normally via `/usersignin` with { mailId: ADMIN_EMAIL }
 * and receives a token whose `user.role` is "admin".
 */
import "reflect-metadata";
import * as dotenv from "dotenv";
import { AppDataSource } from "./data-source";
import { Users } from "./entity/users";

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@surflibrary.dev";

async function seedAdmin() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  const userRepo = AppDataSource.getRepository(Users);

  const existing = await userRepo.findOne({ where: { mailId: ADMIN_EMAIL } });

  if (existing) {
    if (existing.role !== "admin") {
      existing.role = "admin";
      await userRepo.save(existing);
      console.log(`[seed-admin] Promoted existing user ${ADMIN_EMAIL} to admin.`);
    } else {
      console.log(`[seed-admin] ${ADMIN_EMAIL} is already an admin. Nothing to do.`);
    }
  } else {
    const admin = userRepo.create({ mailId: ADMIN_EMAIL, role: "admin" });
    await userRepo.save(admin);
    console.log(`[seed-admin] Created admin user ${ADMIN_EMAIL}.`);
  }

  await AppDataSource.destroy();
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-admin] Failed:", err);
    process.exit(1);
  });
