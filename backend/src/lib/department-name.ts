import { ApiError } from "../middleware/errors";

/**
 * Department / product category names: looser than Plant names (spaces,
 * hyphens, slashes and ampersands are fine, e.g. "Container liner"), just
 * trimmed and length-bounded.
 */
const DEPARTMENT_NAME_RE = /^(?=.{2,40}$)[A-Za-z0-9][A-Za-z0-9 &/_-]*[A-Za-z0-9]$|^[A-Za-z0-9]{2,40}$/;

export function assertValidDepartmentName(name: string): void {
  if (!DEPARTMENT_NAME_RE.test(name)) {
    throw new ApiError(400, "Department name must be 2-40 characters and start/end with a letter or number");
  }
}
