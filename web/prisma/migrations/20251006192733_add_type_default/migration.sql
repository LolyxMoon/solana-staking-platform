/*
  Warnings:

  - The primary key for the `Pool` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `address` on the `Pool` table. All the data in the column will be lost.
  - The primary key for the `Stake` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `rewards` on the `Stake` table. All the data in the column will be lost.
  - You are about to drop the column `user` on the `Stake` table. All the data in the column will be lost.
  - Added the required column `userId` to the `Stake` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Stake" DROP CONSTRAINT "Stake_poolId_fkey";

-- AlterTable
ALTER TABLE "Pool" DROP CONSTRAINT "Pool_pkey",
DROP COLUMN "address",
ADD COLUMN     "apy" DOUBLE PRECISION,
ADD COLUMN     "lockPeriod" INTEGER,
ADD COLUMN     "mintAddress" TEXT,
ADD COLUMN     "rewards" TEXT,
ADD COLUMN     "totalStaked" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'unlocked',
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "logo" DROP NOT NULL,
ALTER COLUMN "apr" DROP NOT NULL,
ALTER COLUMN "pairAddress" DROP NOT NULL,
ADD CONSTRAINT "Pool_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Pool_id_seq";

-- AlterTable
ALTER TABLE "Stake" DROP CONSTRAINT "Stake_pkey",
DROP COLUMN "rewards",
DROP COLUMN "user",
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "poolId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Stake_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Stake_id_seq";

-- AddForeignKey
ALTER TABLE "Stake" ADD CONSTRAINT "Stake_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
