#!/usr/bin/env node

import http from 'node:http';
import net from 'node:net';

const listenHost = process.env.PROXY_HOST || '127.0.0.1';
const listenPort = Number(process.env.PROXY_PORT || 8888);

function fail(socket, error) {
  if (!socket.destroyed) {
    socket.destroy(error);
  }
}

const server = http.createServer((request, response) => {
  let target;
  try {
    target = new URL(request.url);
  } catch {
    target = new URL(`http://${request.headers.host}${request.url}`);
  }

  const headers = { ...request.headers, host: target.host };
  delete headers['proxy-connection'];

  const upstream = http.request({
    hostname: target.hostname,
    port: target.port || 80,
    method: request.method,
    path: `${target.pathname}${target.search}`,
    headers,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  upstream.on('error', (error) => {
    if (!response.headersSent) {
      response.writeHead(502, { 'content-type': 'text/plain' });
    }
    response.end(`proxy error: ${error.message}\n`);
  });
  request.pipe(upstream);
});

server.on('connect', (request, clientSocket, head) => {
  const separator = request.url.lastIndexOf(':');
  const targetHost = separator === -1 ? request.url : request.url.slice(0, separator);
  const targetPort = separator === -1 ? 443 : Number(request.url.slice(separator + 1));
  const upstreamSocket = net.connect(targetPort, targetHost, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length) {
      upstreamSocket.write(head);
    }
    upstreamSocket.pipe(clientSocket);
    clientSocket.pipe(upstreamSocket);
  });

  upstreamSocket.on('error', (error) => fail(clientSocket, error));
  clientSocket.on('error', (error) => fail(upstreamSocket, error));
});

server.listen(listenPort, listenHost, () => {
  console.log(`ADB forward proxy listening on ${listenHost}:${listenPort}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
