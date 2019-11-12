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

    const reservationService = new tttsapi.service.Reservation({
        endpoint: process.env.TEST_API_ENDPOINT,
        auth: auth
    });

    const result = await reservationService.publishPaymentNo({
        event: { id: '191113001001010900' }
    });
    console.log('paymentNo published.', result);
}

main().then(() => {
    console.log('main processed.');
}).catch((err) => {
    console.error(err);
});
