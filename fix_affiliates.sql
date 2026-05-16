UPDATE "User" 
SET "sponsorId" = (SELECT id FROM "User" WHERE "referralCode" = 'AURA-MASTER' LIMIT 1) 
WHERE "sponsorId" IS NULL AND "referralCode" != 'AURA-MASTER';
