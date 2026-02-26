/*
  Warnings:

  - A unique constraint covering the columns `[clerkId]` on the table `Progress` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clerkId` to the `Progress` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Progress" ADD COLUMN     "clerkId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Progress_clerkId_key" ON "Progress"("clerkId");
