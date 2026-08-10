"use client";

import { useCallback, useRef, useEffect } from "react";
import { ReactFlow, Controls, Background, useNodesState, useEdgesState, Position, MarkerType, Edge, ReactFlowProvider, Node, useReactFlow, Handle } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { updatePrototype } from "@/lib/actions";
import { Plus, MoreVertical, Edit2, Trash2, Loader2, ArrowLeftCircle, ArrowRightCircle } from "lucide-react";
import { Button} from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import cuid from "cuid";
import Link from "next/link";
import { Role } from "@prisma/client";
import { AIChatButton } from "@/components/ai/AIChatButton";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type NodeData = {
  title: string;
  description: string;
  roles: Role[];
  roleDescriptions?: Record<string, string>;
  customLogic?: string[];
  apis?: string[];
  isAuthenticated: boolean;
};

const initialNodes = [
  {
    id: cuid(),
    type: "screenNode",
    position: { x: 250, y: 100 },
    data: { title: "Landing page", description: "Landing page for the application" },
    style: { width: 250 }
  }
];

const ScreenNode = ({ data, id }: { data: NodeData, id: string }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [title, setTitle] = useState(data.title);
  const [description, setDescription] = useState(data.description);
  const [customLogic, setCustomLogic] = useState<string[]>(data.customLogic || []);
  const [apis, setApis] = useState<string[]>(data.apis || []);
  const [roleDescriptions, setRoleDescriptions] = useState<Record<string, string>>(
    data.roleDescriptions || {}
  );
  const menuRef = useRef<HTMLDivElement>(null);

  console.log("customLogic", customLogic);
  const { setNodes, setEdges, getEdges } = useReactFlow();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearIncomingEdges = () => {
    const edges = getEdges();
    const incomingEdges = edges.filter(edge => edge.target === id);
    if (incomingEdges.length > 0) {
      setEdges((edges) => edges.filter(edge => edge.target !== id));
    }
    setShowMenu(false);
  };

  const clearOutgoingEdges = () => {
    const edges = getEdges();
    const outgoingEdges = edges.filter(edge => edge.source === id);
    if (outgoingEdges.length > 0) {
      setEdges((edges) => edges.filter(edge => edge.source !== id));
    }
    setShowMenu(false);
  };

  const incomingEdges = getEdges().filter(edge => edge.target === id);
  const outgoingEdges = getEdges().filter(edge => edge.source === id);
  const hasTargetEdge = incomingEdges.length > 0;
  const hasSourceEdge = outgoingEdges.length > 0;

  return (
    <div className="relative rounded-lg border border-border bg-background p-4 shadow-lg">
      <div className="absolute -left-0.5 top-1/2 -translate-y-1/2">
        <div className="relative">
          <Handle 
            id="target"
            type="target" 
            position={Position.Left} 
            style={{ background: "#666", width: "24px", height: "24px" }}
            isConnectable
            isValidConnection={(connection) => {
              const edges = getEdges();
              return !edges.some(edge => 
                edge.source === connection.source && 
                edge.target === connection.target &&
                edge.sourceHandle === connection.sourceHandle &&
                edge.targetHandle === connection.targetHandle
              );
            }}
          />
        </div>
      </div>
      
      <div className="absolute -right-0.5 top-1/2 -translate-y-1/2">
        <div className="relative">
          <Handle 
            id="source"
            type="source" 
            position={Position.Right}
            style={{ background: "#666", width: "24px", height: "24px" }}
            isConnectable
            isValidConnection={(connection) => {
              const edges = getEdges();
              return !edges.some(edge => 
                edge.source === connection.source && 
                edge.target === connection.target &&
                edge.sourceHandle === connection.sourceHandle &&
                edge.targetHandle === connection.targetHandle
              );
            }}
          />
        </div>
      </div>
      
      {!showEditDialog && data.isAuthenticated && (
        <Button
          variant="ghost"
          className="absolute right-2 top-2"
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
            className="absolute right-2 top-10 z-50 min-w-40 rounded-lg border border-border bg-background p-1 shadow-lg"
          >
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-3 py-2 text-sm"
              onClick={() => {
                setShowEditDialog(true);
                setShowMenu(false);
              }}
            >
              <Edit2 className="size-4" /> Edit Screen
            </Button>
            {hasTargetEdge && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 text-sm"
                onClick={clearIncomingEdges}
              >
                <ArrowLeftCircle className="size-4" /> Clear Incoming Edges ({incomingEdges.length})
              </Button>
            )}
            {hasSourceEdge && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 px-3 py-2 text-sm"
                onClick={clearOutgoingEdges}
              >
                <ArrowRightCircle className="size-4" /> Clear Outgoing Edges ({outgoingEdges.length})
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-error hover:text-error w-full justify-start gap-2 px-3 py-2 text-sm"
              onClick={() => {
                setNodes((nodes: Node[]) => nodes.filter((node) => node.id !== id));
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
            <DialogTitle>Edit Screen</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs text-text-secondary">Screen Name:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-border px-2 py-1 text-sm"
                placeholder="Screen title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-text-secondary">Screen Description:</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border border-border px-2 py-1 text-sm"
                placeholder="Screen description"
                rows={2}
              />
            </div>
            
            {data.roles.map((role) => (
              <div key={role.id} className="space-y-2">
                <label className="text-xs text-text-secondary">{role.name} Description:</label>
                <textarea
                  value={roleDescriptions[role.id] || ""}
                  onChange={(e) => setRoleDescriptions(prev => ({
                    ...prev,
                    [role.id]: e.target.value
                  }))}
                  className="w-full rounded border border-border px-2 py-1 text-sm"
                  placeholder={`Description for ${role.name}`}
                  rows={2}
                />
              </div>
            ))}

            <div className="space-y-2">
              <label className="text-xs text-text-secondary">Custom Logic:</label>
              <div className="space-y-2">
                {customLogic.map((logic, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={logic}
                      onChange={(e) => {
                        const newLogic = [...customLogic];
                        newLogic[index] = e.target.value;
                        setCustomLogic(newLogic);
                      }}
                      className="flex-1 rounded border border-border px-2 py-1 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomLogic(customLogic.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomLogic([...customLogic, ""])}
                >
                  <Plus className="mr-2 size-4" />
                  Add Logic
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-text-secondary">APIs:</label>
              <div className="space-y-2">
                {apis.map((api, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={api}
                      onChange={(e) => {
                        const newApis = [...apis];
                        newApis[index] = e.target.value;
                        setApis(newApis);
                      }}
                      className="flex-1 rounded border border-border px-2 py-1 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setApis(apis.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setApis([...apis, ""])}
                >
                  <Plus className="mr-2 size-4" />
                  Add API
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setTitle(data.title);
                setDescription(data.description);
                setRoleDescriptions(data.roleDescriptions || {});
                setCustomLogic(data.customLogic || []);
                setApis(data.apis || []);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setNodes((nodes: Node[]) =>
                  nodes.map((node) =>
                    node.id === id
                      ? { 
                        ...node, 
                        data: { 
                          ...node.data, 
                          title, 
                          description,
                          roleDescriptions,
                          customLogic,
                          apis
                        } 
                      }
                      : node
                  )
                );
                setShowEditDialog(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <h3 className="text-text-dark mb-2 font-medium">{title}</h3>
        <p className="text-sm text-text-secondary">{description}</p>
        
        {data?.roles?.map((role) => (
          roleDescriptions[role.id] ? (
            <div key={role.id} className="mt-2">
              <p className="text-primary text-xs font-medium">{role.name}:</p>
              <p className="text-sm text-text-secondary">{roleDescriptions[role.id]}</p>
            </div>
          ) : null
        ))}
        
        {customLogic.length > 0 && (
          <div className="mt-2">
            <p className="text-primary text-xs font-medium">Custom Logic:</p>
            <ul className="list-disc pl-4">
              {customLogic.map((logic, index) => (
                <li key={index} className="text-sm text-text-secondary">{logic}</li>
              ))}
            </ul>
          </div>
        )}
        
        {apis.length > 0 && (
          <div className="mt-2">
            <p className="text-primary text-xs font-medium">APIs:</p>
            <ul className="list-disc pl-4">
              {apis.map((api, index) => (
                <li key={index} className="text-sm text-text-secondary">{api}</li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const nodeTypes = {
  screenNode: ScreenNode
};

export default function PrototypePage({ 
  params, 
  roles,
  initialData,
  isAuthenticated
}: { 
  params: { id: string };
  initialData: any;
  roles: Role[];
  isAuthenticated: boolean;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialData?.nodes?.length ? initialData.nodes : initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialData?.edges || []
  );
  const [isSaving, setIsSaving] = useState(false);

  const onSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updatePrototype(params.id, { nodes, edges });
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, params.id]);

  const addNode = useCallback(() => {
    const rightmostX = nodes.length > 0 
      ? Math.max(...nodes.map(node => node.position.x)) 
      : 0;
    const topmostY = nodes.length > 0 
      ? Math.min(...nodes.map(node => node.position.y)) 
      : 100;

    const newNode = {
      id: cuid(),
      type: "screenNode",
      position: { x: rightmostX + 300, y: topmostY },
      data: {
        title: `Screen ${nodes.length + 1}`,
        description: "New application screen",
        roles: roles,
        roleDescriptions: {},
        isAuthenticated: isAuthenticated
      },
      style: { width: 300 }
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes, setNodes, roles, isAuthenticated]);

  const onConnect = useCallback((params: any) => {
    setEdges((eds) => {
      // Check if an edge with the same source and target already exists
      const isDuplicate = eds.some(edge => 
        edge.source === params.source && 
        edge.target === params.target &&
        edge.sourceHandle === params.sourceHandle &&
        edge.targetHandle === params.targetHandle
      );
      
      if (isDuplicate) return eds;

      return [...eds, { 
        ...params, 
        id: cuid(),
        type: "smoothstep",
        markerEnd: { 
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20
        },
        animated: true,
        style: { stroke: "#666" }
      }];
    });
  }, [setEdges]);

  return (
    <div className="size-full">
      {isAuthenticated && (
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          <AIChatButton nodes={nodes} setNodes={setNodes} edges={edges} setEdges={setEdges} />
          <Button onClick={addNode} variant="ghost">
            <Plus className="mr-2 size-4" />
            Add Screen
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
          <Link href={`/dashboard/prototypes/${params.id}/roles`}>
            <Button>
              Manage Roles
            </Button>
          </Link>
        </div>
      )}
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              roles: roles,
              isAuthenticated
            }
          }))}
          edges={edges}
          onNodesChange={isAuthenticated ? onNodesChange : undefined}
          onEdgesChange={isAuthenticated ? onEdgesChange : undefined}
          onConnect={isAuthenticated ? onConnect : undefined}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}