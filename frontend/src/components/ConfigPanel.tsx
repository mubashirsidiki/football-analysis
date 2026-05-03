import { useState } from 'react'
import { Settings, ListChecks, Brain, Plus, X } from 'lucide-react'

interface SchemaField {
  fieldName: string
  dataType: string
  description: string
}

interface ConfigPanelProps {
  onStartAnalysis: () => void
  disabled?: boolean
}

export default function ConfigPanel({ onStartAnalysis, disabled = false }: ConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<'templates' | 'custom'>('templates')
  const [selectedTemplate, setSelectedTemplate] = useState<'tactical_breakdown' | 'deep_cognitive'>('tactical_breakdown')
  const [customSchema, setCustomSchema] = useState<SchemaField[]>([
    { fieldName: 'key_events', dataType: 'array', description: 'List of all major events' }
  ])

  const addSchemaRow = () => {
    setCustomSchema([...customSchema, { fieldName: '', dataType: 'string', description: '' }])
  }

  const removeSchemaRow = (index: number) => {
    setCustomSchema(customSchema.filter((_, i) => i !== index))
  }

  const updateSchemaRow = (index: number, field: keyof SchemaField, value: string) => {
    const updated = [...customSchema]
    updated[index] = { ...updated[index], [field]: value }
    setCustomSchema(updated)
  }

  return (
    <div className="panel config-panel glass-card">
      <div className="panel-header">
        <h2>
          <i className="fa-solid fa-sliders" />
          Analysis Output
        </h2>
        <span className="badge">Step 2</span>
      </div>

      {/* Config Tabs */}
      <div className="config-tabs">
        <button
          className={`tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <ListChecks className="h-4 w-4 mr-2 inline" />
          Pre-built Templates
        </button>
        <button
          className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
          onClick={() => setActiveTab('custom')}
        >
          <Settings className="h-4 w-4 mr-2 inline" />
          Custom Prompt
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'templates' && (
          <div className="tab-pane active">
            <p className="section-desc">Select an analysis model designed by football professionals.</p>

            <div className="template-grid">
              {/* Tactical Breakdown */}
              <label className="template-card">
                <input
                  type="radio"
                  name="template"
                  value="tactical_breakdown"
                  checked={selectedTemplate === 'tactical_breakdown'}
                  onChange={() => setSelectedTemplate('tactical_breakdown')}
                />
                <div className="template-card-inner">
                  <div className="card-icon">
                    <ListChecks />
                  </div>
                  <div className="card-info">
                    <h4>Tactical Breakdown</h4>
                    <p>General match analysis, events, and formations.</p>
                  </div>
                  <div className="check-circle">
                    <i className="fa-solid fa-check" />
                  </div>
                </div>
              </label>

              {/* Deep Cognitive Analysis */}
              <label className="template-card">
                <input
                  type="radio"
                  name="template"
                  value="deep_cognitive"
                  checked={selectedTemplate === 'deep_cognitive'}
                  onChange={() => setSelectedTemplate('deep_cognitive')}
                />
                <div className="template-card-inner">
                  <div className="card-icon">
                    <Brain />
                  </div>
                  <div className="card-info">
                    <h4>Deep Cognitive Analysis</h4>
                    <p>Scanning, decision-making KPIs, and risk assessment.</p>
                  </div>
                  <div className="check-circle">
                    <i className="fa-solid fa-check" />
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="tab-pane active">
            <div className="custom-schema-wrapper">
              <label className="section-desc">Define the exact data structure you want the AI to return.</label>

              <div className="flex px-1 py-0.5 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider border-b border-[var(--border-color)] mb-2">
                <span className="flex-2">Field Name</span>
                <span className="flex-1.2 mx-2">Data Type</span>
                <span className="flex-2">Description</span>
                <span className="w-[30px]"></span>
              </div>

              <div className="schema-rows-container">
                {customSchema.map((field, index) => (
                  <div key={index} className="schema-row">
                    <input
                      type="text"
                      className="schema-field"
                      placeholder="e.g. key_events"
                      value={field.fieldName}
                      onChange={(e) => updateSchemaRow(index, 'fieldName', e.target.value)}
                    />
                    <select
                      className="schema-type"
                      value={field.dataType}
                      onChange={(e) => updateSchemaRow(index, 'dataType', e.target.value)}
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="array">Array</option>
                      <option value="object">Object</option>
                    </select>
                    <input
                      type="text"
                      className="schema-desc"
                      placeholder="e.g. List of all major events"
                      value={field.description}
                      onChange={(e) => updateSchemaRow(index, 'description', e.target.value)}
                    />
                    <button
                      className="remove-row-btn"
                      onClick={() => removeSchemaRow(index)}
                      title="Remove Field"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-outline outline-sm mt-3"
                onClick={addSchemaRow}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="action-footer">
        <button
          className="btn btn-primary btn-large btn-glow"
          disabled={disabled}
          onClick={onStartAnalysis}
        >
          <i className="fa-solid fa-wand-magic-sparkles" />
          Generate Analysis
        </button>
      </div>
    </div>
  )
}