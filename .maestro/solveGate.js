/* global CHALLENGE, output */
const raw = typeof CHALLENGE === 'string' ? CHALLENGE : '';
const match = raw.match(/(\d+)\s*[×x*]\s*(\d+)/);

if (!match) {
  throw new Error('Could not parse parental gate multiplication challenge from: ' + raw);
}

const left = parseInt(match[1], 10);
const right = parseInt(match[2], 10);

output.answer = String(left * right);
