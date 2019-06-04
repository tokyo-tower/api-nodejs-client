/**
 * OAuth2クライアント
 */

import * as crypto from 'crypto';
import * as createDebug from 'debug';
import { BAD_REQUEST, FORBIDDEN, OK, UNAUTHORIZED } from 'http-status';
import * as fetch from 'isomorphic-fetch';
import * as querystring from 'querystring';

import { Auth, transporters } from '@motionpicture/ttts-api-abstract-client';
import ICredentials from './credentials';

const debug = createDebug('ttts-api-nodejs-client:auth:oAuth2client');

export interface IGenerateAuthUrlOpts {
    scopes: string[];
    state: string;
    codeVerifier?: string;
}

export interface IOptions {
    domain: string;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    logoutUri?: string;
    responseType?: string;
    responseMode?: string;
    scopes?: string[];
    state?: string;
    nonce?: string | null;
    audience?: string;
    tokenIssuer?: string;
}

/**
 * OAuth2 client
 */
export default class OAuth2client implements Auth {
    /**
     * The base URL for auth endpoints.
     */
    protected static readonly OAUTH2_AUTH_BASE_URI: string = '/authorize';

    /**
     * The base endpoint for token retrieval.
     */
    protected static readonly OAUTH2_TOKEN_URI: string = '/token';

    /**
     * The base endpoint to revoke tokens.
     */
    protected static readonly OAUTH2_LOGOUT_URI: string = '/logout';

    /**
     * certificates.
     */
    // protected static readonly OAUTH2_FEDERATED_SIGNON_CERTS_URL = 'https://www.example.com/oauth2/v1/certs';

    public credentials: ICredentials;
    public options: IOptions;

    constructor(options: IOptions) {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO add minimum validation

        this.options = options;
        this.credentials = {};
    }

    public static BASE64URLENCODE(str: Buffer) {
        return str.toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    public static SHA256(buffer: any) {
        return crypto.createHash('sha256')
            .update(buffer)
            .digest();
    }

    /**
     * Generates URL for consent page landing.
     */
    public generateAuthUrl(optOpts: IGenerateAuthUrlOpts) {
        const options: any = {
            response_type: 'code',
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            scope: optOpts.scopes.join(' '),
            state: optOpts.state
        };

        if (optOpts.codeVerifier !== undefined) {
            options.code_challenge_method = 'S256';
            options.code_challenge = OAuth2client.BASE64URLENCODE(OAuth2client.SHA256(optOpts.codeVerifier));
        }

        const rootUrl = `https://${this.options.domain}${OAuth2client.OAUTH2_AUTH_BASE_URI}`;

        return `${rootUrl}?${querystring.stringify(options)}`;
    }

    /**
     * Generates URL for logout.
     */
    public generateLogoutUrl() {
        const options: any = {
            client_id: this.options.clientId,
            logout_uri: this.options.logoutUri
        };

        const rootUrl = `https://${this.options.domain}${OAuth2client.OAUTH2_LOGOUT_URI}`;

        return `${rootUrl}?${querystring.stringify(options)}`;
    }

    /**
     * Gets the access token for the given code.
     * @param {string} code The authorization code.
     */
    public async getToken(code: string, codeVerifier?: string): Promise<ICredentials> {
        const form = {
            code: code,
            client_id: this.options.clientId,
            redirect_uri: this.options.redirectUri,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier
        };
        const secret = Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`, 'utf8')
            .toString('base64');
        const options: RequestInit = {
            body: querystring.stringify(form),
            method: 'POST',
            headers: {
                Authorization: `Basic ${secret}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        debug('fetching...', options);

        return fetch(
            `https://${this.options.domain}${OAuth2client.OAUTH2_TOKEN_URI}`,
            options
        )
            .then(async (response) => {
                debug('response:', response.status);
                if (response.status !== OK) {
                    if (response.status === BAD_REQUEST) {
                        const body = await response.json();
                        throw new Error(body.error);
                    } else {
                        const body = await response.text();
                        throw new Error(body);
                    }
                } else {
                    const tokens = await response.json();
                    // tslint:disable-next-line:no-single-line-block-comment
                    /* istanbul ignore else */
                    if (tokens && tokens.expires_in) {
                        // tslint:disable-next-line:no-magic-numbers
                        tokens.expiry_date = ((new Date()).getTime() + (tokens.expires_in * 1000));
                        delete tokens.expires_in;
                    }

                    return tokens;
                }
            });
    }

    /**
     * OAuthクライアントに認証情報をセットします。
     */
    public setCredentials(credentials: ICredentials) {
        this.credentials = credentials;
    }

    public async refreshAccessToken(): Promise<ICredentials> {
        if (this.credentials.refresh_token === undefined) {
            throw new Error('No refresh token is set.');
        }

        return this.refreshToken(this.credentials.refresh_token)
            .then((tokens) => {
                tokens.refresh_token = this.credentials.refresh_token;
                debug('setting credentials...', tokens);
                this.credentials = tokens;

                return this.credentials;
            });
    }

    /**
     * 期限の切れていないアクセストークンを取得します。
     * 必要であれば更新してから取得します。
     */
    public async getAccessToken(): Promise<string> {
        // tslint:disable-next-line:max-line-length
        const expiryDate = this.credentials.expiry_date;

        // if no expiry time, assume it's not expired
        const isTokenExpired = (expiryDate !== undefined) ? (expiryDate <= (new Date()).getTime()) : false;

        if (this.credentials.access_token === undefined && this.credentials.refresh_token === undefined) {
            throw new Error('No access or refresh token is set.');
        }

        const shouldRefresh = (this.credentials.access_token === undefined) || isTokenExpired;
        if (shouldRefresh && this.credentials.refresh_token !== undefined) {
            await this.refreshAccessToken();
        }

        return <string>this.credentials.access_token;
    }

    // public async signInWithLINE(idToken: string): Promise<ICredentials> {
    //     // request for new token
    //     debug('requesting access token...');

    //     return await request.post({
    //         url: `${API_ENDPOINT}/oauth/token/signInWithGoogle`,
    //         body: {
    //             idToken: idToken,
    //             client_id: this.clientId,
    //             client_secret: this.clientSecret,
    //             scopes: this.scopes,
    //             state: this.state
    //         },
    //         json: true,
    //         simple: false,
    //         resolveWithFullResponse: true,
    //         useQuerystring: true
    //     }).then((response) => {
    //         if (response.statusCode !== httpStatus.OK) {
    //             if (typeof response.body === 'string') {
    //                 throw new Error(response.body);
    //             }

    //             if (typeof response.body === 'object' && response.body.errors !== undefined) {
    //                 const message = (<any[]>response.body.errors).map((error) => {
    //                     return `[${error.title}]${error.detail}`;
    //                 }).join(', ');

    //                 throw new Error(message);
    //             }

    //             throw new Error('An unexpected error occurred');
    //         }

    //         const tokens = response.body;
    //         if (tokens && tokens.expires_in) {
    //             // tslint:disable-next-line:no-magic-numbers
    //             tokens.expiry_date = ((new Date()).getTime() + (tokens.expires_in * 1000));
    //             delete tokens.expires_in;
    //         }

    //         this.credentials = tokens;

    //         return tokens;
    //     });
    // }

    /**
     * Revokes the access given to token.
     * @param {string} token The existing token to be revoked.
     */
    // public revokeToken(token: string) {
    // }

    /**
     * Provides a request implementation with OAuth 2.0 flow.
     * If credentials have a refresh_token, in cases of HTTP
     * 401 and 403 responses, it automatically asks for a new
     * access token and replays the unsuccessful request.
     * @param {request.OptionsWithUri} options Request options.
     * @return {Promise<any>}
     */
    public async fetch(url: string, options: RequestInit, expectedStatusCodes: number[]) {
        // Callbacks will close over this to ensure that we only retry once
        let retry = true;

        options.headers = (options.headers === undefined || options.headers === null) ? {} : options.headers;

        let result: any;
        let numberOfTry = 0;
        // tslint:disable-next-line:no-magic-numbers
        while (numberOfTry >= 0) {
            try {
                numberOfTry += 1;
                if (numberOfTry > 1) {
                    retry = false;
                }

                (<any>options.headers).Authorization = `Bearer ${await this.getAccessToken()}`;
                result = await this.makeFetch(url, options, expectedStatusCodes);

                break;
            } catch (error) {
                // tslint:disable-next-line:no-single-line-block-comment
                /* istanbul ignore else */
                if (error instanceof Error) {
                    const statusCode = (<transporters.RequestError>error).code;

                    if (retry && (statusCode === UNAUTHORIZED || statusCode === FORBIDDEN)) {
                        /* It only makes sense to retry once, because the retry is intended
                         * to handle expiration-related failures. If refreshing the token
                         * does not fix the failure, then refreshing again probably won't
                         * help */

                        // Force token refresh
                        await this.refreshAccessToken();

                        continue;
                    }
                }

                throw error;
            }
        }

        return result;
    }

    /**
     * Provides a request implementation with OAuth 2.0 flow.
     * If credentials have a refresh_token, in cases of HTTP
     * 401 and 403 responses, it automatically asks for a new
     * access token and replays the unsuccessful request.
     * @param {request.OptionsWithUri} options Request options.
     * @return {Promise<any>}
     */
    // public async request(options: request.OptionsWithUri, expectedStatusCodes: number[]) {
    //     const accessToken = await this.getAccessToken();
    //     options.auth = { bearer: accessToken };

    //     return this.makeRequest(options, expectedStatusCodes);
    // }

    /**
     * Makes a request without paying attention to refreshing or anything
     * Assumes that all credentials are set correctly.
     * @param  {object}   opts     Options for request
     * @param  {Function} callback callback function
     * @return {Request}           The request object created
     */
    // tslint:disable-next-line:prefer-function-over-method
    // public async makeRequest(options: request.OptionsWithUri, expectedStatusCodes: number[]) {
    //     const transporter = new DefaultTransporter(expectedStatusCodes);

    //     return transporter.request(options);
    // }

    /**
     * Makes a request without paying attention to refreshing or anything
     * Assumes that all credentials are set correctly.
     * @param  {object}   opts     Options for request
     * @param  {Function} callback callback function
     * @return {Request}           The request object created
     */
    // tslint:disable-next-line:prefer-function-over-method
    protected async makeFetch(url: string, options: RequestInit, expectedStatusCodes: number[]) {
        const transporter = new transporters.DefaultTransporter(expectedStatusCodes);

        return transporter.fetch(url, options);
    }

    /**
     * Verify id token is token by checking the certs and audience
     * @param {string} idToken ID Token.
     * @param {(string|Array.<string>)} audience The audience to verify against the ID Token
     * @param {function=} callback Callback supplying GoogleLogin if successful
     */
    // public verifyIdToken(
    //     idToken: string, audience: string | string[],
    //     callback: (err: Error, login?: LoginTicket) => void) {
    //     if (!idToken || !callback) {
    //         throw new Error(
    //             'The verifyIdToken method requires both ' +
    //             'an ID Token and a callback method');
    //     }

    //     this.getFederatedSignonCerts(((err: Error, certs: any) => {
    //         if (err) {
    //             callback(err, null);
    //         }
    //         let login;
    //         try {
    //             login = this.verifySignedJwtWithCerts(
    //                 idToken, certs, audience,
    //                 OAuth2Client.ISSUERS_);
    //         } catch (err) {
    //             callback(err);
    //             return;
    //         }

    //         callback(null, login);
    //     }).bind(this));
    // }

    /**
     * Gets federated sign-on certificates to use for verifying identity tokens.
     * Returns certs as array structure, where keys are key ids, and values
     * are PEM encoded certificates.
     * @param {function=} callback Callback supplying the certificates
     */
    // public getFederatedSignonCerts(callback: BodyResponseCallback) {
    //     const nowTime = (new Date()).getTime();
    //     if (this._certificateExpiry &&
    //         (nowTime < this._certificateExpiry.getTime())) {
    //         callback(null, this._certificateCache);
    //         return;
    //     }

    //     this.transporter.request(
    //         {
    //             method: 'GET',
    //             uri: OAuth2Client.GOOGLE_OAUTH2_FEDERATED_SIGNON_CERTS_URL_,
    //             json: true
    //         },
    //         (err, body, response) => {
    //             if (err) {
    //                 callback(
    //                     new RequestError(
    //                         'Failed to retrieve verification certificates: ' + err),
    //                     null, response);
    //                 return;
    //             }
    //             const cacheControl = response.headers['cache-control'];
    //             let cacheAge = -1;
    //             if (cacheControl) {
    //                 const pattern = new RegExp('max-age=([0-9]*)');
    //                 const regexResult = pattern.exec(cacheControl);
    //                 if (regexResult.length === 2) {
    //                     // Cache results with max-age (in seconds)
    //                     cacheAge = Number(regexResult[1]) * 1000;  // milliseconds
    //                 }
    //             }

    //             const now = new Date();
    //             this._certificateExpiry =
    //                 cacheAge === -1 ? null : new Date(now.getTime() + cacheAge);
    //             this._certificateCache = body;
    //             callback(null, body, response);
    //         });
    // }

    /**
     * Verify the id token is signed with the correct certificate
     * and is from the correct audience.
     * @param {string} jwt The jwt to verify (The ID Token in this case).
     * @param {array} certs The array of certs to test the jwt against.
     * @param {(string|Array.<string>)} requiredAudience The audience to test the jwt against.
     * @param {array} issuers The allowed issuers of the jwt (Optional).
     * @param {string} maxExpiry The max expiry the certificate can be (Optional).
     * @return {LoginTicket} Returns a LoginTicket on verification.
     */
    // public verifySignedJwtWithCerts(
    //     jwt: string, certs: any, requiredAudience: string | string[],
    //     issuers?: string[], maxExpiry?: number) {
    //     if (!maxExpiry) {
    //         maxExpiry = OAuth2Client.MAX_TOKEN_LIFETIME_SECS_;
    //     }

    //     const segments = jwt.split('.');
    //     if (segments.length !== 3) {
    //         throw new Error('Wrong number of segments in token: ' + jwt);
    //     }
    //     const signed = segments[0] + '.' + segments[1];
    //     const signature = segments[2];

    //     let envelope;
    //     let payload;

    //     try {
    //         envelope = JSON.parse(this.decodeBase64(segments[0]));
    //     } catch (err) {
    //         throw new Error('Can\'t parse token envelope: ' + segments[0]);
    //     }

    //     if (!envelope) {
    //         throw new Error('Can\'t parse token envelope: ' + segments[0]);
    //     }

    //     try {
    //         payload = JSON.parse(this.decodeBase64(segments[1]));
    //     } catch (err) {
    //         throw new Error('Can\'t parse token payload: ' + segments[0]);
    //     }

    //     if (!payload) {
    //         throw new Error('Can\'t parse token payload: ' + segments[1]);
    //     }

    //     if (!certs.hasOwnProperty(envelope.kid)) {
    //         // If this is not present, then there's no reason to attempt verification
    //         throw new Error('No pem found for envelope: ' + JSON.stringify(envelope));
    //     }
    //     const pem = certs[envelope.kid];
    //     const pemVerifier = new PemVerifier();
    //     const verified = pemVerifier.verify(pem, signed, signature, 'base64');

    //     if (!verified) {
    //         throw new Error('Invalid token signature: ' + jwt);
    //     }

    //     if (!payload.iat) {
    //         throw new Error('No issue time in token: ' + JSON.stringify(payload));
    //     }

    //     if (!payload.exp) {
    //         throw new Error(
    //             'No expiration time in token: ' + JSON.stringify(payload));
    //     }

    //     const iat = parseInt(payload.iat, 10);
    //     const exp = parseInt(payload.exp, 10);
    //     const now = new Date().getTime() / 1000;

    //     if (exp >= now + maxExpiry) {
    //         throw new Error(
    //             'Expiration time too far in future: ' + JSON.stringify(payload));
    //     }

    //     const earliest = iat - OAuth2Client.CLOCK_SKEW_SECS_;
    //     const latest = exp + OAuth2Client.CLOCK_SKEW_SECS_;

    //     if (now < earliest) {
    //         throw new Error(
    //             'Token used too early, ' + now + ' < ' + earliest + ': ' +
    //             JSON.stringify(payload));
    //     }

    //     if (now > latest) {
    //         throw new Error(
    //             'Token used too late, ' + now + ' > ' + latest + ': ' +
    //             JSON.stringify(payload));
    //     }

    //     if (issuers && issuers.indexOf(payload.iss) < 0) {
    //         throw new Error(
    //             'Invalid issuer, expected one of [' + issuers + '], but got ' +
    //             payload.iss);
    //     }

    //     // Check the audience matches if we have one
    //     if (typeof requiredAudience !== 'undefined' && requiredAudience !== null) {
    //         const aud = payload.aud;
    //         let audVerified = false;
    //         // If the requiredAudience is an array, check if it contains token
    //         // audience
    //         if (requiredAudience.constructor === Array) {
    //             audVerified = (requiredAudience.indexOf(aud) > -1);
    //         } else {
    //             audVerified = (aud === requiredAudience);
    //         }
    //         if (!audVerified) {
    //             throw new Error(
    //                 'Wrong recipient, payload audience != requiredAudience');
    //         }
    //     }
    //     return new LoginTicket(envelope, payload);
    // }

    /**
     * This is a utils method to decode a base64 string
     * @param {string} b64String The string to base64 decode
     * @return {string} The decoded string
     */
    // public decodeBase64(b64String: string) {
    //     const buffer = new Buffer(b64String, 'base64');
    //     return buffer.toString('utf8');
    // }

    /**
     * Refreshes the access token.
     */
    protected async refreshToken(refreshToken: string): Promise<ICredentials> {
        // request for new token
        debug('refreshing access token...', this.credentials, refreshToken);

        const form = {
            client_id: this.options.clientId,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        };
        const secret = Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`, 'utf8')
            .toString('base64');
        const options: RequestInit = {
            body: querystring.stringify(form),
            method: 'POST',
            headers: {
                Authorization: `Basic ${secret}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        debug('fetching...', options);

        return fetch(
            `https://${this.options.domain}${OAuth2client.OAUTH2_TOKEN_URI}`,
            options
        )
            .then(async (response) => {
                debug('response:', response.status);
                if (response.status !== OK) {
                    if (response.status === BAD_REQUEST) {
                        const body = await response.json();
                        throw new Error(body.error);
                    } else {
                        const body = await response.text();
                        throw new Error(body);
                    }
                } else {
                    const tokens = await response.json();
                    // tslint:disable-next-line:no-single-line-block-comment
                    /* istanbul ignore else */
                    if (tokens && tokens.expires_in) {
                        // tslint:disable-next-line:no-magic-numbers
                        tokens.expiry_date = ((new Date()).getTime() + (tokens.expires_in * 1000));
                        delete tokens.expires_in;
                    }

                    return tokens;
                }
            });
    }
}
