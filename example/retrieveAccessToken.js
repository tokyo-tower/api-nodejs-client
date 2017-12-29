/**
 * a sample retrieving an access token
 */

const open = require('open');
const readline = require('readline');
const sasaki = require('../lib/index');

async function main() {
    const scopes = [
        'phone', 'openid', 'email', 'aws.cognito.signin.user.admin', 'profile',
        process.env.TEST_RESOURCE_IDENTIFIER + '/transactions',
        process.env.TEST_RESOURCE_IDENTIFIER + '/events.read-only',
        process.env.TEST_RESOURCE_IDENTIFIER + '/organizations.read-only',
        process.env.TEST_RESOURCE_IDENTIFIER + '/people.contacts',
        process.env.TEST_RESOURCE_IDENTIFIER + '/people.creditCards',
        process.env.TEST_RESOURCE_IDENTIFIER + '/people.ownershipInfos.read-only'
    ];

    const auth = new sasaki.auth.OAuth2({
        domain: process.env.TEST_AUTHORIZE_SERVER_DOMAIN,
        clientId: process.env.TEST_CLIENT_ID_OAUTH2,
        clientSecret: process.env.TEST_CLIENT_SECRET_OAUTH2,
        redirectUri: 'https://localhost/signIn',
        logoutUri: 'https://localhost/signOut'
    });

    const state = '12345';
    const codeVerifier = '12345';

    const authUrl = auth.generateAuthUrl({
        scopes: scopes,
        state: state,
        codeVerifier: codeVerifier
    });
    console.log('authUrl:', authUrl);

    open(authUrl);

    await new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('enter authorization code:\n', async (code) => {
            rl.question('enter state:\n', async (givenState) => {
                if (givenState !== state) {
                    reject(new Error('state not matched'));

                    return;
                }

                let credentials = await auth.getToken(code, codeVerifier);
                console.log('credentials published', credentials);

                auth.setCredentials(credentials);

                credentials = await auth.refreshAccessToken();
                console.log('credentials refreshed', credentials);

                rl.close();
                resolve();
            });
        });
    });

    const logoutUrl = auth.generateLogoutUrl();
    console.log('logoutUrl:', logoutUrl);
}

main().then(() => {
    console.log('main processed.');
}).catch((err) => {
    console.error(err);
});
