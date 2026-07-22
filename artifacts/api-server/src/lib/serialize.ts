
export function toJsonSafe<T>(value: T): unknown {
 return JSON.parse(JSON.stringify(value));
}


