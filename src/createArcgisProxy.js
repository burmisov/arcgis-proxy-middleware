const debug = require('debug')('arcgis-proxy-middleware:proxy');

const TokenManager = require('./TokenManager');
const proxy = require('express-http-proxy');
const url = require('url');
const querystring = require('querystring');

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

  const middleware = proxy(agsSrvUrl, {
    forwardPathAsync: (req, res) => {
      return Promise.resolve().then(() => {
        return tokenManager.getToken();
      }).then(token => {
        debug('original request, method=%s, url=%s', req.method, req.url);
        const urlObject = url.parse(req.url, true);
        const newPath =
          urlObject.pathname + '?' +
          querystring.stringify(Object.assign(urlObject.query, { token }))
        ;
        return newPath;
      });
    },
    decorateRequest: (proxyReq, originalReq) => {
      proxyReq.headers['Referer'] = 'http://arcgis.proxy';
      return proxyReq;
    },
    filter: (req, res) => {
      const result = /^\/arcgis\//.test(req.path);
      return result;
    },
  });

  return middleware;
};
