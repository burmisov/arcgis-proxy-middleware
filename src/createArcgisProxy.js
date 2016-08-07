const debug = require('debug')('arcgis-proxy-middleware');
const request = require('request');

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

  const genTokenUrl = agsSrvUrl + tokenPath;
  const params = {
    f: 'json',
    username,
    password,
    client: 'requestip',
    expiration: 5,
  };

  return function(req, res, next) {
    let queryPref = '?';
    const path = req.originalUrl;
    request.post({
      url: agsSrvUrl,
      form: params
    }, (error, response, body) => {
      if (error || response.statusCode !== 200) {
        debug('error getting token:', error);
        return res.sendStatus(500);
      } else {
        const tokenInfo = JSON.parse(body);
        const token = tokenInfo.token;
        if (path.indexOf('?') + 1) {
          queryPref = '&';
        }
        if (!req.method || req.method === 'GET') {
          request
            .get(agsSrvUrl + path + queryPref + 'token=' + token)
            .pipe(res)
          ;
        } else {
          const form = {
            ...req.body,
            token,
          }
          request
            .post(host + path)
            .form(req.body)
            .pipe(res)
          ;
        }
      }
    }
  }
}
