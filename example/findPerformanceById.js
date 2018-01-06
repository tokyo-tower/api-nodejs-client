/**
 * IDでパフォーマンス検索サンプル
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
            process.env.TEST_RESOURCE_IDENTIFIER + '/performances.read-only'
        ],
        state: 'teststate'
    });

    const event = new tttsapi.service.Event({
        endpoint: process.env.TEST_API_ENDPOINT,
        auth: auth
    });

    const performance = await event.findPerofrmanceById({
        id: '171220001001020900'
    });
    console.log('performance found', performance);
}

main().then(() => {
    console.log('main processed.');
}).catch((err) => {
    console.error(err);
});
