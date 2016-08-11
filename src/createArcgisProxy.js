const debug = require('debug')('arcgis-proxy-middleware:proxy');

const TokenManager = require('./TokenManager');
const httpProxy = require('http-proxy');
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

  const proxy = httpProxy.createServer({
    target: agsSrvUrl,
    secure: false,
  });

  const middleware = (req, res, next) => {
    if (!/^\/arcgis\//.test(req.path)) {
      return next();
    }
    debug('original request, method=%s, url=%s', req.method, req.url);
    return Promise.resolve().then(() => {
      return tokenManager.getToken();
    }).then(token => {
      const originalUrlObject = url.parse(req.url, true);
      const newUrlObject = {
        query: Object.assign(originalUrlObject.query, { token }),
        pathname: originalUrlObject.pathname,
      };
      const newUrl = url.format(newUrlObject);
      req.url = newUrl;
      req.headers['Referer'] = 'http://arcgis.proxy';
      proxy.web(req, res);
    });
  };

  return middleware;
};
