"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateCalculation, cloneCalculation } from "@/lib/actions";
import { Calculation } from "@prisma/client";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  revenue: number;
  hours: number;
}

interface Developer {
  id: string;
  name: string;
  hourlyRate: number;
}

interface ClientDeveloperAssignment {
  clientId: string;
  developerId: string;
  hours: number;
}

interface CalculationData {
  clients: Client[];
  developers: Developer[];
  assignments: ClientDeveloperAssignment[];
  adSpend: number;
}

export default function CalculationPage({ 
  params, 
  calculation 
}: { 
  params: { id: string };
  calculation: Calculation;
}) {
  const router = useRouter();
  const [name, setName] = useState(calculation?.name || "Untitled Calculation");
  const [description, setDescription] = useState(calculation?.description || "");
  const [data, setData] = useState<CalculationData>(
    (calculation?.flowData as any) || {
      clients: [
        { id: "1", name: "Client 1", revenue: 10000, hours: 100 }
      ],
      developers: [
        { id: "1", name: "Developer 1", hourlyRate: 100 }
      ],
      assignments: [],
      adSpend: 0
    }
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const addClient = () => {
    setData(prev => ({
      ...prev,
      clients: [
        ...prev.clients,
        { 
          id: Date.now().toString(),
          name: `Client ${prev.clients.length + 1}`,
          revenue: 0,
          hours: 0
        }
      ]
    }));
  };

  const addDeveloper = () => {
    setData(prev => ({
      ...prev,
      developers: [
        ...prev.developers,
        {
          id: Date.now().toString(),
          name: `Developer ${prev.developers.length + 1}`,
          hourlyRate: 0
        }
      ]
    }));
  };

  const updateClient = (id: string, field: keyof Client, value: string) => {
    setData(prev => ({
      ...prev,
      clients: prev.clients.map(client => 
        client.id === id 
          ? { ...client, [field]: field === "name" ? value : Number(value) }
          : client
      )
    }));
  };

  const updateDeveloper = (id: string, field: keyof Developer, value: string) => {
    setData(prev => ({
      ...prev,
      developers: prev.developers.map(dev => 
        dev.id === id 
          ? { ...dev, [field]: field === "name" ? value : Number(value) }
          : dev
      )
    }));
  };

  const updateDeveloperAssignment = (clientId: string, developerId: string, hours: number) => {
    setData(prev => {
      const existingAssignment = prev.assignments.find(
        a => a.clientId === clientId && a.developerId === developerId
      );

      const filteredAssignments = prev.assignments.filter(
        a => !(a.clientId === clientId && a.developerId === developerId)
      );

      return {
        ...prev,
        assignments: hours > 0 
          ? [...filteredAssignments, { clientId, developerId, hours }]
          : filteredAssignments
      };
    });
  };

  const calculateClientProfitability = (clientId: string) => {
    const client = data.clients.find(c => c.id === clientId);
    if (!client) return { revenue: 0, cost: 0, profit: 0 };

    const clientAssignments = data.assignments.filter(a => a.clientId === clientId);
    const cost = clientAssignments.reduce((total, assignment) => {
      const developer = data.developers.find(d => d.id === assignment.developerId);
      return total + (developer?.hourlyRate || 0) * assignment.hours;
    }, 0);

    return {
      revenue: client.revenue,
      cost,
      profit: client.revenue - cost
    };
  };

  const removeClient = (id: string) => {
    setData(prev => ({
      ...prev,
      clients: prev.clients.filter(client => client.id !== id)
    }));
  };

  const removeDeveloper = (id: string) => {
    setData(prev => ({
      ...prev,
      developers: prev.developers.filter(dev => dev.id !== id)
    }));
  };

  const calculateTotals = () => {
    const totalRevenue = data.clients.reduce((sum, client) => sum + client.revenue, 0);
    
    const totalCost = data.assignments.reduce((sum, assignment) => {
      const developer = data.developers.find(d => d.id === assignment.developerId);
      return sum + (developer?.hourlyRate || 0) * assignment.hours;
    }, 0) + (data.adSpend || 0);

    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCost, profit, margin };
  };

  const onSave = async () => {
    setIsSaving(true);
    try {
      await updateCalculation(params.id, {
        name,
        description,
        flowData: data
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onClone = async () => {
    setIsCloning(true);
    try {
      const clonedCalculation = await cloneCalculation(params.id);
      router.push(`/dashboard/calculation/${clonedCalculation.id}`);
    } finally {
      setIsCloning(false);
    }
  };

  const totals = calculateTotals();

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
          <div className="flex gap-2">
            <Button onClick={onClone} variant="outline" disabled={isCloning}>
              {isCloning ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Cloning...
                </>
              ) : (
                "Clone"
              )}
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
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
        
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Total Revenue</p>
              <p className="text-green-600 text-2xl font-bold">
                ${totals.totalRevenue.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Total Cost</p>
              <p className="text-red-600 text-2xl font-bold">
                ${totals.totalCost.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Ad Spend</p>
              <input
                type="number"
                value={data.adSpend}
                onChange={(e) => setData(prev => ({ ...prev, adSpend: Number(e.target.value) }))}
                className="text-red-600 w-full rounded border p-2 text-2xl font-bold"
              />
            </div>
            <div>
              <p className="text-sm font-medium">Profit</p>
              <p className="text-blue-600 text-2xl font-bold">
                ${totals.profit.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Margin</p>
              <p className="text-purple-600 text-2xl font-bold">
                {totals.margin.toFixed(1)}%
              </p>
            </div>
          </div>
        </Card>

        <div className="flex gap-2">
          <Button onClick={addClient}>
            <Plus className="mr-2 size-4" />
            Add Client
          </Button>
          <Button onClick={addDeveloper} variant="outline">
            <Plus className="mr-2 size-4" />
            Add Developer
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Clients Section */}
        <div>
          <h2 className="mb-4 text-xl font-bold">Clients</h2>
          <div className="space-y-4">
            {data.clients.map((client) => {
              const profitability = calculateClientProfitability(client.id);
              return (
                <Card key={client.id} className="p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="grid w-full grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium">Name</label>
                          <input
                            type="text"
                            value={client.name}
                            onChange={(e) => updateClient(client.id, "name", e.target.value)}
                            className="w-full rounded border p-2"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Revenue ($)</label>
                          <input
                            type="number"
                            value={client.revenue}
                            onChange={(e) => updateClient(client.id, "revenue", e.target.value)}
                            className="w-full rounded border p-2"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Profit</label>
                          <div className="rounded border p-2 text-muted-foreground">
                            ${profitability.profit.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 text-destructive"
                        onClick={() => removeClient(client.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h3 className="mb-2 text-sm font-medium">Developer Assignments</h3>
                      <div className="grid gap-2">
                        {data.developers.map(developer => (
                          <div key={developer.id} className="grid grid-cols-3 items-center gap-2">
                            <span>{developer.name}</span>
                            <input
                              type="number"
                              placeholder="Hours"
                              className="w-full rounded border p-2"
                              value={data.assignments.find(
                                a => a.clientId === client.id && a.developerId === developer.id
                              )?.hours || ""}
                              onChange={(e) => updateDeveloperAssignment(
                                client.id,
                                developer.id,
                                Number(e.target.value)
                              )}
                            />
                            <span className="text-sm text-muted-foreground">
                              Rate: ${developer.hourlyRate}/hr
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Developers Section */}
        <div>
          <h2 className="mb-4 text-xl font-bold">Developers</h2>
          <div className="space-y-4">
            {data.developers.map((developer) => (
              <Card key={developer.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="grid w-full grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <input
                        type="text"
                        value={developer.name}
                        onChange={(e) => updateDeveloper(developer.id, "name", e.target.value)}
                        className="w-full rounded border p-2"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Cost per Hour ($)</label>
                      <input
                        type="number"
                        value={developer.hourlyRate}
                        onChange={(e) => updateDeveloper(developer.id, "hourlyRate", e.target.value)}
                        className="w-full rounded border p-2"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2 text-destructive"
                    onClick={() => removeDeveloper(developer.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 