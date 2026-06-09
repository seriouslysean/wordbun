import { dateToYYYYMMDD } from '#utils/date-utils';

/** One day cell in a year grid. `date` is null for leading-weekday padding. */
export interface ActivityCell {
  date: string | null;
  active: boolean;
}

export interface YearActivity {
  year: string;
  total: number;
  cells: ActivityCell[];
}

/**
 * Builds one calendar-year activity grid per year present in the data, anchored
 * Jan 1–Dec 31 with leading-weekday padding so a CSS grid (7 rows, column flow)
 * renders a GitHub-style heatmap. Deterministic: only years with words are
 * produced and no current-date is read, so demo and production render stably.
 */
export const buildActivityCalendar = (dates: string[]): YearActivity[] => {
  const activeDates = new Set(dates);
  const years = [...new Set(dates.map(date => date.slice(0, 4)))].toSorted();

  return years.map(year => {
    const cells: ActivityCell[] = [];
    const yearNum = Number(year);

    // Pad so Jan 1 lands on its real weekday (0 = Sunday) in the first column.
    const leadingDays = new Date(yearNum, 0, 1).getDay();
    for (let i = 0; i < leadingDays; i++) {
      cells.push({ date: null, active: false });
    }

    // Day 0 = Jan 1; advancing the day index rolls months automatically. Stop
    // once the date crosses into the next year (handles 365 vs 366).
    for (let day = 0; day < 366; day++) {
      const date = new Date(yearNum, 0, 1 + day);
      if (date.getFullYear() !== yearNum) {
        break;
      }
      const ymd = dateToYYYYMMDD(date);
      cells.push({ date: ymd, active: activeDates.has(ymd) });
    }

    return { year, total: cells.filter(cell => cell.active).length, cells };
  });
};
