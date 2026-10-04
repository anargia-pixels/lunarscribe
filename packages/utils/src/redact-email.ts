/** Show the first four characters and the domain, such as `code…@gmail.com`; other names pass through. */
export function redactEmail(account: string) {
  const at = account.lastIndexOf("@");

  if (at === -1) {
    return account;
  }

  return `${account.slice(0, Math.min(at, 4))}…${account.slice(at)}`;
}
