import { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { useStore } from '@store/useStore';
import { apiContentTemplates } from '@lib/api';

type FunnelTableViewProps = {
  template: any;
  onUpdate: (nodes: any[], edges: any[]) => void;
  onExportCsv: () => void;
  onImportCsv: (csvData: string) => void;
};

export function FunnelTableView({ template, onUpdate, onExportCsv, onImportCsv }: FunnelTableViewProps) {
  const { addToast, contentTemplates } = useStore();
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; field: string } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvImportData, setCsvImportData] = useState('');
  const [contentTemplateMap, setContentTemplateMap] = useState<Map<string, any>>(new Map());
  
  // Load content templates
  useEffect(() => {
    const map = new Map();
    contentTemplates.forEach((t: any) => {
      map.set(t.id, t);
    });
    setContentTemplateMap(map);
  }, [contentTemplates]);
  
  // Flatten nodes and edges into table rows WITH resolved content
  const tableRows = useMemo(() => {
    const rows: any[] = [];
    const nodeMap = new Map(template.graph.nodes.map((n: any) => [n.id, n]));
    
    for (const node of template.graph.nodes) {
      const outgoingEdges = template.graph.edges.filter((e: any) => e.from === node.id);
      
      // Resolve content from template
      const templateId = node.config?.template_id;
      const contentTemplate = templateId ? contentTemplateMap.get(templateId) : null;
      
      // Extract content based on node type
      let emailSubject = '';
      let emailBody = '';
      let smsText = '';
      let voicemailScript = '';
      
      if (node.type === 'email_send') {
        if (contentTemplate) {
          emailSubject = contentTemplate.subject || '';
          emailBody = contentTemplate.body || '';
        } else if (node.config?.content) {
          emailSubject = node.config.content.subject || '';
          emailBody = node.config.content.body || '';
        }
      } else if (node.type === 'sms_send') {
        if (contentTemplate) {
          smsText = contentTemplate.text || '';
        } else if (node.config?.content) {
          smsText = node.config.content.text || '';
        }
      } else if (node.type === 'voicemail_drop') {
        if (contentTemplate) {
          voicemailScript = contentTemplate.tts_script || '';
        } else if (node.config?.tts) {
          voicemailScript = node.config.tts.custom_script || '';
        }
      }
      
      if (outgoingEdges.length === 0) {
        rows.push({
          nodeId: node.id,
          nodeType: node.type,
          nodeName: node.name,
          templateId: templateId || '',
          emailSubject,
          emailBody,
          smsText,
          voicemailScript,
          edgeFrom: '',
          edgeTo: '',
          edgeToName: '',
          edgeConditionJson: '',
          originalConfig: node.config || {},
        });
      } else {
        for (const edge of outgoingEdges) {
          const toNode = nodeMap.get(edge.to) as any;
          rows.push({
            nodeId: node.id,
            nodeType: node.type,
            nodeName: node.name,
            templateId: templateId || '',
            emailSubject,
            emailBody,
            smsText,
            voicemailScript,
            edgeFrom: edge.from,
            edgeTo: edge.to,
            edgeToName: (toNode && toNode.name) ? toNode.name : edge.to,
            edgeConditionJson: JSON.stringify(edge.condition || {}, null, 2),
            originalConfig: node.config || {},
          });
        }
      }
    }
    
    return rows;
  }, [template, contentTemplateMap]);
  
  const [rows, setRows] = useState(tableRows);
  
  // When template changes, update rows
  useMemo(() => {
    setRows(tableRows);
  }, [tableRows]);
  
  const handleCellEdit = (rowIdx: number, field: string, value: string) => {
    setRows(prev => prev.map((row, idx) => {
      if (idx === rowIdx) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };
  
  const handleSave = async () => {
    try {
      // Rebuild nodes and edges from table rows, creating content template versions as needed
      const nodeMap = new Map<string, any>();
      const edges: any[] = [];
      const contentUpdates: Map<string, any> = new Map();
      
      for (const row of rows) {
        if (!row.nodeId) continue;
        
        // Check if content was edited (different from original)
        let config = { ...row.originalConfig };
        
        if (row.nodeType === 'email_send' && (row.emailSubject || row.emailBody)) {
          // Content was edited - store as custom content (no template reference)
          config = {
            ...config,
            template_id: undefined,
            content: {
              subject: row.emailSubject,
              body: row.emailBody,
            }
          };
        } else if (row.nodeType === 'sms_send' && row.smsText) {
          config = {
            ...config,
            template_id: undefined,
            content: {
              text: row.smsText,
            }
          };
        } else if (row.nodeType === 'voicemail_drop' && row.voicemailScript) {
          config = {
            ...config,
            template_id: undefined,
            tts: {
              custom_script: row.voicemailScript,
            }
          };
        }
        
        // Add or update node
        if (!nodeMap.has(row.nodeId)) {
          nodeMap.set(row.nodeId, {
            id: row.nodeId,
            type: row.nodeType || 'stage',
            name: row.nodeName || row.nodeId,
            config,
          });
        }
        
        // Add edge if present
        if (row.edgeFrom && row.edgeTo) {
          let condition = {};
          try {
            condition = JSON.parse(row.edgeConditionJson || '{}');
          } catch (e) {
            addToast({ title: 'Invalid JSON in edge condition', description: `Edge ${row.edgeFrom} → ${row.edgeTo}`, variant: 'error' });
            return;
          }
          
          // Avoid duplicates
          if (!edges.some(e => e.from === row.edgeFrom && e.to === row.edgeTo)) {
            edges.push({ from: row.edgeFrom, to: row.edgeTo, condition });
          }
        }
      }
      
      const nodes = Array.from(nodeMap.values());
      onUpdate(nodes, edges);
      addToast({ title: 'Table saved', description: `${nodes.length} nodes, ${edges.length} edges updated`, variant: 'success' });
    } catch (e: any) {
      addToast({ title: 'Save failed', description: e.message, variant: 'error' });
    }
  };
  
  const handleAddRow = () => {
    const newId = `n_${Math.random().toString(36).slice(2, 8)}`;
    setRows(prev => [...prev, {
      nodeId: newId,
      nodeType: 'stage',
      nodeName: 'New Node',
      templateId: '',
      emailSubject: '',
      emailBody: '',
      smsText: '',
      voicemailScript: '',
      edgeFrom: '',
      edgeTo: '',
      edgeToName: '',
      edgeConditionJson: '{}',
      originalConfig: {},
    }]);
  };
  
  const handleDeleteRow = (rowIdx: number) => {
    const confirmed = window.confirm('Delete this row?');
    if (!confirmed) return;
    setRows(prev => prev.filter((_, idx) => idx !== rowIdx));
  };
  
  const handleExport = () => {
    onExportCsv();
  };
  
  const handleImport = () => {
    setShowImport(true);
  };
  
  const handleImportConfirm = () => {
    try {
      onImportCsv(csvImportData);
      setShowImport(false);
      setCsvImportData('');
      addToast({ title: 'CSV imported', description: 'Table updated', variant: 'success' });
    } catch (e: any) {
      addToast({ title: 'Import failed', description: e.message, variant: 'error' });
    }
  };
  
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvImportData(text);
    };
    reader.readAsText(file);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Table View</h2>
        <div className="flex items-center gap-2">
          <button className="btn-outline btn-sm" onClick={handleAddRow}>+ Add Row</button>
          <button className="btn-outline btn-sm" onClick={handleExport}>Export CSV</button>
          <button className="btn-outline btn-sm" onClick={handleImport}>Import CSV</button>
          <button className="btn-primary btn-sm" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
      
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-semibold w-24">Node ID</th>
              <th className="px-3 py-2 text-left font-semibold w-32">Type</th>
              <th className="px-3 py-2 text-left font-semibold w-40">Name</th>
              <th className="px-3 py-2 text-left font-semibold w-64">Email Subject</th>
              <th className="px-3 py-2 text-left font-semibold w-96">Email Body / SMS Text / VM Script</th>
              <th className="px-3 py-2 text-left font-semibold w-24">Edge From</th>
              <th className="px-3 py-2 text-left font-semibold w-24">Edge To</th>
              <th className="px-3 py-2 text-left font-semibold w-32">To Node</th>
              <th className="px-3 py-2 text-left font-semibold w-48">Edge Condition</th>
              <th className="px-3 py-2 text-left font-semibold w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2">
                  <input
                    className="input input-sm w-full text-xs font-mono"
                    value={row.nodeId}
                    onChange={(e) => handleCellEdit(idx, 'nodeId', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className="input input-sm w-full text-xs"
                    value={row.nodeType}
                    onChange={(e) => handleCellEdit(idx, 'nodeType', e.target.value)}
                  >
                    <option value="stage">stage</option>
                    <option value="email_send">email_send</option>
                    <option value="sms_send">sms_send</option>
                    <option value="voicemail_drop">voicemail_drop</option>
                    <option value="wait">wait</option>
                    <option value="decision">decision</option>
                    <option value="task">task</option>
                    <option value="web_request">web_request</option>
                    <option value="esign">esign</option>
                    <option value="goal">goal</option>
                    <option value="exit">exit</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    className="input input-sm w-full text-xs"
                    value={row.nodeName}
                    onChange={(e) => handleCellEdit(idx, 'nodeName', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  {row.nodeType === 'email_send' ? (
                    <input
                      className="input input-sm w-full text-xs"
                      placeholder="Email subject..."
                      value={row.emailSubject}
                      onChange={(e) => handleCellEdit(idx, 'emailSubject', e.target.value)}
                    />
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.nodeType === 'email_send' && (
                    <textarea
                      className="input input-sm w-full text-xs"
                      rows={4}
                      placeholder="Email body..."
                      value={row.emailBody}
                      onChange={(e) => handleCellEdit(idx, 'emailBody', e.target.value)}
                    />
                  )}
                  {row.nodeType === 'sms_send' && (
                    <textarea
                      className="input input-sm w-full text-xs"
                      rows={3}
                      placeholder="SMS text..."
                      value={row.smsText}
                      onChange={(e) => handleCellEdit(idx, 'smsText', e.target.value)}
                    />
                  )}
                  {row.nodeType === 'voicemail_drop' && (
                    <textarea
                      className="input input-sm w-full text-xs"
                      rows={3}
                      placeholder="Voicemail script..."
                      value={row.voicemailScript}
                      onChange={(e) => handleCellEdit(idx, 'voicemailScript', e.target.value)}
                    />
                  )}
                  {!['email_send', 'sms_send', 'voicemail_drop'].includes(row.nodeType) && (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <input
                    className="input input-sm w-full text-xs font-mono"
                    value={row.edgeFrom}
                    onChange={(e) => handleCellEdit(idx, 'edgeFrom', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="input input-sm w-full text-xs font-mono"
                    value={row.edgeTo}
                    onChange={(e) => handleCellEdit(idx, 'edgeTo', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">
                  {row.edgeToName || '—'}
                </td>
                <td className="px-3 py-2">
                  <textarea
                    className="input input-sm w-full font-mono text-xs"
                    rows={2}
                    placeholder="{}"
                    value={row.edgeConditionJson}
                    onChange={(e) => handleCellEdit(idx, 'edgeConditionJson', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    className="btn-outline btn-xs text-red-600 hover:bg-red-50 whitespace-nowrap"
                    onClick={() => handleDeleteRow(idx)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {showImport && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Import CSV</h3>
              <button className="btn-outline btn-sm" onClick={() => setShowImport(false)}>Close</button>
            </div>
            
            <div>
              <label className="label">Upload CSV File</label>
              <input
                type="file"
                accept=".csv"
                className="input"
                onChange={handleFileImport}
              />
            </div>
            
            <div>
              <label className="label">Or Paste CSV Data</label>
              <textarea
                className="input h-64 font-mono text-xs"
                placeholder="NodeID,NodeType,NodeName,ConfigJSON,PosX,PosY,EdgeFrom,EdgeTo,EdgeConditionJSON"
                value={csvImportData}
                onChange={(e) => setCsvImportData(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 justify-end">
              <button className="btn-outline btn-sm" onClick={() => setShowImport(false)}>Cancel</button>
              <button
                className="btn-primary btn-sm"
                onClick={handleImportConfirm}
                disabled={!csvImportData.trim()}
              >
                Import & Update Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

