-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuctionPhase" ADD VALUE 'CATEGORY_A_2';
ALTER TYPE "AuctionPhase" ADD VALUE 'CATEGORY_B_2';
ALTER TYPE "AuctionPhase" ADD VALUE 'CATEGORY_C_2';
