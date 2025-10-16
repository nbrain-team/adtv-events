import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
// apiTemplates already imported above
import { useStore } from '@store/useStore';
import ReactFlow, { Background, Controls, MiniMap, Edge, Node, Connection, addEdge, applyEdgeChanges, applyNodeChanges, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
// @ts-ignore
import dagre from 'dagre';
import { apiTemplates, apiContentTemplates } from '@lib/api';
import { FunnelTableView } from '@components/FunnelTableView';

const stageByNode = (name: string) => {
  if (name.includes('Campaign 1')) return 'Campaign 1';
  if (name.includes('Campaign 2')) return 'Campaign 2';
  if (name.includes('RSVP') || name.includes('Calendly')) return 'RSVP';
  if (name.includes('Event Day')) return 'Event Day';
  if (name.includes('Post-Event') || name.includes('No Shows') || name.includes('Cancellations')) return 'Post-Event';
  return 'General';
};

const colorByType: Record<string, string> = {
  email_send: '#4f46e5',
  sms_send: '#10b981',
  voicemail_drop: '#f59e0b',
  decision: '#6366f1',
  wait: '#6b7280',
  task: '#8b5cf6',
  web_request: '#0ea5e9',
  stage: '#78350f',
  esign: '#ef4444',
  goal: '#22c55e',
  exit: '#111827',
};

const g = new dagre.graphlib.Graph();
g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 80 });
g.setDefaultEdgeLabel(() => ({}));

export function TemplateBuilder() {
  const params = useParams();
  const { campaigns, upsertCampaign, addToast } = useStore();
  const [serverTemplate, setServerTemplate] = useState<any | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  
  useEffect(() => {
    (async () => {
      try {
        if (!params.id) return;
        
        // Check if we have a versionId in URL
        const urlParams = new URLSearchParams(window.location.search);
        const versionId = urlParams.get('versionId');
        
        if (versionId) {
          // Load specific version
          const version = await apiTemplates.getVersion(params.id, versionId);
          if (version) {
            setCurrentVersionId(versionId);
            // Map version to template shape
            setServerTemplate({
              id: params.id,
              name: `${version.baseTemplate.name} (${version.versionName})`,
              status: 'draft',
              version: 1,
              nodes: version.nodes.map((n: any, idx: number) => ({
                id: `db_${idx}`,
                key: n.id,
                type: n.type,
                name: n.name,
                configJson: JSON.stringify(n.config || {}),
                posX: n.pos?.x,
                posY: n.pos?.y,
              })),
              edges: version.edges.map((e: any, idx: number) => ({
                id: `db_${idx}`,
                fromKey: e.from,
                toKey: e.to,
                conditionJson: JSON.stringify(e.condition || {}),
              })),
            });
          }
        } else {
          // Load base template
          const t = await apiTemplates.get(params.id);
          if (t && t.id) setServerTemplate(t);
        }
        
        // Load versions list
        const vList = await apiTemplates.listVersions(params.id);
        setVersions(Array.isArray(vList) ? vList : []);
      } catch { setServerTemplate(null); }
    })();
  }, [params.id]);
  const template = useMemo(() => {
    const local = campaigns.find((c) => c.id === params.id);
    if (local) return local;
    if (serverTemplate) {
      // map server template to local shape
      const nodes = Array.isArray(serverTemplate.nodes) ? serverTemplate.nodes.map((n: any) => ({ id: n.key, type: n.type, name: n.name, pos: (n.posX!=null && n.posY!=null)?{ x: n.posX, y: n.posY }: undefined })) : [];
      const edges = Array.isArray(serverTemplate.edges) ? serverTemplate.edges.map((e: any) => ({ from: e.fromKey, to: e.toKey, condition: e.conditionJson?JSON.parse(e.conditionJson):undefined })) : [];
      return { id: serverTemplate.id, name: serverTemplate.name, status: serverTemplate.status||'draft', version: serverTemplate.version||1, graph: { schema_version: 1, nodes, edges, start_rules: {} } } as any;
    }
    return undefined;
  }, [campaigns, params.id, serverTemplate]);
  // Ensure content templates are loaded from server so selector shows new ones
  useEffect(() => {
    (async () => {
      try {
        const list = await apiContentTemplates.list();
        if (Array.isArray(list) && list.length) {
          const seen = new Set((useStore.getState() as any).contentTemplates.map((t: any) => t.id));
          for (const t of list) {
            if (seen.has(t.id)) continue;
            (useStore.getState() as any).upsertContentTemplate(t);
          }
        }
      } catch {}
    })();
  }, []);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newNodeType, setNewNodeType] = useState<string>('email_send');
  const humanize = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const [newNodeName, setNewNodeName] = useState<string>(humanize('email_send'));
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => template?.graph.nodes.find((n: any) => n.id === selectedId), [template, selectedId]);
  const outgoing = useMemo(() => (template?.graph.edges || []).filter((e: any) => e.from === selectedId), [template, selectedId]);
  const [viewMode, setViewMode] = useState<'flow' | 'table'>('flow');
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  const relayout = (tpl: typeof template) => {
    if (!tpl) return;
    const rfNodes: Node[] = tpl.graph.nodes.map((n: any) => ({
      id: n.id,
      type: 'box',
      data: { label: n.name },
      position: { x: 0, y: 0 },
      style: { border: '1px solid #e5e7eb', padding: 8, borderRadius: 8, background: '#fff', color: '#111827' },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));
    const rfEdges: Edge[] = tpl.graph.edges.map((e: any, i: number) => ({
      id: `e${i}`,
      source: e.from,
      target: e.to,
      label: (e.condition?.label || e.condition?.after || e.condition?.on || e.condition?.at_local || '') as any,
      style: { stroke: '#9ca3af' },
      labelStyle: { fill: '#6b7280', fontSize: 10 } as any,
      animated: false as const,
    }));

    // Dagre autolayout
    rfNodes.forEach((n) => g.setNode(n.id, { width: 180, height: 48 }));
    rfEdges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    const laidOut = rfNodes.map((n) => {
      const { x, y } = g.node(n.id) as { x: number; y: number };
      const original: any = tpl.graph.nodes.find((x: any) => x.id === n.id);
      const color = colorByType[original?.type || ''] || '#6b7280';
      const stored = original?.pos;
      return { ...n, position: stored || { x: x - 90, y: y - 24 }, style: { ...n.style, borderColor: color } };
    });

    setNodes(laidOut);
    setEdges(rfEdges);
  };

  useEffect(() => {
    // debounce relayout to avoid rapid re-renders
    const t = setTimeout(() => relayout(template), 0);
    return () => clearTimeout(t);
  }, [template]);

  useEffect(() => {
    if (selectedId && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedId]);

  const onNodesChange = useCallback((changes: any) => {
    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds);
      if (!template) return updated;
      // Persist manual positions
      if (changes.some((c: any) => c.type === 'position')) {
        const idToPos: Record<string, { x: number; y: number }> = {};
        updated.forEach((n) => { idToPos[n.id] = n.position; });
        const newTpl = {
          ...template,
          graph: {
            ...template.graph,
            nodes: template.graph.nodes.map((n: any) => ({ ...n, pos: idToPos[n.id] || n.pos })),
          },
        } as any;
        setTimeout(() => upsertCampaign(newTpl), 0);
      }
      if (changes.some((c: any) => c.type === 'remove')) {
        const removedIds = changes.filter((c: any) => c.type === 'remove').map((c: any) => c.id);
        const newTpl = {
          ...template,
          graph: {
            ...template.graph,
            nodes: template.graph.nodes.filter((n: any) => !removedIds.includes(n.id)),
            edges: template.graph.edges.filter((e: any) => !removedIds.includes(e.from) && !removedIds.includes(e.to)),
          },
        } as any;
        setTimeout(() => {
          upsertCampaign(newTpl);
          relayout(newTpl);
          addToast({ title: 'Node removed', variant: 'info' });
        }, 0);
      }
      return updated;
    });
  }, [template]);

  const onEdgesChange = useCallback((changes: any) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    if (!template) return;
    if (changes.some((c: any) => c.type === 'remove')) {
      const removedIds = changes.filter((c: any) => c.type === 'remove').map((c: any) => c.id);
      const newTpl = {
        ...template,
        graph: {
          ...template.graph,
          edges: template.graph.edges.filter((_: any, idx: number) => !removedIds.includes(`e${idx}`)),
        },
      } as any;
      setTimeout(() => { upsertCampaign(newTpl); addToast({ title: 'Edge removed', variant: 'info' }); }, 0);
    }
  }, [template]);

  const onConnect = useCallback((connection: Connection) => {
    if (!template || !connection.source || !connection.target) return;
    if (connection.source === connection.target) return;
    // avoid duplicates
    const exists = template.graph.edges.some((e: any) => e.from === connection.source && e.to === connection.target);
    if (exists) return;

    const newTpl = {
      ...template,
      graph: {
        ...template.graph,
        edges: [...template.graph.edges, { from: connection.source, to: connection.target, condition: {} }],
      },
    } as any;
    setTimeout(() => upsertCampaign(newTpl), 0);
    // update local edges for immediate feedback
    setEdges((eds) => addEdge({ id: `e_${Date.now()}`, source: connection.source!, target: connection.target!, label: '' as any }, eds));
    setTimeout(() => addToast({ title: 'Connected', description: `${connection.source} → ${connection.target}`, variant: 'success' }), 0);
  }, [template]);

  const handleAddNode = () => {
    if (!template) return;
    const id = `n_${Math.random().toString(36).slice(2, 8)}`;
    const color = colorByType[newNodeType] || '#6b7280';
    const defaultName = humanize(newNodeType);
    const newNode = { id, name: defaultName, type: newNodeType, config: {} } as any;
    const newTpl = { ...template, graph: { ...template.graph, nodes: [...template.graph.nodes, newNode] } } as any;
    setTimeout(() => upsertCampaign(newTpl), 0);
    // Avoid immediate relayout during render; schedule after state updates
    setTimeout(() => relayout(newTpl), 0);
    setSelectedId(id);
    setTimeout(() => addToast({ title: 'Node added', description: newNode.name, variant: 'success' }), 0);
  };

  if (!template) return <div className="text-gray-500">Template not found.</div>;

  // Stage swimlane headers (simple, above canvas)
  const lanes = Array.from(new Set((template.graph.nodes as any[]).map((n: any) => stageByNode(n.name)))) as string[];
  
  const handleTableUpdate = async (nodes: any[], edges: any[]) => {
    const newTpl = {
      ...template,
      graph: {
        ...template.graph,
        nodes,
        edges,
      },
    };
    upsertCampaign(newTpl);
    relayout(newTpl);
    
    // If editing a version, update the version; otherwise update base template
    if (currentVersionId) {
      try {
        await apiTemplates.updateVersion(template.id, currentVersionId, { nodes, edges });
        addToast({ title: 'Version updated', description: 'Changes saved to campaign version', variant: 'success' });
      } catch (e: any) {
        addToast({ title: 'Update failed', description: e.message, variant: 'error' });
      }
    } else {
      apiTemplates.saveGraph(template.id, { nodes, edges }).catch(()=>{});
    }
  };
  
  const handleExportCsv = () => {
    const url = apiTemplates.exportCsv(template.id);
    window.open(url, '_blank');
  };
  
  const handleImportCsv = async (csvData: string) => {
    try {
      const result = await apiTemplates.importCsv(template.id, csvData, false);
      addToast({ title: 'CSV imported', description: `${result.nodesCount} nodes, ${result.edgesCount} edges`, variant: 'success' });
      // Reload template
      const t = await apiTemplates.get(template.id);
      if (t && t.id) setServerTemplate(t);
    } catch (e: any) {
      addToast({ title: 'Import failed', description: e.message, variant: 'error' });
    }
  };
  
  const handleSaveAsVersion = async () => {
    const versionName = window.prompt('Version name (e.g., "Boston Event Custom"):');
    if (!versionName) return;
    
    try {
      const created = await apiTemplates.createVersion(template.id, {
        versionName,
        description: `Custom version with ${template.graph.nodes.length} nodes`,
        nodes: template.graph.nodes,
        edges: template.graph.edges,
      });
      addToast({ title: 'Version saved', description: versionName, variant: 'success' });
      setVersions(prev => [{ ...created, nodesCount: template.graph.nodes.length, edgesCount: template.graph.edges.length }, ...prev]);
    } catch (e: any) {
      addToast({ title: 'Save failed', description: e.message, variant: 'error' });
    }
  };
  
  const handleLoadVersion = async (versionId: string) => {
    try {
      const version = await apiTemplates.getVersion(template.id, versionId);
      if (!version) return;
      
      const newTpl = {
        ...template,
        graph: {
          ...template.graph,
          nodes: version.nodes,
          edges: version.edges,
        },
      };
      upsertCampaign(newTpl);
      relayout(newTpl);
      addToast({ title: 'Version loaded', description: version.versionName, variant: 'success' });
      setShowVersions(false);
    } catch (e: any) {
      addToast({ title: 'Load failed', description: e.message, variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          <p className="text-sm text-gray-600">
            Nodes: {template.graph.nodes.length} · Edges: {template.graph.edges.length}
            {versions.length > 0 && ` · ${versions.length} version${versions.length !== 1 ? 's' : ''}`}
            {currentVersionId && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                Editing Campaign Version
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentVersionId && (
            <a 
              className="btn-outline btn-sm" 
              href={`/campaigns/${versions.find(v => v.id === currentVersionId)?.campaign?.id || ''}`}
            >
              ← Back to Campaign
            </a>
          )}
          <button className="btn-outline btn-sm" onClick={() => setShowVersions(true)}>
            View Versions ({versions.length})
          </button>
          {!currentVersionId && (
            <button className="btn-outline btn-sm" onClick={handleSaveAsVersion}>
              Save as New Version
            </button>
          )}
          <button
            className={`btn-sm ${viewMode === 'flow' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('flow')}
          >
            Flow View
          </button>
          <button
            className={`btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('table')}
          >
            Table View
          </button>
          <button
            className="btn-outline btn-sm"
            onClick={async () => {
              try {
                const node = document.getElementById('flow-canvas-root');
                if (!node) return;
                const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                  import('html2canvas'),
                  import('jspdf'),
                ]);
                const canvas = await html2canvas(node as HTMLElement, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const imgWidth = pageWidth - 40;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                const finalWidth = imgHeight > pageHeight - 40 ? ((canvas.width * (pageHeight - 40)) / canvas.height) : imgWidth;
                const finalHeight = imgHeight > pageHeight - 40 ? (pageHeight - 40) : imgHeight;
                const x = (pageWidth - finalWidth) / 2;
                const y = (pageHeight - finalHeight) / 2;
                pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
                pdf.save(`${template.name.replace(/\s+/g,'_')}_flow.pdf`);
              } catch {}
            }}
          >
            Export PDF
          </button>
          <a className="btn-outline btn-sm" href="/templates">Back</a>
        </div>
      </div>
      
      {viewMode === 'flow' && (
        <>
          <div className="flex gap-2 text-xs text-gray-700">
            {lanes.map((l) => (
              <span key={l} className="px-2 py-1 rounded border border-gray-200 bg-gray-50">{l}</span>
            ))}
          </div>

          <div className="flex items-end gap-2">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">New Node Type</label>
            <select className="input" value={newNodeType} onChange={(e)=> { setNewNodeType(e.target.value); setNewNodeName(humanize(e.target.value)); }}>
              {Object.keys(colorByType).map((t) => (
                <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Node Name</label>
            <input className="input" value={newNodeName} onChange={(e)=> setNewNodeName(e.target.value)} />
          </div>
        </div>
            <button className="btn-primary btn-sm" onClick={handleAddNode}>+ Add Node</button>
          </div>

          <div id="flow-canvas-root" className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-white border-t border-b h-[calc(100vh-220px)]">
        <div className="h-full mx-16">
          <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={(_, n) => {
            setSelectedId(n.id);
          }}
          onPaneClick={() => {
            // Intentionally do not clear selection to keep inspector visible
          }}
          nodesDraggable
          nodesConnectable
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
          onSelectionChange={(params) => {
            const first = params?.nodes && params.nodes[0];
            if (first?.id) setSelectedId(first.id);
            // Do not clear selection on empty to keep inspector open
          }}
            style={{ width: '100%', height: '100%' }}
          >
            <Background gap={16} color="#f3f4f6" />
            <MiniMap nodeStrokeColor={(n) => '#9ca3af'} nodeColor={() => '#e5e7eb'} />
            <Controls />
          </ReactFlow>
          </div>
        </div>

        <div ref={inspectorRef} className="card mt-4 max-h-[60vh] overflow-auto">
        <h3 className="text-lg font-semibold mb-2">Inspector</h3>
        {!selected ? (
          <p className="text-sm text-gray-500">Select a node to edit.</p>
        ) : (
          <Inspector
            key={selected.id}
            node={selected}
            edgesOut={outgoing}
            onChange={async (updated) => {
              if (!template) return;
              const newTpl = {
                ...template,
                graph: {
                  ...template.graph,
                  nodes: template.graph.nodes.map((n: any) => (n.id === updated.id ? updated : n)),
                },
              };
              setTimeout(() => {
                upsertCampaign(newTpl);
                relayout(newTpl);
                addToast({ title: 'Node updated', description: updated.name, variant: 'success' });
              }, 0);
              // Persist to version or base template
              if (currentVersionId) {
                try {
                  await apiTemplates.updateVersion(template.id, currentVersionId, { 
                    nodes: newTpl.graph.nodes, 
                    edges: newTpl.graph.edges 
                  });
                } catch {}
              } else {
                apiTemplates.saveGraph(template.id, { nodes: newTpl.graph.nodes, edges: newTpl.graph.edges }).catch(()=>{});
              }
            }}
            onChangeEdges={async (newEdges) => {
              if (!template) return;
              const newTpl = {
                ...template,
                graph: {
                  ...template.graph,
                  edges: template.graph.edges.map((e: any) => (e.from === selectedId ? (newEdges.find((x: any) => x.to === e.to) || e) : e)),
                },
              } as any;
              setTimeout(() => {
                upsertCampaign(newTpl);
                setEdges((prev) => prev.map((e) => (e.source === selectedId ? { ...e, label: (newEdges.find((x: any) => x.to === e.target)?.condition?.label) || e.label } : e)));
                addToast({ title: 'Edge rules saved', description: `${newEdges.length} edges updated`, variant: 'success' });
              }, 0);
              // Persist to version or base template
              if (currentVersionId) {
                try {
                  await apiTemplates.updateVersion(template.id, currentVersionId, { 
                    nodes: newTpl.graph.nodes, 
                    edges: newTpl.graph.edges 
                  });
                } catch {}
              } else {
                apiTemplates.saveGraph(template.id, { nodes: newTpl.graph.nodes, edges: newTpl.graph.edges }).catch(()=>{});
              }
            }}
            onDelete={() => {
              if (!template) return;
              const newTpl = {
                ...template,
                graph: {
                  ...template.graph,
                  nodes: template.graph.nodes.filter((n: any) => n.id !== selected.id),
                  edges: template.graph.edges.filter((e: any) => e.from !== selected.id && e.to !== selected.id),
                },
              };
              setTimeout(() => {
                upsertCampaign(newTpl);
                setSelectedId(null);
                relayout(newTpl);
                addToast({ title: 'Node deleted', description: selected.name, variant: 'info' });
              }, 0);
              apiTemplates.saveGraph(template.id, { nodes: newTpl.graph.nodes, edges: newTpl.graph.edges }).catch(()=>{});
            }}
          />
        )}
        </div>
        </>
      )}
      
      {viewMode === 'table' && (
        <FunnelTableView
          template={template}
          onUpdate={handleTableUpdate}
          onExportCsv={handleExportCsv}
          onImportCsv={handleImportCsv}
        />
      )}
      
      {showVersions && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-6 space-y-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Template Versions</h3>
              <button className="btn-outline btn-sm" onClick={() => setShowVersions(false)}>Close</button>
            </div>
            
            {versions.length === 0 ? (
              <p className="text-gray-500 text-sm">No versions yet. Click "Save as Version" to create one.</p>
            ) : (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="border rounded p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{v.versionName}</h4>
                        <p className="text-xs text-gray-600">
                          {v.description} · {v.nodesCount} nodes, {v.edgesCount} edges
                        </p>
                        {v.campaign && (
                          <p className="text-xs text-gray-500 mt-1">
                            Used in: <span className="font-medium">{v.campaign.name}</span>
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Created: {new Date(v.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => handleLoadVersion(v.id)}
                        >
                          Load
                        </button>
                        <button
                          className="btn-outline btn-sm"
                          onClick={() => {
                            const url = apiTemplates.exportCsv(template.id, v.id);
                            window.open(url, '_blank');
                          }}
                        >
                          Export CSV
                        </button>
                        <button
                          className="btn-outline btn-sm text-red-600"
                          onClick={async () => {
                            const confirm = window.confirm(`Delete version "${v.versionName}"?`);
                            if (!confirm) return;
                            try {
                              await apiTemplates.deleteVersion(template.id, v.id);
                              setVersions(prev => prev.filter(x => x.id !== v.id));
                              addToast({ title: 'Version deleted', description: v.versionName, variant: 'info' });
                            } catch (e: any) {
                              addToast({ title: 'Delete failed', description: e.message, variant: 'error' });
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type InspectorProps = {
  node: any;
  edgesOut: any[];
  onChange: (n: any) => void;
  onChangeEdges: (e: any[]) => void;
  onDelete: () => void;
};

function Inspector({ node, edgesOut, onChange, onChangeEdges, onDelete }: InspectorProps) {
  const [name, setName] = useState(node.name || '');
  const [mode, setMode] = useState<'template'|'custom'>(node?.config?.template_id ? 'template' : (node?.config?.content ? 'custom' : 'template'));
  const [templateId, setTemplateId] = useState(node?.config?.template_id || '');
  const [rules, setRules] = useState<any[]>(node?.config?.rules || []);
  const [emailSubject, setEmailSubject] = useState(node?.config?.content?.subject || '');
  const [emailBody, setEmailBody] = useState(node?.config?.content?.body || '');
  const [smsText, setSmsText] = useState(node?.config?.content?.text || '');
  const [vmScript, setVmScript] = useState(node?.config?.tts?.custom_script || '');
  const [edgesDraft, setEdgesDraft] = useState<any[]>(edgesOut || []);
  const [scheduleAfter, setScheduleAfter] = useState<string>(node?.config?.schedule?.after || '');
  const [scheduleAtLocal, setScheduleAtLocal] = useState<string>(node?.config?.schedule?.at_local || '');
  const { contentTemplates } = useStore();

  const typeMap: Record<string, 'email'|'sms'|'voicemail' | undefined> = { email_send: 'email', sms_send: 'sms', voicemail_drop: 'voicemail' };
  const availableTemplates = (typeMap[node.type]
    ? contentTemplates.filter((t) => t.type === typeMap[node.type])
    : []);

  useEffect(() => { setEdgesDraft(edgesOut || []); }, [edgesOut]);

  const tags = [
    // Contact fields (commonly captured)
    '{{contact.first_name}}','{{contact.last_name}}','{{contact.email}}','{{contact.phone}}','{{contact.website}}','{{contact.facebook_profile}}',
    '{{contact.company}}','{{contact.city}}','{{contact.state}}','{{contact.status}}',
    // Campaign fields (from overview)
    '{{campaign.name}}','{{campaign.owner_name}}','{{campaign.owner_email}}','{{campaign.owner_phone}}','{{campaign.event_type}}','{{campaign.city}}','{{campaign.state}}',
    '{{campaign.launch_date}}','{{campaign.event_date}}','{{campaign.video_link}}','{{campaign.event_link}}','{{campaign.hotel_name}}','{{campaign.hotel_address}}','{{campaign.calendly_link}}','{{campaign.sender_email}}'
  ];
  const append = (setter: (v: string) => void, value: string, tag: string) => setter((value || '') + tag);

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="label">Node Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {(node.type === 'email_send' || node.type === 'sms_send' || node.type === 'voicemail_drop') && (
        <div className="space-y-2">
          <div>
            <label className="label">Content Source</label>
            <select className="input" value={mode} onChange={(e)=> setMode(e.target.value as any)}>
              <option value="template">Use Template</option>
              <option value="custom">Custom Content</option>
            </select>
          </div>

          {mode==='template' ? (
            <div>
              <label className="label">Choose Template</label>
              <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Select a template…</option>
                {availableTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {availableTemplates.length===0 && (
                <p className="text-xs text-gray-500 mt-1">No templates yet. Go to Funnel Templates and click "+ Content Template".</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {node.type === 'email_send' && (
                <>
                  <div>
                    <label className="label">Email Subject</label>
                    <input className="input" value={emailSubject} onChange={(e)=> setEmailSubject(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Email Body</label>
                    <textarea className="input h-40" value={emailBody} onChange={(e)=> setEmailBody(e.target.value)} />
                  </div>
                </>
              )}
              {node.type === 'sms_send' && (
                <div>
                  <label className="label">SMS Text</label>
                  <textarea className="input h-28" value={smsText} onChange={(e)=> setSmsText(e.target.value)} />
                </div>
              )}
              {node.type === 'voicemail_drop' && (
                <div>
                  <label className="label">ElevenLabs Script</label>
                  <textarea className="input h-28" value={vmScript} onChange={(e)=> setVmScript(e.target.value)} />
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {tags.map((t)=> (
                  <button key={t} className="subtab" onClick={()=> {
                    if (node.type==='email_send') append(setEmailBody, emailBody, t);
                    if (node.type==='sms_send') append(setSmsText, smsText, t);
                    if (node.type==='voicemail_drop') append(setVmScript, vmScript, t);
                  }}>{t}</button>
                ))}
              </div>

              {/* Node-level timing (send schedule) */}
              <div className="grid md:grid-cols-2 gap-2 pt-2">
                <div>
                  <label className="label">Send After (e.g., PT10M or P1D)</label>
                  <input className="input" placeholder="PT10M" value={scheduleAfter} onChange={(e)=> setScheduleAfter(e.target.value)} />
                </div>
                <div>
                  <label className="label">Send At Local (HH:MM)</label>
                  <input className="input" placeholder="08:00" value={scheduleAtLocal} onChange={(e)=> setScheduleAtLocal(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {node.type === 'decision' && (
        <div>
          <label className="label">Rules</label>
          <div className="space-y-2">
            {rules.map((r, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Label" value={r.label||''} onChange={(e)=> setRules((arr)=> arr.map((x, idx)=> idx===i?{...x, label: e.target.value}:x))} />
                <input className="input" placeholder='JSON Logic (e.g., {"==":[{"var":"contact.esign"},"sent"]) }' value={typeof r.expr==='string'?r.expr:JSON.stringify(r.expr||'')} onChange={(e)=> setRules((arr)=> arr.map((x, idx)=> idx===i?{...x, expr: e.target.value}:x))} />
              </div>
            ))}
            <div className="flex gap-2">
              <button className="btn-outline btn-sm" onClick={()=> setRules((arr)=> [...arr, { label: '', expr: '' }])}>Add Rule</button>
              <button className="btn-outline btn-sm" onClick={()=> setRules((arr)=> arr.slice(0, -1))} disabled={rules.length===0}>Remove Last</button>
            </div>
          </div>
        </div>
      )}

      {/* Timing / Edge rules for outgoing edges */}
      {edgesDraft.length > 0 && (
        <div>
          <h4 className="font-semibold">Timing / Edge Rules</h4>
          <div className="space-y-2 mt-2">
            {edgesDraft.map((e, i) => (
              <div key={i} className="grid md:grid-cols-4 gap-2">
                <input className="input" placeholder="Label" value={e.condition?.label||''} onChange={(ev)=> setEdgesDraft((arr)=> arr.map((x, idx)=> idx===i?{...x, condition:{ ...(x.condition||{}), label: ev.target.value }}:x))} />
                <input className="input" placeholder="After (e.g., PT10M or P1D)" value={e.condition?.after||''} onChange={(ev)=> setEdgesDraft((arr)=> arr.map((x, idx)=> idx===i?{...x, condition:{ ...(x.condition||{}), after: ev.target.value }}:x))} />
                <input className="input" placeholder="At Local (HH:MM)" value={e.condition?.at_local||''} onChange={(ev)=> setEdgesDraft((arr)=> arr.map((x, idx)=> idx===i?{...x, condition:{ ...(x.condition||{}), at_local: ev.target.value }}:x))} />
                <input className="input" placeholder="On (event)" value={e.condition?.on||''} onChange={(ev)=> setEdgesDraft((arr)=> arr.map((x, idx)=> idx===i?{...x, condition:{ ...(x.condition||{}), on: ev.target.value }}:x))} />
              </div>
            ))}
            <button className="btn-outline btn-sm" onClick={()=> onChangeEdges(edgesDraft)}>Save Timing Rules</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <button
          className="btn-primary btn-sm"
          onClick={() => {
            const updated = { ...node, name } as any;
            if (node.type === 'email_send' || node.type === 'sms_send' || node.type==='voicemail_drop') {
              if (mode==='template') {
                updated.config = { ...(node.config||{}), template_id: templateId, content: undefined };
              } else {
                if (node.type==='email_send') updated.config = { ...(node.config||{}), content: { subject: emailSubject, body: emailBody } };
                if (node.type==='sms_send') updated.config = { ...(node.config||{}), content: { text: smsText } };
                if (node.type==='voicemail_drop') updated.config = { ...(node.config||{}), tts: { ...(node.config?.tts||{}), custom_script: vmScript } };
              }
              // persist node-level schedule if provided
              updated.config = {
                ...(updated.config||{}),
                schedule: {
                  ...(updated.config?.schedule||{}),
                  after: scheduleAfter || undefined,
                  at_local: scheduleAtLocal || undefined,
                }
              };
            }
            if (node.type === 'decision') {
              updated.config = { ...(node.config||{}), rules };
            }
            onChange(updated);
          }}
        >
          Save
        </button>
        <button className="btn-outline btn-sm" onClick={onDelete}>Delete Node</button>
      </div>
    </div>
  );
}


function BoxNode({ data }: { data: { label: string } }) {
  return (
    <div style={{ padding: 8, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <Handle type="target" position={Position.Left} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { box: BoxNode } as const;


