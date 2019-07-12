/**
 * 注文検索サンプル
 */
const moment = require('moment');
const tttsapi = require('../lib/index');

async function main() {
    const auth = new tttsapi.auth.ClientCredentials({
        domain: process.env.TEST_AUTHORIZE_SERVER_DOMAIN,
        clientId: process.env.TEST_CLIENT_ID,
        clientSecret: process.env.TEST_CLIENT_SECRET,
        scopes: [],
        state: 'teststate'
    });

    const orderService = new tttsapi.service.Order({
        endpoint: process.env.TEST_API_ENDPOINT,
        auth: auth
    });

    const { totalCount, data } = await orderService.search({
        limit: 10,
        orderDateFrom: moment().add(-1, 'week').toDate(),
        orderDateThrough: moment().toDate(),
        // customer: {
        //     telephone: '1234'
        // },
        // seller: {
        //     id: '5a392dfdfca1c8737fb6da42'
        // }
    });
    console.log(data);
    console.log(totalCount, 'order found');
}

main().then(() => {
    console.log('main processed.');
}).catch((err) => {
    console.error(err);
});
