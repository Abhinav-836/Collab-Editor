import { useEffect, useState } from 'react';

interface Model {
  name: string;
  id: string;
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export default function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([
    { name: 'llama3.2:latest', id: 'llama3.2:latest' },
    { name: 'codellama:latest', id: 'codellama:latest' },
    { name: 'mistral:latest', id: 'mistral:latest' },
    { name: 'llama3.1:latest', id: 'llama3.1:latest' }
  ]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchModels();
  }, []);

  const API_BASE = import.meta.env.VITE_API_URL || '';

  const fetchModels = async () => {
    try {
        const response = await fetch(`${API_BASE}/api/ai/models`);
      const data = await response.json();
      if (data.success && data.models && data.models.length > 0) {
        setModels(data.models);
        if (data.models[0] && !selectedModel) {
          onModelChange(data.models[0].name);
        }
      }
    } catch (error) {
      console.error('Failed to fetch models from API, using defaults');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: '#888' }}>🤖 Loading...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '12px', color: '#888' }}>🤖 Model:</span>
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        style={{
          background: '#1e1e2e',
          border: '1px solid #3a3a4a',
          borderRadius: '6px',
          padding: '4px 8px',
          color: '#4ECDC4',
          fontSize: '12px',
          cursor: 'pointer',
          outline: 'none',
          minWidth: '150px'
        }}
      >
        {models.map((model) => (
          <option key={model.id} value={model.name}>
            {model.name.replace(':latest', '')}
          </option>
        ))}
      </select>
    </div>
  );
}