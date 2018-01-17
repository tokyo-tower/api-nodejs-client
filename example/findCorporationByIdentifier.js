/**
 * 識別子で企業組織検索サンプル
 * @ignore
 */

const moment = require('moment');
const tttsapi = require('../lib/index');

async function main() {
    const auth = new tttsapi.auth.ClientCredentials({
        domain: process.env.TEST_AUTHORIZE_SERVER_DOMAIN,
        clientId: process.env.TEST_CLIENT_ID,
        clientSecret: process.env.TEST_CLIENT_SECRET,
        scopes: [
            process.env.TEST_RESOURCE_IDENTIFIER + '/organizations.read-only'
        ],
        state: 'teststate'
    });

    const organizations = new tttsapi.service.Organization({
        endpoint: process.env.TEST_API_ENDPOINT,
        auth: auth
    });

    const organization = await organizations.findCorporationByIdentifier({
        identifier: 'TokyoTower'
    });
    console.log('organization found', organization);
}

main().then(() => {
    console.log('main processed.');
}).catch((err) => {
    console.error(err);
});
