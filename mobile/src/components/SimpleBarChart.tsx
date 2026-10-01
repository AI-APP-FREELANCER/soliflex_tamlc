import { Text, View } from "react-native";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";

interface SimpleBarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}

/** Minimal bar chart — enough for the dashboard's status breakdown, no new chart dependency. */
export function SimpleBarChart({ data, height = 180, color = "#F26522" }: SimpleBarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 36;
  const gap = 20;
  const chartWidth = data.length * (barWidth + gap) + gap;
  const topPadding = 24;
  const bottomPadding = 36;
  const plotHeight = height - topPadding - bottomPadding;

  return (
    <View style={{ height }}>
      <Svg width={chartWidth} height={height}>
        {data.map((d, i) => {
          const barHeight = (d.value / max) * plotHeight;
          const x = gap + i * (barWidth + gap);
          const y = topPadding + (plotHeight - barHeight);
          return (
            <G key={d.label}>
              <Rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} rx={4} fill={color} />
              <SvgText x={x + barWidth / 2} y={y - 6} fontSize={11} fill="#23272B" textAnchor="middle">
                {d.value}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View className="flex-row" style={{ width: chartWidth }}>
        {data.map((d) => (
          <Text
            key={d.label}
            style={{ width: barWidth + gap }}
            className="text-center text-[10px] text-soliflex-gray-500"
            numberOfLines={2}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
