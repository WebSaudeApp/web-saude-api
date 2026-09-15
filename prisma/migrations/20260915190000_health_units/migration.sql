-- CreateEnum
CREATE TYPE "HealthUnitType" AS ENUM ('HOSPITAL', 'CLINIC');
CREATE TYPE "HealthUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "health_units" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HealthUnitType" NOT NULL,
    "description" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "website" TEXT,
    "status" "HealthUnitStatus" NOT NULL DEFAULT 'INACTIVE',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "health_units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "specialties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "unit_specialties" (
    "unitId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,

    CONSTRAINT "unit_specialties_pkey" PRIMARY KEY ("unitId","specialtyId")
);

CREATE TABLE "opening_hours" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "unit_images" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "specialties_name_key" ON "specialties"("name");
CREATE INDEX "health_units_ownerId_idx" ON "health_units"("ownerId");
CREATE INDEX "health_units_city_state_idx" ON "health_units"("city", "state");
CREATE INDEX "health_units_type_approvalStatus_status_idx" ON "health_units"("type", "approvalStatus", "status");
CREATE UNIQUE INDEX "opening_hours_unitId_dayOfWeek_key" ON "opening_hours"("unitId", "dayOfWeek");
CREATE INDEX "opening_hours_unitId_idx" ON "opening_hours"("unitId");
CREATE INDEX "unit_images_unitId_idx" ON "unit_images"("unitId");

ALTER TABLE "health_units" ADD CONSTRAINT "health_units_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_specialties" ADD CONSTRAINT "unit_specialties_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "health_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unit_specialties" ADD CONSTRAINT "unit_specialties_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "health_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unit_images" ADD CONSTRAINT "unit_images_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "health_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
