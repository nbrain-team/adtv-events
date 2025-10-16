import { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { useStore } from '@store/useStore';

type FunnelTableViewProps = {
  template: any;
  onUpdate: (nodes: any[], edges: any[]) => void;
  onExportCsv: () => void;
  onImportCsv: (csvData: string) => void;
};

export function FunnelTableView({ template, onUpdate, onExportCsv, onImportCsv }: FunnelTableViewProps) {
  const { addToast } = useStore();
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; field: string } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvImportData, setCsvImportData] = useState('');
  
  // Flatten nodes and edges into table rows
  const tableRows = useMemo(() => {
    const rows: any[] = [];
    const nodeMap = new Map(template.graph.nodes.map((n: any) => [n.id, n]));
    
    for (const node of template.graph.nodes) {
      const outgoingEdges = template.graph.edges.filter((e: any) => e.from === node.id);
      
      if (outgoingEdges.length === 0) {
        rows.push({
          nodeId: node.id,
          nodeType: node.type,
          nodeName: node.name,
          configJson: JSON.stringify(node.config || {}, null, 2),
          edgeFrom: '',
          edgeTo: '',
          edgeToName: '',
          edgeConditionJson: '',
        });
      } else {
        for (const edge of outgoingEdges) {
          const toNode = nodeMap.get(edge.to) as any;
          rows.push({
            nodeId: node.id,
            nodeType: node.type,
            nodeName: node.name,
            configJson: JSON.stringify(node.config || {}, null, 2),
            edgeFrom: edge.from,
            edgeTo: edge.to,
            edgeToName: (toNode && toNode.name) ? toNode.name : edge.to,
            edgeConditionJson: JSON.stringify(edge.condition || {}, null, 2),
          });
        }
      }
    }
    
    return rows;
  }, [template]);
  
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
  
  const handleSave = () => {
    try {
      // Rebuild nodes and edges from table rows
      const nodeMap = new Map<string, any>();
      const edges: any[] = [];
      
      for (const row of rows) {
        if (!row.nodeId) continue;
        
        // Add or update node
        if (!nodeMap.has(row.nodeId)) {
          let config = {};
          try {
            config = JSON.parse(row.configJson || '{}');
          } catch (e) {
            addToast({ title: 'Invalid JSON in config', description: `Row with node ${row.nodeId}`, variant: 'error' });
            return;
          }
          
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
      addToast({ title: 'Table saved', description: `${nodes.length} nodes, ${edges.length} edges`, variant: 'success' });
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
      configJson: '{}',
      edgeFrom: '',
      edgeTo: '',
      edgeToName: '',
      edgeConditionJson: '{}',
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
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Node ID</th>
              <th className="px-3 py-2 text-left font-semibold">Type</th>
              <th className="px-3 py-2 text-left font-semibold">Name</th>
              <th className="px-3 py-2 text-left font-semibold w-64">Config (JSON)</th>
              <th className="px-3 py-2 text-left font-semibold">Edge From</th>
              <th className="px-3 py-2 text-left font-semibold">Edge To</th>
              <th className="px-3 py-2 text-left font-semibold">To Node Name</th>
              <th className="px-3 py-2 text-left font-semibold w-48">Edge Condition (JSON)</th>
              <th className="px-3 py-2 text-left font-semibold w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2">
                  <input
                    className="input input-sm w-full"
                    value={row.nodeId}
                    onChange={(e) => handleCellEdit(idx, 'nodeId', e.target.value)}
                    onFocus={() => setEditingCell({ rowIdx: idx, field: 'nodeId' })}
                    onBlur={() => setEditingCell(null)}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className="input input-sm w-full"
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
                    className="input input-sm w-full"
                    value={row.nodeName}
                    onChange={(e) => handleCellEdit(idx, 'nodeName', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <textarea
                    className="input input-sm w-full font-mono text-xs"
                    rows={3}
                    value={row.configJson}
                    onChange={(e) => handleCellEdit(idx, 'configJson', e.target.value)}
                    onFocus={() => setEditingCell({ rowIdx: idx, field: 'configJson' })}
                    onBlur={() => setEditingCell(null)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="input input-sm w-full"
                    value={row.edgeFrom}
                    onChange={(e) => handleCellEdit(idx, 'edgeFrom', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="input input-sm w-full"
                    value={row.edgeTo}
                    onChange={(e) => handleCellEdit(idx, 'edgeTo', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">
                  {row.edgeToName}
                </td>
                <td className="px-3 py-2">
                  <textarea
                    className="input input-sm w-full font-mono text-xs"
                    rows={2}
                    value={row.edgeConditionJson}
                    onChange={(e) => handleCellEdit(idx, 'edgeConditionJson', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    className="btn-outline btn-xs text-red-600 hover:bg-red-50"
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

