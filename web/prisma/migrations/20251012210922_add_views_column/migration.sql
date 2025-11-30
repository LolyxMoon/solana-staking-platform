/*
  Warnings:

  - A unique constraint covering the columns `[pool_id]` on the table `Pool` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Pool" ADD COLUMN     "external_reflection_mint" TEXT,
ADD COLUMN     "flat_sol_fee" DOUBLE PRECISION NOT NULL DEFAULT 0.005,
ADD COLUMN     "has_external_reflections" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_self_reflections" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_emergency_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_initialized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platform_fee_percent" DOUBLE PRECISION NOT NULL DEFAULT 2,
ADD COLUMN     "pool_address" TEXT,
ADD COLUMN     "pool_id" SERIAL NOT NULL,
ADD COLUMN     "referral_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referral_split_percent" DOUBLE PRECISION,
ADD COLUMN     "referral_wallet" TEXT,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Pool_pool_id_key" ON "Pool"("pool_id");
