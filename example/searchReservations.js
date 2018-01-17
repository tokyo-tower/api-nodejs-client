/**
 * 予約検索サンプル
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
            process.env.TEST_RESOURCE_IDENTIFIER + '/reservations.read-only'
        ],
        state: 'teststate'
    });

    const reservationService = new tttsapi.service.Reservation({
        endpoint: process.env.TEST_API_ENDPOINT,
        auth: auth
    });

    const reservations = await reservationService.search({
        status: tttsapi.factory.reservationStatusType.ReservationConfirmed,
        performanceId: '171222001001020900'
    });
    console.log(reservations.length, 'reservations found.');
}

main().then(() => {
    console.log('main processed.');
}).catch((err) => {
    console.error(err);
});
