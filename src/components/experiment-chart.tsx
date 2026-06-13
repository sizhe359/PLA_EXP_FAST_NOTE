"use client";

import { Download } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { calculateSampleDegradation } from "@/lib/calculations";
import type { ExperimentSample } from "@/lib/types";

export function ExperimentChart({
  samples,
  title,
}: {
  samples: ExperimentSample[];
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<import("echarts").ECharts | null>(null);

  useEffect(() => {
    let active = true;
    async function renderChart() {
      const echarts = await import("echarts");
      if (!active || !containerRef.current) return;
      const chart =
        chartRef.current ?? echarts.init(containerRef.current, undefined, {
          renderer: "canvas",
        });
      chartRef.current = chart;
      chart.setOption({
        animationDuration: 250,
        color: ["#087a55", "#e07833", "#3f6fbd", "#9a55a2", "#bd3f59"],
        grid: { left: 54, right: 22, top: 45, bottom: 72 },
        legend: { type: "scroll", top: 4 },
        tooltip: {
          trigger: "axis",
          valueFormatter: (value: unknown) =>
            typeof value === "number" ? `${value.toFixed(3)}%` : String(value),
        },
        xAxis: {
          type: "value",
          name: "降解时间 (h)",
          nameLocation: "middle",
          nameGap: 34,
        },
        yAxis: {
          type: "value",
          name: "平均降解率 (%)",
          nameLocation: "middle",
          nameGap: 42,
        },
        dataZoom: [
          { type: "inside", xAxisIndex: 0, filterMode: "none" },
          { type: "slider", xAxisIndex: 0, height: 22, bottom: 12 },
        ],
        series: samples.map((sample) => ({
          name: sample.name,
          type: "line",
          symbolSize: 8,
          lineStyle: { width: 3 },
          data: calculateSampleDegradation(sample)
            .filter(
              (point) =>
                point.elapsedHours !== null &&
                point.averageDegradationPercent !== null,
            )
            .map((point) => [
              point.elapsedHours,
              point.averageDegradationPercent,
            ]),
        })),
      });
    }
    void renderChart();
    const observer = new ResizeObserver(() => chartRef.current?.resize());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      active = false;
      observer.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [samples]);

  function exportPng() {
    const dataUrl = chartRef.current?.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
    if (!dataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${title || "experiment"}-degradation.png`;
    anchor.click();
  }

  return (
    <div>
      <div
        aria-label="多样品平均降解率曲线"
        className="h-96 w-full"
        ref={containerRef}
        role="img"
      />
      <Button className="mt-2 w-full sm:w-auto" onClick={exportPng} variant="secondary">
        <Download size={17} />
        导出曲线 PNG
      </Button>
    </div>
  );
}
