"use strict";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS,HEAD",
  "Access-Control-Allow-Headers": "Content-Type,Accept,Authorization",
};

function createCorsHeaders(extraHeaders) {
  return Object.assign({}, CORS_HEADERS, extraHeaders || {});
}

function sendJson(response, statusCode, body, extraHeaders) {
  response.writeHead(
    statusCode,
    createCorsHeaders(
      Object.assign(
        {
          "Content-Type": "application/json; charset=utf-8",
        },
        extraHeaders || {}
      )
    )
  );
  response.end(JSON.stringify(body || {}));
}

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode, createCorsHeaders());
  response.end();
}

module.exports = {
  createCorsHeaders,
  sendEmpty,
  sendJson,
};
