-- CreateTable
CREATE TABLE "user_stakes" (
    "id" TEXT NOT NULL,
    "user_wallet" TEXT NOT NULL,
    "token_mint" TEXT NOT NULL,
    "pool_id" INTEGER NOT NULL DEFAULT 0,
    "staked_amount" BIGINT NOT NULL DEFAULT 0,
    "stake_pda" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stakes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_stakes_stake_pda_key" ON "user_stakes"("stake_pda");

-- CreateIndex
CREATE INDEX "user_stakes_user_wallet_idx" ON "user_stakes"("user_wallet");

-- CreateIndex
CREATE INDEX "user_stakes_token_mint_idx" ON "user_stakes"("token_mint");

-- CreateIndex
CREATE INDEX "user_stakes_staked_amount_idx" ON "user_stakes"("staked_amount");

-- CreateIndex
CREATE UNIQUE INDEX "user_stakes_user_wallet_token_mint_pool_id_key" ON "user_stakes"("user_wallet", "token_mint", "pool_id");
