type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** JSON.parse limits the input to JSON values; field readers enforce the provider contract. */
export function parseJson(text: string): JsonValue {
  return JSON.parse(text);
}

function properties(value: JsonValue) {
  if (value === null || Array.isArray(value) || Object(value) !== value) {
    throw new Error("Sync received an invalid JSON object.");
  }

  // SAFETY: JSON.parse produced this value, and the checks exclude null, arrays, and primitives.
  return value as { [key: string]: JsonValue };
}

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
