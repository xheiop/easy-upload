import { toast, Toaster } from 'sonner';
import { render } from 'preact';
import YAML from 'yaml';
import { $t } from '@/common';
import { CURRENT_SITE_INFO } from '@/const';
import { collectFormControls } from './collect-form-controls';

const AnalyzeUploadPage = () => {
  const analyzeForm = () => {
    const yamlContent = YAML.stringify(collectFormControls());
    navigator.clipboard
      .writeText(`\`\`\`yaml\n${yamlContent}\`\`\``)
      .then(() => {
        toast.success($t('app.configCopied'));
      });
  };

  return (
    <>
      <Toaster position="top-right" richColors />
      <button
        onClick={analyzeForm}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '8px 16px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {`[EASY-UPLOAD]${$t('app.exportPageConfig')}`}
      </button>
    </>
  );
};

// NexusPHP and most engines upload at */upload*, UNIT3D at /torrents/create.
const isUploadPage = /upload|\/torrents\/create/i.test(location.pathname);

if (
  isUploadPage &&
  !CURRENT_SITE_INFO?.asTarget &&
  window.self === window.top
) {
  const div = document.createElement('div');
  render(<AnalyzeUploadPage />, div);
  document.body.appendChild(div);
}
