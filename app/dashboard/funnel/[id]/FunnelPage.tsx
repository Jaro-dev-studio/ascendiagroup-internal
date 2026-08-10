"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateFunnel } from "@/lib/actions";
import { Funnel } from "@prisma/client";
import { FunnelAIChatButton } from "@/components/ai/FunnelAIChatButton";

interface FunnelSection {
  id: string;
  name: string;
  value: number;
  percentage: number;
}

export default function FunnelPage({ 
  params, 
  funnel 
}: { 
  params: { id: string };
  funnel: Funnel
}) {
  const [name, setName] = useState(funnel?.name || "Untitled Funnel");
  const [description, setDescription] = useState(funnel?.description || "");
  const [sections, setSections] = useState<FunnelSection[]>(
    (funnel?.flowData as any)?.sections || [
      { id: "1", name: "Visitors", value: 1000, percentage: 100 },
      { id: "2", name: "Sign-ups", value: 400, percentage: 40 },
      { id: "3", name: "Purchases", value: 100, percentage: 25 },
    ]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isBenchmarkMode, setIsBenchmarkMode] = useState(false);
  const [originalSections, setOriginalSections] = useState<FunnelSection[]>([]);

  const benchmarkRates: Record<string, number> = {
    "Link clicks": 2.5,
    "Form submissions": 15,
    "Calls booked": 60,
    "Proposals sent": 60,
    "Proposals converted": 20,
    // Add fallback values for common variations
    "Links": 2.5,
    "Forms": 15,
    "Calls": 60,
    "Proposals": 20,
  };

  const toggleBenchmarkMode = () => {
    if (!isBenchmarkMode) {
      // Entering benchmark mode
      setOriginalSections([...sections]);
      const newSections = sections.map((section, index) => {
        if (index === 0) return section;
        
        // Try to find a matching benchmark rate
        let benchmarkRate = 0;
        for (const [key, rate] of Object.entries(benchmarkRates)) {
          if (section.name.toLowerCase().includes(key.toLowerCase())) {
            benchmarkRate = rate;
            break;
          }
        }
        
        // If no match found, use previous percentage
        if (benchmarkRate === 0) {
          benchmarkRate = section.percentage;
        }

        // Calculate value based on the previous section's value
        const prevSection = sections[index - 1];
        const value = Math.round((benchmarkRate / 100) * prevSection.value);

        return {
          ...section,
          percentage: benchmarkRate,
          value: value,
        };
      });

      // Recalculate all values in sequence to maintain the funnel flow
      for (let i = 1; i < newSections.length; i++) {
        const prevSection = newSections[i - 1];
        newSections[i].value = Math.round((newSections[i].percentage / 100) * prevSection.value);
      }

      setSections(newSections);
    } else {
      // Exiting benchmark mode
      setSections(originalSections);
    }
    setIsBenchmarkMode(!isBenchmarkMode);
  };

  const updateSection = (id: string, field: keyof FunnelSection, value: string) => {
    setSections(prevSections => {
      const sectionIndex = prevSections.findIndex(s => s.id === id);
      if (sectionIndex === -1) return prevSections;

      const newSections = [...prevSections];
      const section = { ...newSections[sectionIndex] };
      const prevSection = sectionIndex > 0 ? newSections[sectionIndex - 1] : null;

      if (field === "value") {
        section.value = parseInt(value) || 0;
        if (prevSection) {
          section.percentage = (section.value / prevSection.value) * 100;
        }
      } else if (field === "percentage" && prevSection) {
        section.percentage = parseFloat(value) || 0;
        section.value = Math.round((section.percentage / 100) * prevSection.value);
      } else if (field === "name") {
        section.name = value;
      }

      newSections[sectionIndex] = section;

      for (let i = sectionIndex + 1; i < newSections.length; i++) {
        const currentSection = { ...newSections[i] };
        const previousSection = newSections[i - 1];
        
        currentSection.value = Math.round((currentSection.percentage / 100) * previousSection.value);
        newSections[i] = currentSection;
      }

      return newSections;
    });
  };

  const addSection = () => {
    const lastSection = sections[sections.length - 1];
    const newSection: FunnelSection = {
      id: Date.now().toString(),
      name: "New Section",
      value: Math.round(lastSection.value * 0.5),
      percentage: 50,
    };
    setSections([...sections, newSection]);
  };

  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const getWidth = (index: number) => {
    const maxWidth = 100;
    const minWidth = 500;
    const step = (maxWidth - 40) / (sections.length - 1);
    const percentage = maxWidth - (index * step);
    return `max(${minWidth}px, ${percentage}%)`;
  };

  const onSave = async () => {
    if (isBenchmarkMode) {
      return; // Prevent saving in benchmark mode
    }
    setIsSaving(true);
    try {
      await updateFunnel(params.id, { 
        name,
        description,
        sections 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="focus:ring-primary/20 -ml-2 rounded border-none bg-transparent px-2 text-2xl font-bold focus:outline-none focus:ring-2"
          />
          <div className="flex items-center gap-2">
            {isBenchmarkMode && (
              <span className="bg-warning text-text-dark rounded-full px-3 py-1 text-sm font-medium">
                Benchmark Mode
              </span>
            )}
            <Button
              variant="outline"
              onClick={toggleBenchmarkMode}
              className={isBenchmarkMode ? "border-warning text-warning hover:bg-warning/10" : ""}
            >
              VS Benchmark
            </Button>
            <FunnelAIChatButton flowData={sections} />
            <Button onClick={onSave} disabled={isSaving || isBenchmarkMode}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description..."
          className="focus:ring-primary/20 -ml-2 w-full resize-none rounded border-none bg-transparent px-2 focus:outline-none focus:ring-2"
          rows={2}
        />
        <div className="flex gap-2">
          <Button onClick={addSection}>
            <Plus className="mr-2 size-4" />
            Add Section
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section, index) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className="border-primary/20 hover:border-primary/40 relative mx-auto overflow-hidden border-2 bg-background p-4 shadow-lg transition-all"
              style={{ width: getWidth(index) }}
            >
              <div className="bg-primary/5 absolute inset-0" />
              <div className="relative grid grid-cols-12 gap-4">
                <div className="col-span-4">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Section Name
                  </label>
                  <input
                    type="text"
                    value={section.name}
                    onChange={(e) => updateSection(section.id, "name", e.target.value)}
                    className="w-full rounded-md border-border bg-background px-3 py-1.5 text-sm"
                    placeholder="Section name"
                  />
                </div>
                <div className="col-span-3">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={section.value}
                    onChange={(e) => updateSection(section.id, "value", e.target.value)}
                    className="w-full rounded-md border-border bg-background px-3 py-1.5 text-sm"
                    placeholder="Value"
                  />
                </div>
                <div className="col-span-3">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Conversion Rate
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={section.percentage.toFixed(1)}
                      onChange={(e) => updateSection(section.id, "percentage", e.target.value)}
                      className="w-full rounded-md border-border bg-background px-3 py-1.5 text-sm"
                      placeholder="CVR %"
                      disabled={index === 0}
                    />
                    <span className="ml-1 text-sm text-text-secondary">%</span>
                  </div>
                </div>
                <div className="col-span-2 flex justify-end">
                  {index !== 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSection(section.id)}
                      className="text-danger hover:bg-danger/10 hover:text-danger-dark"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
