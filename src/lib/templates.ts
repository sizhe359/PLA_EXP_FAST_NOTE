import type { ExperimentTemplate } from "@/lib/types";

export const DEFAULT_TEMPLATE: ExperimentTemplate = {
  id: "biodegradation-weight-loss",
  name: "可降解材料重量降解实验",
  description: "按测量时间记录样品重量，自动计算降解时长、重量差和降解率。",
  fields: [
    { key: "material", label: "材料名称", inputMode: "text" },
    { key: "degradationMedium", label: "降解介质", inputMode: "text" },
    { key: "temperature", label: "实验温度", unit: "°C", inputMode: "decimal" },
  ],
  columns: [
    { key: "weight", label: "样品重量", unit: "mg", inputType: "decimal" },
    { key: "measuredAt", label: "测量时间", inputType: "datetime-local" },
  ],
  calculationRules: [],
};
