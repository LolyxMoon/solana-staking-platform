/*
  Warnings:

  - You are about to drop the `Activity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pool` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Stake` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Activity" DROP CONSTRAINT "Activity_poolId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Stake" DROP CONSTRAINT "Stake_poolId_fkey";

-- DropTable
DROP TABLE "public"."Activity";

-- DropTable
DROP TABLE "public"."Pool";

-- DropTable
DROP TABLE "public"."Stake";

-- CreateTable
CREATE TABLE "pools" (
    "id" TEXT NOT NULL,
    "pool_id" INTEGER NOT NULL,
    "token_mint" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "apr" DOUBLE PRECISION,
    "apy" DOUBLE PRECISION,
    "type" TEXT NOT NULL,
    "lock_period" INTEGER,
    "total_staked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rewards" TEXT,
    "logo" TEXT,
    "pair_address" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "has_self_reflections" BOOLEAN NOT NULL DEFAULT false,
    "has_external_reflections" BOOLEAN NOT NULL DEFAULT false,
    "external_reflection_mint" TEXT,
    "reflection_token_account" TEXT,
    "reflection_token_symbol" TEXT,
    "is_initialized" BOOLEAN NOT NULL DEFAULT false,
    "pool_address" TEXT,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "is_emergency_unlocked" BOOLEAN NOT NULL DEFAULT false,
    "platform_fee_percent" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "flat_sol_fee" DOUBLE PRECISION NOT NULL DEFAULT 0.005,
    "referral_enabled" BOOLEAN NOT NULL DEFAULT false,
    "referral_wallet" TEXT,
    "referral_split_percent" DOUBLE PRECISION,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stakes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pool_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pool_token_pool_id_idx" ON "pools"("token_mint", "pool_id");

-- CreateIndex
CREATE INDEX "pool_token_mint_idx" ON "pools"("token_mint");

-- CreateIndex
CREATE UNIQUE INDEX "pools_token_mint_pool_id_key" ON "pools"("token_mint", "pool_id");

-- CreateIndex
CREATE INDEX "stake_user_id_idx" ON "stakes"("user_id");

-- CreateIndex
CREATE INDEX "stake_pool_id_idx" ON "stakes"("pool_id");

-- CreateIndex
CREATE INDEX "activity_user_id_idx" ON "activities"("user_id");

-- CreateIndex
CREATE INDEX "activity_pool_id_idx" ON "activities"("pool_id");

-- CreateIndex
CREATE INDEX "activity_type_idx" ON "activities"("type");

-- AddForeignKey
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
