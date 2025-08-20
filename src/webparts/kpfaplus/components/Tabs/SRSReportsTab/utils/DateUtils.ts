// src/webparts/kpfaplus/components/Tabs/SRSReportsTab/utils/DateUtils.ts

/**
 * A lean utility for reliable, timezone-safe date operations in the SRS Reports Tab.
 * This utility ensures that all date comparisons are done in a "date-only" fashion,
 * preventing bugs caused by time and timezone differences.
 */
export class DateUtils {

  /**
   * Normalizes a Date object to the beginning of the day (00:00:00) in the local timezone.
   * This is the core function for ensuring a true "date-only" comparison.
   * 
   * @param date The date to normalize.
   * @returns A new Date object with the time set to midnight.
   */
  private static normalizeDateToLocalMidnight(date: Date): Date {
    if (!date) {
      // Return a non-comparable date to prevent errors
      return new Date(0); 
    }
    // Creates a new date with only Year, Month, and Day components, stripping time.
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /**
   * Reliably checks if a date falls within a specified period (inclusive).
   * It normalizes all dates before comparison to avoid timezone-related issues.
   * This function should be used instead of direct date comparisons (>=, <=).
   * 
   * @param date The date to check.
   * @param periodStart The start of the period.
   * @param periodEnd The end of the period.
   * @returns `true` if the date is within the range, otherwise `false`.
   */
  public static isDateInRange(date: Date, periodStart: Date, periodEnd: Date): boolean {
    if (!date || !periodStart || !periodEnd) {
      return false;
    }

    try {
      // Normalize all three dates to ensure a "date-only" comparison
      const normalizedDate = this.normalizeDateToLocalMidnight(date);
      const normalizedStart = this.normalizeDateToLocalMidnight(periodStart);
      const normalizedEnd = this.normalizeDateToLocalMidnight(periodEnd);

      // Perform the safe comparison
      return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
    } catch (error) {
      console.error("[DateUtils] Error in isDateInRange:", error);
      return false;
    }
  }
}