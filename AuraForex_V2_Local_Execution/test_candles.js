const MetaApi = require('metaapi.cloud-sdk').default;

async function test() {
    const api = new MetaApi('f99d94fc-0edb-4f70-aa95-924c53839213'); // The token must be read from .env if we have it, wait. I don't have the token.
    // I can just edit server.js to print the reason and length!
}
test();
