-- 1) Repair type + cost-based approval ------------------------------------
CREATE TYPE "tms"."FixType" AS ENUM ('SPARE_PART_REPLACEMENT', 'MINOR_ADJUSTMENT');

ALTER TABLE "tms"."Ticket"
  ADD COLUMN "fixType" "tms"."FixType",
  ADD COLUMN "estimatedCost" DOUBLE PRECISION,
  ADD COLUMN "approvalRequired" BOOLEAN NOT NULL DEFAULT true;

-- 2) Mobile-number sign-in -------------------------------------------------
-- Email becomes optional; phone becomes a second unique sign-in identifier.
ALTER TABLE "tms"."User" ALTER COLUMN "email" DROP NOT NULL;

-- Normalise existing phone values to +91XXXXXXXXXX / +<digits>; anything that
-- cannot be read as a phone number is cleared (it was never used to sign in).
UPDATE "tms"."User" SET "phone" = NULLIF(BTRIM("phone"), '') WHERE "phone" IS NOT NULL;
UPDATE "tms"."User" SET "phone" = CASE
    WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$'            THEN '+91' || regexp_replace("phone", '[^0-9]', '', 'g')
    WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$'           THEN '+91' || substr(regexp_replace("phone", '[^0-9]', '', 'g'), 2)
    WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$'          THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
    WHEN "phone" ~ '^\+' AND regexp_replace("phone", '[^0-9]', '', 'g') ~ '^[0-9]{8,15}$' THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
    ELSE NULL
  END
WHERE "phone" IS NOT NULL;

-- If two accounts ended up with the same number, keep it on the oldest one only.
UPDATE "tms"."User" u SET "phone" = NULL
WHERE "phone" IS NOT NULL AND u."id" <> (
  SELECT u2."id" FROM "tms"."User" u2 WHERE u2."phone" = u."phone" ORDER BY u2."createdAt", u2."id" LIMIT 1
);

CREATE UNIQUE INDEX "User_phone_key" ON "tms"."User"("phone");

ALTER TABLE "tms"."User"
  ADD CONSTRAINT "User_contact_check" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);
