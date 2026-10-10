const {
    buildAnalyticsAxisTicks,
    buildAnalyticsFourHourViewPoints,
    buildAnalyticsHourlyViewPoints,
    buildAnalyticsHourlyTooltipTitle,
    buildAnalyticsLocalHourBoundary,
    buildAnalyticsViewSeries,
    formatAnalyticsAxisTick,
    formatAnalyticsDate,
    formatAnalyticsTime,
    formatAnalyticsTimeRange,
    getAnalyticsHourBucket
} = require("../public/js/analytics");

function localDateValue(date) {
    const pad = number => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
        pad(date.getDate());
}

describe("Analytics client hourly helpers", () => {
    test("starts with zero at publication when there are no views", () => {
        const range = {
            from: new Date("2026-10-01T10:30:00.000Z").getTime(),
            to: new Date("2026-10-01T12:10:00.000Z").getTime()
        };

        const points = buildAnalyticsHourlyViewPoints([], range);

        expect(points).toHaveLength(3);
        expect(points[0]).toMatchObject({
            x: range.from,
            y: 0,
            bucketStart: getAnalyticsHourBucket(range.from)
        });
        expect(points.map(point => point.y)).toEqual([0, 0, 0]);
    });

    test("fills every missing hour before the first view", () => {
        const range = {
            from: new Date("2026-10-01T10:30:00.000Z").getTime(),
            to: new Date("2026-10-01T13:20:00.000Z").getTime()
        };
        const firstViewBucket = new Date("2026-10-01T13:00:00.000Z");

        const points = buildAnalyticsHourlyViewPoints([{
            time: firstViewBucket,
            count: 5
        }], range);

        expect(points.map(point => point.y)).toEqual([0, 0, 0, 5]);
    });

    test("keeps first-hour views when publication is mid-hour", () => {
        const range = {
            from: new Date("2026-10-01T10:30:00.000Z").getTime(),
            to: new Date("2026-10-01T11:20:00.000Z").getTime()
        };
        const firstBucket = new Date("2026-10-01T10:00:00.000Z");

        const points = buildAnalyticsHourlyViewPoints([{
            time: firstBucket,
            count: 7
        }], range);

        expect(points[0]).toMatchObject({
            x: range.from,
            y: 7,
            bucketStart: firstBucket.getTime()
        });
        expect(points.filter(point => point.x === range.from)).toHaveLength(1);
    });

    test("uses exact lifetime bounds in the first and current hours", () => {
        const firstPublication = new Date(2026, 9, 1, 10, 30, 25, 125);
        const currentTime = new Date(2026, 9, 1, 14, 20, 40, 750);
        const bounds = {
            from: firstPublication.getTime(),
            to: currentTime.getTime()
        };

        const from = buildAnalyticsLocalHourBoundary(
            localDateValue(firstPublication),
            String(firstPublication.getHours()).padStart(2, "0"),
            "From",
            bounds
        );
        const to = buildAnalyticsLocalHourBoundary(
            localDateValue(currentTime),
            String(currentTime.getHours()).padStart(2, "0"),
            "To",
            bounds
        );

        expect(from).toEqual({ date: firstPublication, error: null });
        expect(to).toEqual({ date: currentTime, error: null });
    });

    test("uses the start and end of ordinary selected hours", () => {
        const bounds = {
            from: new Date(2026, 9, 1, 10, 30).getTime(),
            to: new Date(2026, 9, 1, 15, 20).getTime()
        };
        const dateValue = localDateValue(new Date(bounds.from));

        const from = buildAnalyticsLocalHourBoundary(
            dateValue,
            "11",
            "From",
            bounds
        );
        const to = buildAnalyticsLocalHourBoundary(
            dateValue,
            "12",
            "To",
            bounds
        );

        expect(from.date).toEqual(new Date(2026, 9, 1, 11, 0, 0, 0));
        expect(to.date).toEqual(new Date(2026, 9, 1, 12, 59, 59, 999));
    });

    test("uses local day boundaries when only dates are selected", () => {
        const bounds = {
            from: new Date(2026, 8, 30, 10, 30).getTime(),
            to: new Date(2026, 9, 2, 15, 20).getTime()
        };
        const from = buildAnalyticsLocalHourBoundary(
            "2026-10-01",
            "",
            "From",
            bounds
        );
        const to = buildAnalyticsLocalHourBoundary(
            "2026-10-01",
            "",
            "To",
            bounds
        );

        expect(from).toEqual({
            date: new Date(2026, 9, 1, 0, 0, 0, 0),
            error: null
        });
        expect(to).toEqual({
            date: new Date(2026, 9, 1, 23, 59, 59, 999),
            error: null
        });
    });

    test("supports the same date without hours for both boundaries", () => {
        const firstPublication = new Date(2026, 9, 1, 10, 30);
        const currentTime = new Date(2026, 9, 1, 15, 20);
        const bounds = {
            from: firstPublication.getTime(),
            to: currentTime.getTime()
        };

        expect(buildAnalyticsLocalHourBoundary(
            "2026-10-01",
            "",
            "From",
            bounds
        )).toEqual({
            date: firstPublication,
            error: null
        });
        expect(buildAnalyticsLocalHourBoundary(
            "2026-10-01",
            "",
            "To",
            bounds
        )).toEqual({
            date: currentTime,
            error: null
        });
    });

    test("clips date-only boundaries on publication and current days", () => {
        const firstPublication = new Date(2026, 9, 1, 10, 30, 25, 125);
        const currentTime = new Date(2026, 9, 3, 15, 20, 40, 750);
        const bounds = {
            from: firstPublication.getTime(),
            to: currentTime.getTime()
        };

        const from = buildAnalyticsLocalHourBoundary(
            localDateValue(firstPublication),
            "",
            "From",
            bounds
        );
        const to = buildAnalyticsLocalHourBoundary(
            localDateValue(currentTime),
            "",
            "To",
            bounds
        );

        expect(from).toEqual({ date: firstPublication, error: null });
        expect(to).toEqual({ date: currentTime, error: null });
    });

    test("requires a date when an hour is selected", () => {
        const bounds = {
            from: new Date(2026, 9, 1, 10, 30).getTime(),
            to: new Date(2026, 9, 2, 15, 20).getTime()
        };

        expect(buildAnalyticsLocalHourBoundary(
            "",
            "12",
            "From",
            bounds
        )).toEqual({
            date: null,
            error: "Select a date before choosing an hour for From."
        });
    });

    test("leaves a boundary undefined when date and hour are empty", () => {
        const bounds = {
            from: new Date(2026, 9, 1, 10, 30).getTime(),
            to: new Date(2026, 9, 2, 15, 20).getTime()
        };

        expect(buildAnalyticsLocalHourBoundary(
            "",
            "",
            "To",
            bounds
        )).toEqual({ date: null, error: null });
    });
});

describe("Analytics client date and tooltip formatting", () => {
    test("formats dates in en-GB and times with a 24-hour clock", () => {
        const date = new Date(2026, 9, 8, 12, 5, 45, 250);

        expect(formatAnalyticsDate(date)).toBe("08 Oct 2026");
        expect(formatAnalyticsTime(date)).toBe("12:05");
    });

    test("shows a whole hour without 59:59.999", () => {
        const start = new Date(2026, 9, 8, 12, 0);
        const selectedHourEnd = new Date(2026, 9, 8, 12, 59, 59, 999);

        expect(formatAnalyticsTimeRange(start, selectedHourEnd))
            .toBe("12:00–13:00");
        expect(buildAnalyticsHourlyTooltipTitle(start, selectedHourEnd))
            .toEqual(["08 Oct 2026", "12:00–13:00"]);
    });

    test("adds dates to both times when a period crosses midnight", () => {
        const start = new Date(2026, 9, 8, 23, 30);
        const end = new Date(2026, 9, 9, 0, 30);

        expect(formatAnalyticsTimeRange(start, end)).toBe(
            "08 Oct 2026 23:30–09 Oct 2026 00:30"
        );
        expect(buildAnalyticsHourlyTooltipTitle(start, end)).toEqual([
            "08 Oct 2026 23:30–09 Oct 2026 00:30"
        ]);
    });
});

describe("Analytics X-axis ticks", () => {
    test("formats every tick as an English date and 24-hour time", () => {
        const tick = new Date(2026, 9, 9, 12, 0);

        expect(formatAnalyticsAxisTick(tick)).toEqual([
            "09 Oct",
            "12:00"
        ]);
    });

    test("creates four-hour ticks on round local hours", () => {
        const minimum = new Date(2026, 9, 9, 9, 17).getTime();
        const maximum = new Date(2026, 9, 9, 20, 30).getTime();
        const ticks = buildAnalyticsAxisTicks(minimum, maximum);

        expect(ticks.map(value => new Date(value).getHours()))
            .toEqual([12, 16, 20]);
        expect(ticks.every(value => {
            const date = new Date(value);
            return date.getHours() % 4 === 0 &&
                date.getMinutes() === 0 &&
                date.getSeconds() === 0 &&
                date.getMilliseconds() === 0;
        })).toBe(true);
    });

    test("uses whole-hour ticks for ranges shorter than four hours", () => {
        const minimum = new Date(2026, 9, 9, 12, 15).getTime();
        const maximum = new Date(2026, 9, 9, 15, 45).getTime();
        const ticks = buildAnalyticsAxisTicks(minimum, maximum);

        expect(ticks.map(value => new Date(value).getHours()))
            .toEqual([13, 14, 15]);
        expect(ticks.every(value => new Date(value).getMinutes() === 0))
            .toBe(true);
    });

    test("creates one tick for every local date in a multi-day range", () => {
        const minimum = new Date(2026, 9, 9, 9, 17).getTime();
        const maximum = new Date(2026, 9, 12, 20, 30).getTime();
        const ticks = buildAnalyticsAxisTicks(minimum, maximum);

        expect(ticks).toHaveLength(4);
        expect(ticks[0]).toBe(minimum);
        expect(ticks.map(value => {
            const date = new Date(value);
            return `${date.getDate()}-${date.getMonth()}`;
        })).toEqual(["9-9", "10-9", "11-9", "12-9"]);
        expect(ticks.slice(1).every(value => {
            const date = new Date(value);
            return date.getHours() === 0 &&
                date.getMinutes() === 0 &&
                date.getSeconds() === 0 &&
                date.getMilliseconds() === 0;
        })).toBe(true);
    });

    test("advances through local calendar days across an offset change", () => {
        let transition = null;

        for (let month = 0; month < 12 && !transition; month++) {
            for (let day = 1; day <= 31; day++) {
                const current = new Date(2026, month, day);
                const next = new Date(2026, month, day + 1);

                if (
                    current.getMonth() === month &&
                    current.getTimezoneOffset() !== next.getTimezoneOffset()
                ) {
                    transition = current;
                    break;
                }
            }
        }

        if (!transition) return;

        const minimum = new Date(
            transition.getFullYear(),
            transition.getMonth(),
            transition.getDate() - 1,
            9,
            30
        ).getTime();
        const maximum = new Date(
            transition.getFullYear(),
            transition.getMonth(),
            transition.getDate() + 2,
            18
        ).getTime();
        const ticks = buildAnalyticsAxisTicks(minimum, maximum);

        expect(ticks).toHaveLength(4);
        expect(ticks[0]).toBe(minimum);
        expect(ticks.slice(1).every(value =>
            new Date(value).getHours() === 0
        )).toBe(true);
    });
});

describe("Analytics client adaptive view series", () => {
    test("uses hourly detail for a range of exactly 48 hours", () => {
        const from = new Date(2026, 0, 1, 10, 30).getTime();
        const range = {
            from,
            to: from + (48 * 60 * 60 * 1000)
        };

        expect(buildAnalyticsViewSeries([], range).mode).toBe("hourly");
    });

    test("uses four-hour detail for a range longer than 48 hours", () => {
        const from = new Date(2026, 0, 1, 10, 30).getTime();
        const range = {
            from,
            to: from + (48 * 60 * 60 * 1000) + 1
        };

        expect(buildAnalyticsViewSeries([], range).mode).toBe("four-hour");
    });

    test("aggregates each view into exactly one four-hour group", () => {
        const range = {
            from: new Date(2026, 0, 1, 10, 30).getTime(),
            to: new Date(2026, 0, 1, 23, 15).getTime()
        };
        const views = [
            { time: new Date(2026, 0, 1, 10, 0), count: 2 },
            { time: new Date(2026, 0, 1, 14, 0), count: 3 },
            { time: new Date(2026, 0, 1, 15, 0), count: 5 },
            { time: new Date(2026, 0, 1, 19, 0), count: 7 }
        ];

        const points = buildAnalyticsFourHourViewPoints(views, range);

        expect(points.map(point => point.y)).toEqual([5, 5, 7, 0]);
    });

    test("fills missing four-hour groups with zero", () => {
        const range = {
            from: new Date(2026, 0, 1, 10, 30).getTime(),
            to: new Date(2026, 0, 1, 23, 15).getTime()
        };
        const views = [{ time: new Date(2026, 0, 1, 19, 0), count: 7 }];

        const points = buildAnalyticsFourHourViewPoints(views, range);

        expect(points.map(point => point.y)).toEqual([0, 0, 7, 0]);
    });

    test("preserves the exact total in four-hour groups", () => {
        const range = {
            from: new Date(2026, 0, 1, 10, 30).getTime(),
            to: new Date(2026, 0, 3, 12, 15).getTime()
        };
        const views = [
            { time: new Date(2026, 0, 1, 10, 0), count: 7 },
            { time: new Date(2026, 0, 1, 15, 0), count: 3 },
            { time: new Date(2026, 0, 3, 9, 0), count: 5 }
        ];

        const points = buildAnalyticsFourHourViewPoints(views, range);
        const inputTotal = views.reduce((sum, view) => sum + view.count, 0);
        const outputTotal = points.reduce((sum, point) => sum + point.y, 0);

        expect(outputTotal).toBe(inputTotal);
    });

    test("keeps exact boundaries for partial edge groups", () => {
        const range = {
            from: new Date(2026, 0, 1, 10, 30).getTime(),
            to: new Date(2026, 0, 1, 20, 15).getTime()
        };

        const points = buildAnalyticsFourHourViewPoints([], range);

        expect(points[0].x).toBe(range.from);
        expect(points[0].periodStart).toBe(range.from);
        expect(points[0].periodEnd).toBe(
            range.from + (4 * 60 * 60 * 1000)
        );
        expect(points.at(-1).periodEnd).toBe(range.to);
    });
});
