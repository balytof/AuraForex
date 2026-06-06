const fs = require('fs');

let schema = fs.readFileSync('../prisma/schema.prisma', 'utf8');

if (!schema.includes('email           String?')) {
    schema = schema.replace(
        'name            String\n    commissionPct   Float',
        'name            String\n    email           String?\n    commissionPct   Float'
    );
    fs.writeFileSync('../prisma/schema.prisma', schema);
    console.log("Schema updated with email field on Provider.");
} else {
    console.log("Schema already has email field on Provider.");
}
