/** A useful message for an error, with an operation-specific fallback. */
export function errorMessage(cause: unknown, fallback: string): string {
  if (!(cause instanceof Error)) {
    return fallback;
  }

  // Node's fetch hides the useful network error in `cause`; do not lose it.
  if (!/^(?:fetch failed|failed to fetch)$/iu.test(cause.message.trim())) {
    return cause.message;
  }

  const details = deepestError(cause);

  if (!details) {
    return cause.message;
  }

  return `Network request failed. ${networkAdvice(details)}${technicalDetail(details)}`;
}

/** The technical reason behind a failed request, if it has one. */
type FailureDetails = {
  name: string;
  code: string | undefined;
  message: string;
};

/** Follow `cause` and `AggregateError.errors` to the error that explains the failure. */
function deepestError(cause: unknown): FailureDetails | null {
  const seen = new Set<unknown>();
  let current = cause;
  let deepest: FailureDetails | null = null;

  while (current !== null && current !== undefined && !seen.has(current)) {
    seen.add(current);

    if (!(current instanceof Error)) {
      break;
    }

    // SAFETY: Fetch and Node errors may carry optional cause, code and errors fields.
    const error = current as Error & {
      cause?: unknown;
      code?: unknown;
      errors?: unknown[];
    };

    deepest = {
      name: error.name,
      code:
        error.code != null && /^[A-Z][A-Z0-9_]+$/u.test(String(error.code))
          ? String(error.code)
          : undefined,
      message: error.message.trim(),
    };

    // Node's fetch reports the network failure in `cause`; some runtimes use `errors`.
    current = error.errors?.length ? error.errors[0] : error.cause;
  }

  return deepest;
}

/** A sentence that helps the user fix the failure, keyed by the underlying error. */
function networkAdvice({ name, code, message }: FailureDetails) {
  // Browsers expose no cause for a failed fetch, but can still say they are offline.
  // SAFETY: `navigator` is absent in Node; browsers define `onLine` as a boolean.
  const navigator = (globalThis as { navigator?: { onLine?: boolean } })
    .navigator;

  if (navigator?.onLine === false) {
    return "You appear to be offline. Connect to the internet, then retry.";
  }

  // Electron reports `net::ERR_*` in the message instead of a separate code.
  const reason = /net::(ERR_[A-Z0-9_]+)/u.exec(message)?.[1] ?? code;

  if (
    name === "TimeoutError" ||
    reason === "ETIMEDOUT" ||
    reason === "UND_ERR_CONNECT_TIMEOUT" ||
    reason === "ERR_CONNECTION_TIMED_OUT" ||
    reason === "ERR_TIMED_OUT"
  ) {
    return "The request timed out. Check your network connection, then retry.";
  }

  switch (reason) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
    case "ERR_NAME_NOT_RESOLVED":
    case "ERR_NAME_RESOLUTION_FAILED":
      return "The server name could not be resolved. Check your internet connection or DNS settings, then retry.";
    case "ECONNREFUSED":
    case "ERR_CONNECTION_REFUSED":
      return "The connection was refused. Check any VPN, proxy or firewall, then retry.";
    case "ECONNRESET":
    case "EPIPE":
    case "ERR_CONNECTION_RESET":
    case "ERR_CONNECTION_CLOSED":
    case "ERR_CONNECTION_ABORTED":
    case "ERR_EMPTY_RESPONSE":
      return "The connection was reset. Check your network connection, then retry.";
    case "ENETUNREACH":
    case "EHOSTUNREACH":
    case "ERR_ADDRESS_UNREACHABLE":
      return "The network is unreachable. Check your internet connection, then retry.";
    case "ERR_INTERNET_DISCONNECTED":
    case "ERR_NETWORK_CHANGED":
      return "The internet connection was lost. Reconnect, then retry.";
    case "ERR_PROXY_CONNECTION_FAILED":
    case "ERR_TUNNEL_CONNECTION_FAILED":
      return "The proxy connection failed. Check your proxy settings, then retry.";
    case "CERT_HAS_EXPIRED":
    case "CERT_NOT_YET_VALID":
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "ERR_TLS_CERT_ALTNAME_INVALID":
    case "ERR_CERT_AUTHORITY_INVALID":
    case "ERR_CERT_COMMON_NAME_INVALID":
    case "ERR_CERT_DATE_INVALID":
    case "ERR_CERT_REVOKED":
      return "The server's certificate could not be verified. Check your system clock and any TLS-inspecting proxy or antivirus, then retry.";
    default:
      return "Check your internet connection, VPN, proxy or firewall, then retry.";
  }
}

/** The runtime's error text, when it says more than "fetch failed". */
function technicalDetail(details: FailureDetails) {
  // Runtimes wrap the useful error in a generic message; drop that wording.
  const isGeneric =
    /^(?:fetch failed|failed to fetch|load failed|networkerror)$/iu.test(
      details.message,
    );

  const detailText = isGeneric ? "" : details.message.replace(/\.$/u, "");

  const codeText =
    details.code && !detailText.includes(details.code) ? details.code : "";

  const technical = [detailText, codeText].filter(Boolean).join(" ");

  return technical ? ` Technical detail: ${technical}.` : "";
}

/**
 * A user-friendly explanation of a fetch failure, including the host and the underlying
 * network error. Callers can show it directly; it replaces the bare "fetch failed" that
 * runtimes report.
 */
export function describeFetchFailure(
  service: string,
  url: string,
  cause: unknown,
) {
  let host = "";

  try {
    host = new URL(url).host;
  } catch {
    // The URL came from this app, so this only guards a bug elsewhere.
  }

  const details = deepestError(cause);

  if (!details) {
    return `Could not reach ${service}${host ? ` (${host})` : ""}. ${networkAdvice({ name: "", code: undefined, message: "" })}`;
  }

  return `Could not reach ${service}${host ? ` (${host})` : ""}. ${networkAdvice(details)}${technicalDetail(details)}`;
}
