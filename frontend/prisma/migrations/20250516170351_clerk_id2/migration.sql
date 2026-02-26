/*
  Warnings:

  - You are about to drop the column `clerkId` on the `Progress` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Progress_clerkId_key";

-- AlterTable
ALTER TABLE "Progress" DROP COLUMN "clerkId";
