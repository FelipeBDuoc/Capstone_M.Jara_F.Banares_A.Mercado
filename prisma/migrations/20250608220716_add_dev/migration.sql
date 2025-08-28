/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Carousel` table. All the data in the column will be lost.
  - Added the required column `image` to the `Carousel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Carousel` DROP COLUMN `imageUrl`,
    ADD COLUMN `image` LONGBLOB NOT NULL;
