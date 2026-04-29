import http from 'node:http';
import https from 'node:https';

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

/**
 * Performs one HTTP request through Node's core clients and normalizes the result into a Response.
 */
export async function request(
  url: string,
  options: RequestOptions = {},
): Promise<Response> {
  const target = new URL(url);
  const transport = target.protocol === 'https:' ? https : http;

  return new Promise<Response>((resolve, reject) => {
    const req = transport.request(
      target,
      {
        method: options.method ?? 'GET',
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        res.on('end', () => {
          const body = Buffer.concat(chunks);
          const headers = new Headers();

          for (const [name, value] of Object.entries(res.headers)) {
            if (Array.isArray(value)) {
              for (const entry of value) {
                headers.append(name, entry);
              }
              continue;
            }

            if (typeof value === 'string') {
              headers.set(name, value);
            }
          }

          resolve(
            new Response(body, {
              status: res.statusCode ?? 500,
              headers,
            }),
          );
        });
      },
    );

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}
