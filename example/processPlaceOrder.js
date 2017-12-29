/**
 * 注文取引サンプル
 * @ignore
 */

const moment = require('moment');
const util = require('util');
const sasaki = require('../lib/index');

const auth = new sasaki.auth.ClientCredentials({
    domain: process.env.TEST_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.TEST_CLIENT_ID,
    clientSecret: process.env.TEST_CLIENT_SECRET,
    scopes: [
        process.env.TEST_RESOURCE_IDENTIFIER + '/performances.read-only',
        process.env.TEST_RESOURCE_IDENTIFIER + '/transactions'
    ],
    state: 'teststate'
});

const event = new sasaki.service.Event({
    endpoint: process.env.TEST_API_ENDPOINT,
    auth: auth
});

const placeOrderTransactions = new sasaki.service.transaction.PlaceOrder({
    endpoint: process.env.TEST_API_ENDPOINT,
    auth: auth
});

async function main() {
    const searchPerformancesResult = await event.searchPerformances({
        start_from: moment().add(1, 'day').toDate(),
        start_through: moment().add(2, 'day').toDate()
    });
    console.log('performances found', searchPerformancesResult.data.length);
    const performances = searchPerformancesResult.data;

    const performance = performances.find((p) => p.attributes.seat_status > 0);
    if (performances === undefined) {
        throw new Error('予約可能なパフォーマンスが見つかりません。');
    }

    console.log('パフォーマンスを決めています...');
    await wait(1000);
    console.log('取引を開始します... パフォーマンス:', performance.id);

    // 取引開始
    const transaction = await placeOrderTransactions.start({
        expires: moment().add(10, 'minutes').toISOString(),
        sellerIdentifier: 'TokyoTower',
        purchaserGroup: 'Customer'
    });
    console.log('取引が開始されました。', transaction.id);

    // 仮予約
    console.log('券種を選択しています...');
    await wait(1000);
    let ticketType = performance.attributes.ticket_types[0];
    let seatReservationAuthorizeAction = await placeOrderTransactions.createSeatReservationAuthorization({
        transactionId: transaction.id,
        performanceId: performance.id,
        offers: [{
            ticket_type: ticketType.id,
            watcher_name: ''
        }]
    });
    console.log('仮予約が作成されました。', seatReservationAuthorizeAction.result.tmpReservations[0].payment_no);

    console.log('券種を変更しています...');
    await wait(1000);
    // 仮予約削除
    await placeOrderTransactions.cancelSeatReservationAuthorization({
        transactionId: transaction.id,
        actionId: seatReservationAuthorizeAction.id
    });
    console.log('仮予約が削除されました。');

    // 再仮予約
    ticketType = performance.attributes.ticket_types[0];
    seatReservationAuthorizeAction = await placeOrderTransactions.createSeatReservationAuthorization({
        transactionId: transaction.id,
        performanceId: performance.id,
        offers: [{
            ticket_type: ticketType.id,
            watcher_name: ''
        }]
    });
    console.log('仮予約が作成されました。', seatReservationAuthorizeAction.result.tmpReservations[0].payment_no);

    const amount = seatReservationAuthorizeAction.result.price;
    const orderIdPrefix = util.format(
        '%s%s%s',
        moment().format('YYYYMMDD'),
        performance.attributes.day,
        // tslint:disable-next-line:no-magic-numbers
        `00000000${seatReservationAuthorizeAction.result.tmpReservations[0].payment_no}`.slice(-8)
    );
    console.log('クレジットカードのオーソリをとります...', orderIdPrefix);
    // tslint:disable-next-line:max-line-length
    const { creditCardAuthorizeAction, numberOfTryAuthorizeCreditCard } = await authorieCreditCardUntilSuccess(
        transaction.id, orderIdPrefix, amount
    );
    console.log(`${numberOfTryAuthorizeCreditCard}回目でオーソリがとれました。アクションID:`, creditCardAuthorizeAction.id);

    // 購入者情報登録
    console.log('購入者情報を入力しています...');
    await wait(1000);
    let customerContact = {
        last_name: 'せい',
        first_name: 'めい',
        email: 'hello@motionpicture.jp',
        tel: '09012345678',
        gender: '0'
    };
    customerContact = await placeOrderTransactions.setCustomerContact({
        transactionId: transaction.id,
        contact: customerContact
    });
    console.log('購入者情報が登録されました。', customerContact.tel);

    // 確定
    console.log('最終確認しています...');
    await wait(1000);
    const transactionResult = await placeOrderTransactions.confirm({
        transactionId: transaction.id,
        paymentMethod: 'CreditCard'
    });
    console.log('取引確定です。', transactionResult.eventReservations[0].payment_no);
}

const RETRY_INTERVAL_IN_MILLISECONDS = 1000;
const MAX_NUMBER_OF_RETRY = 10;
async function authorieCreditCardUntilSuccess(transactionId, orderIdPrefix, amount) {
    let creditCardAuthorizeAction = null;
    let numberOfTryAuthorizeCreditCard = 0;

    while (creditCardAuthorizeAction === null) {
        numberOfTryAuthorizeCreditCard += 1;

        await wait(RETRY_INTERVAL_IN_MILLISECONDS);

        try {
            creditCardAuthorizeAction = await placeOrderTransactions.createCreditCardAuthorization({
                transactionId: transactionId,
                orderId: `${orderIdPrefix}${`00${numberOfTryAuthorizeCreditCard.toString()}`.slice(-2)}`,
                amount: amount,
                method: '1',
                creditCard: {
                    cardNo: '4111111111111111',
                    expire: '2020',
                    holderName: 'TARO MOTIONPICTURE'
                }
            });
        } catch (error) {
            if (numberOfTryAuthorizeCreditCard >= MAX_NUMBER_OF_RETRY) {
                throw error;
            }
        }
    }

    return {
        creditCardAuthorizeAction,
        numberOfTryAuthorizeCreditCard
    };
}

async function wait(waitInMilliseconds) {
    return new Promise((resolve) => setTimeout(resolve, waitInMilliseconds));
}

main().then(() => {
    console.log('main processed.');
}).catch((err) => {
    console.error(err);
});
