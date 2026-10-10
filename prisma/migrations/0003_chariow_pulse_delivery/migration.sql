CREATE TABLE "ChariowPulseDelivery" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChariowPulseDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChariowPulseDelivery_saleId_idx" ON "ChariowPulseDelivery"("saleId");
