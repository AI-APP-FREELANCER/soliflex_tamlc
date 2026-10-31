import { useState } from "react";
import { LayoutChangeEvent, Text, View } from "react-native";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";

interface SimpleBarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}

/**
 * Minimal bar chart — enough for the dashboard's status breakdown, no new
 * chart dependency. Fits itself to the parent's measured width (mirrors
 * recharts' ResponsiveContainer on web) instead of a fixed pixel width, so
 * it never spills past the card on narrower phones or with more categories.
 */
export function SimpleBarChart({ data, height = 180, color = "#F26522" }: SimpleBarChartProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  function handleLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  if (!data.length) {
    return (
      <View style={{ height: 60 }} className="items-center justify-center">
        <Text className="text-sm text-soliflex-gray-400">No data.</Text>
      </View>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.value));
  const topPadding = 24;
  const bottomPadding = 36;
  const plotHeight = height - topPadding - bottomPadding;

  const slot = containerWidth / data.length;
  const gap = Math.min(20, slot * 0.3);
  const barWidth = Math.max(8, slot - gap);

  return (
    <View style={{ height }} onLayout={handleLayout}>
      {containerWidth > 0 && (
        <>
          <Svg width={containerWidth} height={height}>
            {data.map((d, i) => {
              const barHeight = (d.value / max) * plotHeight;
              const x = i * slot + gap / 2;
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
          <View className="flex-row" style={{ width: containerWidth }}>
            {data.map((d) => (
              <Text key={d.label} style={{ width: slot }} className="text-center text-[10px] text-soliflex-gray-500" numberOfLines={2}>
                {d.label}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
