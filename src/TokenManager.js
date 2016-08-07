const debug = require('debug')('arcgis-proxy-middleware:token-manager');

const fetch = require('isomorphic-fetch');
const objectToFormData = require('./objectToFormData');

const DEFAULT_TOKEN_EXPIRATION = 60 // minutes
const DEFAULT_USAGE_RATIO = 0.8 // e.g. 60 * 0.8 = 40 minutes, then renew
const WATCH_INTERVAL_RATIO = 0.05; // watch token every 0.05 * 60 = 3 minutes

class TokenManager {
  constructor({
    genTokenUrl, username, password, tokenExpiration, usageRatio
  }) {
    this.genTokenUrl = genTokenUrl;
    this.username = username;
    this.password = password;

    this.tokenExpiration = tokenExpiration || DEFAULT_TOKEN_EXPIRATION;
    this.usageRatio = usageRatio || DEFAULT_USAGE_RATIO;

    this.haveToken = false;
    this.lastTimeTokenUsed = false;

    this.watchInterval = this.tokenExpiration * WATCH_INTERVAL_RATIO * 60 * 1000;

    debug('Instance created with genTokenUrl=%s', this.genTokenUrl);
  }

  getToken() {
    this.lastTimeTokenUsed = new Date();
    return Promise.resolve().then(() => {
      if (this.haveToken) {
        debug('getToken providing token immediately.');
        return this.token;
      } else {
        debug('getToken falling back to ensuring token.');
        return this.ensureToken().then(() => {
          return this.token;
        });
      }
    });
  }

  stopWatching() {
    clearTimeout(this.watchTimeoutHandle);
  }

  ensureToken() {
    return Promise.resolve().then(() => {
      if (this.haveToken) {
        debug('ensureToken providing token immediately')
        return this.token;
      } else {
        debug('ensureToken acquiring token')
        return this.acquireToken().then(token => {
          this.token = token;
          this.haveToken = true;
          this.tokenAcqTime = new Date();
          this.lastTimeTokenUsed = false;
          this.startWatchingToken();
          return this.token;
        });
      }
    });
  }

  acquireToken() {
    const form = objectToFormData({
      f: 'json',
      client: 'referer',
      referer: 'http://arcgis.proxy',
      expiration: this.tokenExpiration,
      username: this.username,
      password: this.password,
    });
    return fetch(
      this.genTokenUrl,
      { method: 'POST', body: form }
    ).then(res => {
      if (res.status !== 200) {
        debug('acquired token unsuccessful with status=%s', res.status);
        debug(res.body);
        throw new Error('Token generation unsuccessful.');
      }
      return res.json();
    }).then(jsonResponse => {
      debug('token acquire success');
      const token = jsonResponse.token;
      return token;
    });
  }

  startWatchingToken() {
    debug('start watching token expiration');
    this.watchTimeoutHandle = setTimeout(
      () => this.watchToken(),
      this.watchInterval
    );
  }

  watchToken() {
    const currentTime = new Date();

    // Check if token can still be used
    const totalUsageSoFar =
      ((currentTime - this.tokenAcqTime) / (60 * 1000) ) / this.tokenExpiration
    ;
    const totalUsageExpired = totalUsageSoFar >= this.usageRatio;
    if (!totalUsageExpired) {
      debug('watched token: still can be used');
      this.watchTimeoutHandle = setTimeout(
        () => this.watchToken(),
        this.watchInterval
      );
      return;
    }

    if (this.lastTimeTokenUsed) {
      // Token have been used - renew automatically
      debug('watch token: have been used, renewing');
      this.haveToken = false;
      this.ensureToken();
    } else {
      // Token haven't been used - shut it down until next usage
      debug('watch token: have been idle, standing by');
      this.haveToken = false;
    }
  }
}

module.exports = TokenManager;
