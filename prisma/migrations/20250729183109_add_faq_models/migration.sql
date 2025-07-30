-- CreateTable
CREATE TABLE "FAQTopic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FAQ" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "topicId" INTEGER NOT NULL,
    CONSTRAINT "FAQ_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "FAQTopic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FAQTopic_title_key" ON "FAQTopic"("title");
