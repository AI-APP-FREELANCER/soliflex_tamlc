import { ApiError } from "../middleware/errors";

/**
 * Plant names: letters/numbers only, words joined by a single underscore
 * (e.g. "Unit_1", "Bay_4_North"). No spaces or other punctuation, no leading
 * or trailing underscore, no double underscore, 3-20 characters total.
 */
const PLANT_NAME_RE = /^(?=.{3,20}$)[A-Za-z0-9]+(_[A-Za-z0-9]+)*$/;

export function assertValidPlantName(name: string): void {
  if (!PLANT_NAME_RE.test(name)) {
    throw new ApiError(
      400,
      "Plant name must be 3-20 characters, letters and numbers only, with a single underscore between words (e.g. Unit_1) - no spaces or other symbols"
    );
  }
}
