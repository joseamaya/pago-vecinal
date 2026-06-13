import { downloadBlob } from '../utils/downloadBlob';

export function useDownload() {
  const download = (blob, filename) => {
    downloadBlob(blob, filename);
  };

  const downloadFromResponse = (response, defaultFilename) => {
    const contentDisposition = response.headers['content-disposition'];
    let filename = defaultFilename;

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+?)"?$/);
      if (match) {
        filename = match[1];
      }
    }

    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/octet-stream',
    });
    download(blob, filename);
  };

  return { download, downloadFromResponse };
}
