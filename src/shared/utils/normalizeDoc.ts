import { Types } from "mongoose";

export function toJSON<T>(doc: any): T {
  const visited = new WeakSet();

  function transform(value: any): any {
    if (value === null || value === undefined) return value;

    // สำหรับ ObjectId → string
    if (value instanceof Types.ObjectId) {
      return value.toString();
    }

    // สำหรับ Date
    if (value instanceof Date) {
      return value;
    }

    // สำหรับ Array
    if (Array.isArray(value)) {
      return value.map((v) => transform(v));
    }

    // สำหรับ plain object
    if (typeof value === "object") {
      if (visited.has(value)) return value;
      visited.add(value);

      const out: Record<string, any> = {};

      for (const key of Object.keys(value)) {
        if (key === "_id") {
          out["id"] = transform(value["_id"]);
        } else if (key === "__v") {
          continue;
        } else {
          out[key] = transform(value[key]);
        }
      }

      return out;
    }

    return value;
  }

  const plain = doc.toObject ? doc.toObject() : doc;
  return transform(plain);
}
