"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  type Edge,
  type Node,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  ArrowLeft,
  ArrowLeftCircle,
  ArrowRightCircle,
  User,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import cuid from "cuid";
import { updateWorkflowFlowData } from "@/lib/actions/workflows";
import type { WorkflowDetail } from "@/lib/fetchers/workflows";

interface WorkflowStepData {
  name: string;
  description: string;
  isAutomated: boolean;
  assignee: string;
  notes: string;
  automationNotes: string;
  [key: string]: unknown;
}

function WorkflowStepNode({ data, id }: { data: WorkflowStepData; id: string }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [name, setName] = useState(data.name);
  const [description, setDescription] = useState(data.description);
  const [isAutomated, setIsAutomated] = useState(data.isAutomated);
  const [assignee, setAssignee] = useState(data.assignee);
  const [notes, setNotes] = useState(data.notes);
  const [automationNotes, setAutomationNotes] = useState(data.automationNotes);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setNodes, setEdges, getEdges } = useReactFlow();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as HTMLElement)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearIncomingEdges = () => {
    setEdges((edges) => edges.filter((edge) => edge.target !== id));
    setShowMenu(false);
  };

  const clearOutgoingEdges = () => {
    setEdges((edges) => edges.filter((edge) => edge.source !== id));
    setShowMenu(false);
  };

  const incomingEdges = getEdges().filter((edge) => edge.target === id);
  const outgoingEdges = getEdges().filter((edge) => edge.source === id);

  const resetEditForm = () => {
    setName(data.name);
    setDescription(data.description);
    setIsAutomated(data.isAutomated);
    setAssignee(data.assignee);
    setNotes(data.notes);
    setAutomationNotes(data.automationNotes);
  };

  const saveChanges = () => {
    setNodes((nodes: Node[]) =>
      nodes.map((node) =>
        node.id === id
          ? {
            ...node,
            data: {
              ...node.data,
              name,
              description,
              isAutomated,
              assignee,
              notes,
              automationNotes,
            },
          }
          : node
      )
    );
    setShowEditDialog(false);
  };

  return (
    <div
      className={`relative min-w-[220px] max-w-[280px] rounded-lg border-2 p-4 shadow-md transition-colors ${
        data.isAutomated
          ? "border-success-400 bg-success-50"
          : "border-secondary-300 bg-white"
      }`}
    >
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-white !bg-secondary-500"
      />
      <Handle
        id="source"
        type="source"
        position={Position.Right}
        className="!size-3 !border-2 !border-white !bg-secondary-500"
      />

      {!showEditDialog && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 size-7"
          onClick={() => setShowMenu(!showMenu)}
        >
          <MoreVertical className="size-4" />
        </Button>
      )}

      <AnimatePresence>
        {showMenu && !showEditDialog && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute right-1 top-9 z-50 min-w-40 rounded-lg border border-secondary-200 bg-white p-1 shadow-lg"
          >
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-3 py-2 text-sm"
              onClick={() => {
                setShowEditDialog(true);
                setShowMenu(false);
              }}
            >
              <Edit2 className="size-4" /> Edit Step
            </Button>
            {incomingEdges.length > 0 && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 text-sm"
                onClick={clearIncomingEdges}
              >
                <ArrowLeftCircle className="size-4" /> Clear Incoming (
                {incomingEdges.length})
              </Button>
            )}
            {outgoingEdges.length > 0 && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 text-sm"
                onClick={clearOutgoingEdges}
              >
                <ArrowRightCircle className="size-4" /> Clear Outgoing (
                {outgoingEdges.length})
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-3 py-2 text-sm text-danger-600 hover:text-danger-600"
              onClick={() => {
                setNodes((nodes: Node[]) =>
                  nodes.filter((node) => node.id !== id)
                );
                setEdges((edges) =>
                  edges.filter(
                    (edge) => edge.source !== id && edge.target !== id
                  )
                );
                setShowMenu(false);
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Workflow Step</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
            <div className="space-y-2">
              <Label>Step Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Step name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happens in this step?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Assignee / Role</Label>
              <Input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="e.g., Sales Rep, CTO, Zapier"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-secondary-200 p-3">
              <div className="flex items-center gap-2">
                {isAutomated ? (
                  <Bot className="size-4 text-success-600" />
                ) : (
                  <User className="size-4 text-secondary-600" />
                )}
                <span className="text-sm font-medium">
                  {isAutomated ? "Automated" : "Manual"}
                </span>
              </div>
              <Switch
                checked={isAutomated}
                onCheckedChange={setIsAutomated}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes / Instructions</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How is this step performed?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Automation Notes</Label>
              <Textarea
                value={automationNotes}
                onChange={(e) => setAutomationNotes(e.target.value)}
                placeholder="How could this step be automated?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveChanges}>Save</Button>
            <Button
              variant="outline"
              onClick={() => {
                resetEditForm();
                setShowEditDialog(false);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="pr-6">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-secondary-900">
            {data.name}
          </h3>
        </div>
        {data.description && (
          <p className="mt-1 line-clamp-2 text-xs text-secondary-500">
            {data.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="secondary"
            className={`gap-1 text-[10px] ${
              data.isAutomated
                ? "bg-success-100 text-success-700"
                : "bg-secondary-100 text-secondary-600"
            }`}
          >
            {data.isAutomated ? (
              <Bot className="size-2.5" />
            ) : (
              <User className="size-2.5" />
            )}
            {data.isAutomated ? "Automated" : "Manual"}
          </Badge>
          {data.assignee && (
            <Badge variant="secondary" className="text-[10px]">
              {data.assignee}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  workflowStep: WorkflowStepNode,
};

interface WorkflowDetailClientProps {
  workflow: WorkflowDetail;
}

function WorkflowDiagram({ workflow }: WorkflowDetailClientProps) {
  const flowData = workflow.flowData as {
    nodes?: Node[];
    edges?: Edge[];
  } | null;

  const [nodes, setNodes, onNodesChange] = useNodesState(
    flowData?.nodes || []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    flowData?.edges || []
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const saveFlowData = useCallback(
    (currentNodes: Node[], currentEdges: Edge[]) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(async () => {
        await updateWorkflowFlowData(workflow.id, {
          nodes: currentNodes,
          edges: currentEdges,
        });
      }, 1000);
    },
    [workflow.id]
  );

  useEffect(() => {
    saveFlowData(nodes, edges);
  }, [nodes, edges, saveFlowData]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const addNode = useCallback(() => {
    const centerPosition = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const newNode: Node = {
      id: cuid(),
      type: "workflowStep",
      position: centerPosition,
      data: {
        name: `Step ${nodes.length + 1}`,
        description: "",
        isAutomated: false,
        assignee: "",
        notes: "",
        automationNotes: "",
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes.length, setNodes, screenToFlowPosition]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const isDuplicate = eds.some(
          (edge) =>
            edge.source === params.source &&
            edge.target === params.target
        );
        if (isDuplicate) return eds;

        return [
          ...eds,
          {
            ...params,
            id: cuid(),
            type: "smoothstep",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
            },
            animated: true,
            style: { stroke: "#94a3b8" },
          } as Edge,
        ];
      });
    },
    [setEdges]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-secondary-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/workflow-maps">
            <Button variant="ghost" size="icon" className="size-8">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-secondary-900">
              {workflow.name}
            </h1>
            {workflow.description && (
              <p className="text-xs text-secondary-500">
                {workflow.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={addNode} variant="outline" size="sm">
            <Plus className="mr-2 size-4" />
            Add Step
          </Button>
        </div>
      </div>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          defaultEdgeOptions={{
            type: "smoothstep",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
            },
            animated: true,
            style: { stroke: "#94a3b8" },
          }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={2}
        >
          <Background gap={20} size={1} color="#e2e8f0" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export function WorkflowDetailClient({
  workflow,
}: WorkflowDetailClientProps) {
  return (
    <ReactFlowProvider>
      <WorkflowDiagram workflow={workflow} />
    </ReactFlowProvider>
  );
}
