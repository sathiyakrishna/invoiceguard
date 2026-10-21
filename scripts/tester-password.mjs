import { randomInt } from 'node:crypto';

// No look-alike characters (0/O, 1/l/I) so it can be read from a terminal; 6 bits per character (64 symbols).
export const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_@#%+=';

export function generatePassword(length = 20) {
  return Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join('');
}
