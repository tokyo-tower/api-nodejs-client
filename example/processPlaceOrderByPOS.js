/**
 * 注文取引サンプル
 */
const moment = require('moment');
const tttsapi = require('../lib/index');

const auth = new tttsapi.auth.ClientCredentials({
    domain: process.env.TEST_AUTHORIZE_SERVER_DOMAIN,
    clientId: process.env.TEST_CLIENT_ID,
    clientSecret: process.env.TEST_CLIENT_SECRET,
    scopes: [
        // process.env.TEST_RESOURCE_IDENTIFIER + '/performances.read-only',
        // process.env.TEST_RESOURCE_IDENTIFIER + '/transactions'
    ],
    state: 'teststate'
});

const event = new tttsapi.service.Event({
    endpoint: process.env.TEST_API_ENDPOINT,
    auth: auth
});

const placeOrderTransactions = new tttsapi.service.transaction.PlaceOrder({
    endpoint: process.env.TEST_API_ENDPOINT,
    auth: auth
});

const returnOrderService = new tttsapi.service.transaction.ReturnOrder({
    endpoint: process.env.TEST_API_ENDPOINT,
    auth: auth
});

async function main() {
    const searchPerformancesResult = await event.searchPerformances({
        startFrom: moment().add(1, 'day').toDate(),
        startThrough: moment().add(2, 'day').toDate()
    });
    console.log('performances found', searchPerformancesResult.data.data.length);
    const performances = searchPerformancesResult.data.data;
    console.log(performances);

    const performance = performances.find((p) => p.attributes.seat_status > 0);
    if (performance === undefined) {
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
    console.log('仮予約が作成されました。', seatReservationAuthorizeAction.id);

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
    console.log('仮予約が作成されました。', seatReservationAuthorizeAction.id);

    // 購入者情報登録
    console.log('購入者情報を入力しています...');
    await wait(1000);
    let customerContact = {
        last_name: 'POSせい',
        first_name: 'POSめい',
        email: 'hello@motionpicture.jp',
        tel: '+819012345678',
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
        paymentMethod: tttsapi.factory.paymentMethodType.CreditCard
        // paymentMethod: tttsapi.factory.paymentMethodType.Cash
    });
    console.log('取引確定です。', transactionResult.eventReservations[0].payment_no);
    console.log('取引確定です。', transactionResult.order.orderNumber);

    await wait(3000);

    // すぐに注文返品
    console.log('返品しています...');
    await returnOrderService.confirm({
        performanceDay: moment(performance.startDate).format('YYYYMMDD'),
        paymentNo: transactionResult.eventReservations[0].payment_no,
        cancellationFee: 0,
        // forcibly: true,
        reason: tttsapi.factory.transaction.returnOrder.Reason.Customer
    });
    console.log('返品しました');
}

async function wait(waitInMilliseconds) {
    return new Promise((resolve) => setTimeout(resolve, waitInMilliseconds));
}

main().then(() => {
    console.log('main processed.');
}).catch((err) => {
    console.error(err);
});
