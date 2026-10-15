import { SUPPORTED_LANGUAGES } from '../../constants/languages';

interface LanguageSelectorProps {
  language: string;
  onLanguageChange: (language: string) => void;
}

export default function LanguageSelector({
  language,
  onLanguageChange
}: LanguageSelectorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '12px', color: '#888' }}>📝</span>
      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
        style={{
          background: '#1e1e2e',
          border: '1px solid #3a3a4a',
          borderRadius: '6px',
          padding: '4px 8px',
          color: '#4ECDC4',
          fontSize: '12px',
          cursor: 'pointer',
          outline: 'none',
          minWidth: '130px'
        }}
        title="Select Language"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.id} value={lang.monacoId}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}