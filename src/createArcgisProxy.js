const debug = require('debug')('arcgis-proxy-middleware:proxy');

const request = require('request');
const qs = require('querystring');

const TokenManager = require('./TokenManager');

/**
  Creates Arcgis server authenticating middleware

  @param options
  @param options.agsSrvUrl <string> "http://arcgis.server"
  @param options.genTokenPath <string> ""/path-to-gen-token-service"
  @param options.username <string> username for arcgis server
  @param options.password <string> password for username
*/
module.exports = function createArcgisProxy(options) {
  const {
    agsSrvUrl,
    genTokenPath,
    username,
    password
  } = options;

  if (!(agsSrvUrl || genTokenPath || username || password)) {
    throw new Error("No option can be blank for createArcgisProxy.");
  }

  const tokenManager = new TokenManager({
    genTokenUrl: agsSrvUrl + genTokenPath,
    username,
    password,
  });

  debug('creating middleware');

  return function(req, res, next) {
    debug('requested %s %s', req.method, req.originalUrl);
    tokenManager.getToken().then(token => {
      debug('got token');
      if (req.method === 'GET') {
        const querySeparator = req.originalUrl.indexOf('?') > -1 ? '&' : '?';
        const pathWithToken = agsSrvUrl + req.originalUrl + querySeparator + 'token=' + token;
        debug('performing GET %s', pathWithToken);
        request({
          method: 'GET',
          url: pathWithToken,
          followRedirect: false,
          headers: { Referer: 'http://arcgis.proxy' }
        }).pipe(res);
      } else {
        debug('%s %s', req.method, req.originalUrl);
        const bodyWithToken = Object.assign({}, req.body, { token });
        request({
          method: req.method,
          url: agsSrvUrl + req.originalUrl,
          form: bodyWithToken,
        }).pipe(res);
      }
    }).catch(err => {
      debug(err.message);
      return res.status(500).send('Was unable to acquire token');
    });
  }
}
