/**
 * 注文照会サンプル
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
            process.env.TEST_RESOURCE_IDENTIFIER + '/orders.read-only'
        ],
        state: 'teststate'
    });

    const orders = new tttsapi.service.Order({
        endpoint: process.env.TEST_API_ENDPOINT,
        auth: auth
    });

    const order = await orders.findByOrderInquiryKey({
        performanceDay: '20180108',
        paymentNo: '301700',
        telephone: '3896'
    });
    console.log('order found', order);
}

main().then(() => {
    console.log('main processed.');
}).catch((err) => {
    console.error(err);
});
