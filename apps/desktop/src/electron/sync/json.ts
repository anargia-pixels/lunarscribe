// JSON boundary
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Parse JSON without copying remote response data into error messages. */
export function parseJson(text: string): JsonValue {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Sync received invalid JSON.");
  }
}

/** Reject arrays and primitives before reading JSON object fields. */
function properties(value: JsonValue) {
  if (value === null || Array.isArray(value) || Object(value) !== value) {
    throw new Error("Sync received an invalid JSON object.");
  }

  // SAFETY: Parsed JSON passed the object checks above.
  return value as { [key: string]: JsonValue };
}

// Field readers
export function jsonField(value: JsonValue, key: string) {
  return properties(value)[key];
}

export function jsonString(value: JsonValue, key: string, optional = false) {
  const field = jsonField(value, key);

  if (optional && (field === undefined || field === null)) {
    return "";
  }

  if (field !== undefined && field === String(field)) {
    return String(field);
  }

  throw new Error(`Sync received an invalid ${key} field.`);
}

export function jsonNumber(value: JsonValue, key: string) {
  const field = jsonField(value, key);

  if (Number.isFinite(field)) {
    return Number(field);
  }

  throw new Error(`Sync received an invalid ${key} field.`);
}

export function jsonBoolean(value: JsonValue, key: string) {
  const field = jsonField(value, key);

  if (field === true || field === false) {
    return field;
  }

  throw new Error(`Sync received an invalid ${key} field.`);
}

export function jsonArray(value: JsonValue, key: string) {
  const field = jsonField(value, key);

  if (!Array.isArray(field)) {
    throw new Error(`Sync received an invalid ${key} list.`);
  }

  return field;
}

/** Read saved hashes as own properties without changing the prototype. */
export function jsonStrings(value: JsonValue) {
  const result: Record<string, string> = {};

  for (const [key, field] of Object.entries(properties(value))) {
    if (field !== String(field)) {
      throw new Error("Stored sync history is invalid.");
    }

    Object.defineProperty(result, key, {
      value: String(field),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  return result;
}
