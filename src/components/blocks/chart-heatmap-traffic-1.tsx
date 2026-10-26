"use client";

export const title = "Traffic sources heatmap";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = ["12a", "4a", "8a", "12p", "4p", "8p"];
const values = [
  [12, 8, 22, 40, 55, 30],
  [10, 6, 28, 48, 60, 34],
  [14, 9, 30, 52, 58, 36],
  [11, 7, 26, 46, 62, 38],
  [15, 10, 32, 54, 64, 40],
  [20, 14, 24, 36, 44, 50],
  [18, 12, 20, 30, 38, 46],
];
const max = Math.max(...values.flat());

const Example = () => (
  <div className="w-full max-w-xl overflow-x-auto rounded-md border bg-background p-4">
    <div className="min-w-[360px] space-y-2">
      <div className="grid grid-cols-[40px_repeat(6,minmax(0,1fr))] gap-1 text-[10px] text-muted-foreground">
        <span />
        {hours.map((hour) => (
          <span key={hour} className="text-center">
            {hour}
          </span>
        ))}
      </div>
      {days.map((day, dayIndex) => (
        <div
          key={day}
          className="grid grid-cols-[40px_repeat(6,minmax(0,1fr))] gap-1"
        >
          <span className="self-center text-[10px] text-muted-foreground">
            {day}
          </span>
          {values[dayIndex].map((value, hourIndex) => (
            <div
              key={`${day}-${hourIndex}`}
              title={`${day} ${hours[hourIndex]}: ${value}`}
              className="aspect-square rounded-sm bg-chart-1"
              style={{ opacity: 0.15 + (value / max) * 0.85 }}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default Example;
