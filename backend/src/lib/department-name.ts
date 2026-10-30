import { ApiError } from "../middleware/errors";

/**
 * Department / product category and Designation names: looser than Plant
 * names (spaces, hyphens, slashes and ampersands are fine, e.g. "Container
 * liner"), just trimmed and length-bounded.
 */
const NAME_RE = /^(?=.{2,40}$)[A-Za-z0-9][A-Za-z0-9 &/_-]*[A-Za-z0-9]$|^[A-Za-z0-9]{2,40}$/;

export function assertValidAdminListName(kind: string, name: string): void {
  if (!NAME_RE.test(name)) {
    throw new ApiError(400, `${kind} name must be 2-40 characters and start/end with a letter or number`);
  }
}

export function assertValidDepartmentName(name: string): void {
  assertValidAdminListName("Department", name);
}
