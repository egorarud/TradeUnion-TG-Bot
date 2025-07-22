-- CreateTable
CREATE TABLE "FitnessCenter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "address" TEXT
);

-- CreateTable
CREATE TABLE "FitnessSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "centerId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    CONSTRAINT "FitnessSlot_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "FitnessCenter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessRegistration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slotId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FitnessRegistration_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "FitnessSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FitnessRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
