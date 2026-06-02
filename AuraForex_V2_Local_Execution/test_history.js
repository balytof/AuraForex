const { PrismaClient } = require('@prisma/client');
const { createBroker } = require('./apex_broker');
const { decrypt } = require('./utils/encryption');

const prisma = new PrismaClient();

async function test() {
    const user = await prisma.user.findFirst({ where: { email: 'aurafx1@gmail.com' } }); // Assuming the admin/user email or we can just fetch the first connected broker
    const connection = await prisma.brokerConnection.findFirst();
    
    if (!connection) {
        console.log("No broker connection found.");
        return;
    }
    
    console.log("Found connection for user:", connection.userId);
    console.log("Broker Type:", connection.brokerType);
    
    const config = {
        provider: connection.brokerType,
        environment: connection.environment,
        accountId: connection.accountId,
        apiToken: decrypt(connection.apiTokenEncrypted),
        metaApiToken: decrypt(connection.apiTokenEncrypted),
        metaApiAccountId: connection.accountId,
        region: connection.region
    };
    
    const adapter = createBroker(config);
    console.log("Connecting...");
    const resConn = await adapter.connect();
    console.log("Connect result:", resConn);
    
    if (resConn.success) {
        console.log("Fetching history...");
        const hist = await adapter.getHistory();
        console.log("History length:", hist ? hist.length : 0);
        if (hist && hist.length > 0) {
            console.log("First item:", hist[0]);
        } else {
            console.log("No history found. Let's try fetching deals manually if MetaApi.");
            if (connection.brokerType === 'metaapi') {
                const startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                try {
                    const deals = await adapter.connection.getDealsByTimeRange(startTime, new Date());
                    console.log("Raw deals:", deals);
                } catch(e) {
                    console.log("Error getting raw deals:", e);
                }
            }
        }
    }
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
