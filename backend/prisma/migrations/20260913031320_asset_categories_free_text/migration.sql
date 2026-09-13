-- Convert category from a fixed enum to free text, preserving existing values
-- (the generated migration would have dropped and recreated the column,
-- destroying existing data — this uses an explicit cast instead).

ALTER TABLE "it_inventory"."ITAsset" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;
ALTER TABLE "maintenance_inventory"."MaintenanceAsset" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;

DROP TYPE "it_inventory"."ITAssetCategory";
DROP TYPE "maintenance_inventory"."MaintenanceAssetCategory";
