"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModelSelectorContext } from "@/lib/model-selector-provider";

export function ModelSelector() {
  const { model, setModel } = useModelSelectorContext();

  return (
    <div className="p-3 border-b border-gray-200">
      <Select value={model} onValueChange={(v) => setModel(v)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select Model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="openai">OpenAI</SelectItem>
          <SelectItem value="anthropic">Anthropic</SelectItem>
          <SelectItem value="google_genai">Google Generative AI</SelectItem>
          <SelectItem value="crewai">CrewAI</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
