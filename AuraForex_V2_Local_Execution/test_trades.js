const { createBroker } = require('./apex_broker');

async function test() {
    const broker = createBroker({
        brokerType: 'metaapi',
        metaApiToken: 'eW91ci10b2tlbi1oZXJl', // Wait, I don't have the token.
    });
}
