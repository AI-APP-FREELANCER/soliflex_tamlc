import cron from "node-cron";
import { NotificationType, Role, Workstream } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { notify } from "../modules/notifications/notifications.service";

const EXPIRY_WINDOW_DAYS = 30;
const DOWNTIME_THRESHOLD_HOURS = 72;

async function managersFor(workstream: Workstream) {
  return prisma.user.findMany({
    where: { role: Role.MANAGER, active: true, OR: [{ workstream }, { workstream: null }] },
  });
}

async function checkExpiringAssets() {
  const cutoff = new Date(Date.now() + EXPIRY_WINDOW_DAYS * 86_400_000);
  const now = new Date();

  const maintenanceAssets = await prisma.maintenanceAsset.findMany({
    where: { warrantyEndDate: { lte: cutoff, gte: now }, expiryAlertedAt: null },
  });
  const maintenanceManagers = maintenanceAssets.length > 0 ? await managersFor(Workstream.MAINTENANCE) : [];
  for (const asset of maintenanceAssets) {
    await prisma.$transaction(async (tx) => {
      await tx.maintenanceAsset.update({ where: { id: asset.id }, data: { expiryAlertedAt: new Date() } });
      for (const manager of maintenanceManagers) {
        await notify(tx, manager.id, NotificationType.ASSET_EXPIRING, `Warranty for ${asset.itemCode} (${asset.name}) expires ${asset.warrantyEndDate!.toDateString()}`, `/assets/maintenance/${asset.id}`);
      }
    });
  }

  const itAssets = await prisma.iTAsset.findMany({
    where: {
      OR: [{ warrantyEndDate: { lte: cutoff, gte: now } }, { licenseExpiryDate: { lte: cutoff, gte: now } }],
      expiryAlertedAt: null,
    },
  });
  const itManagers = itAssets.length > 0 ? await managersFor(Workstream.IT) : [];
  for (const asset of itAssets) {
    const expiring = asset.licenseExpiryDate && asset.licenseExpiryDate <= cutoff ? "License" : "Warranty";
    const date = expiring === "License" ? asset.licenseExpiryDate! : asset.warrantyEndDate!;
    await prisma.$transaction(async (tx) => {
      await tx.iTAsset.update({ where: { id: asset.id }, data: { expiryAlertedAt: new Date() } });
      for (const manager of itManagers) {
        await notify(tx, manager.id, NotificationType.ASSET_EXPIRING, `${expiring} for ${asset.itemCode} (${asset.name}) expires ${date.toDateString()}`, `/assets/it/${asset.id}`);
      }
    });
  }

  if (maintenanceAssets.length + itAssets.length > 0) {
    console.log(`[asset-alerts] flagged ${maintenanceAssets.length + itAssets.length} asset(s) as expiring soon`);
  }
}

async function checkPersistentDowntime() {
  const cutoff = new Date(Date.now() - DOWNTIME_THRESHOLD_HOURS * 3_600_000);

  const maintenanceAssets = await prisma.maintenanceAsset.findMany({
    where: { status: "DOWN", statusSince: { lte: cutoff }, downtimeAlertedAt: null },
  });
  const maintenanceManagers = maintenanceAssets.length > 0 ? await managersFor(Workstream.MAINTENANCE) : [];
  for (const asset of maintenanceAssets) {
    await prisma.$transaction(async (tx) => {
      await tx.maintenanceAsset.update({ where: { id: asset.id }, data: { downtimeAlertedAt: new Date() } });
      for (const manager of maintenanceManagers) {
        await notify(tx, manager.id, NotificationType.ASSET_DOWNTIME, `${asset.itemCode} (${asset.name}) has been down for over ${DOWNTIME_THRESHOLD_HOURS}h`, `/assets/maintenance/${asset.id}`);
      }
    });
  }

  const itAssets = await prisma.iTAsset.findMany({
    where: { status: "DOWN", statusSince: { lte: cutoff }, downtimeAlertedAt: null },
  });
  const itManagers = itAssets.length > 0 ? await managersFor(Workstream.IT) : [];
  for (const asset of itAssets) {
    await prisma.$transaction(async (tx) => {
      await tx.iTAsset.update({ where: { id: asset.id }, data: { downtimeAlertedAt: new Date() } });
      for (const manager of itManagers) {
        await notify(tx, manager.id, NotificationType.ASSET_DOWNTIME, `${asset.itemCode} (${asset.name}) has been down for over ${DOWNTIME_THRESHOLD_HOURS}h`, `/assets/it/${asset.id}`);
      }
    });
  }

  if (maintenanceAssets.length + itAssets.length > 0) {
    console.log(`[asset-alerts] flagged ${maintenanceAssets.length + itAssets.length} asset(s) as persistently down`);
  }
}

async function runAssetAlerts() {
  await checkExpiringAssets().catch((err) => console.error("[asset-alerts] expiry check failed", err));
  await checkPersistentDowntime().catch((err) => console.error("[asset-alerts] downtime check failed", err));
}

export function startAssetAlertsJob() {
  // once a day
  cron.schedule("0 7 * * *", () => {
    runAssetAlerts().catch((err) => console.error("[asset-alerts] failed", err));
  });
  // also run once shortly after boot
  setTimeout(() => runAssetAlerts().catch((err) => console.error("[asset-alerts] failed", err)), 8000);
}
