describe('downloadBlob', () => {
  let createObjectURLMock;
  let revokeObjectURLMock;
  let clickMock;
  let removeMock;
  let setAttributeMock;

  beforeEach(() => {
    clickMock = jest.fn();
    removeMock = jest.fn();
    setAttributeMock = jest.fn();

    const linkElement = {
      click: clickMock,
      remove: removeMock,
      setAttribute: setAttributeMock,
      href: '',
      download: '',
    };

    jest.spyOn(document, 'createElement').mockReturnValue(linkElement);
    jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});

    createObjectURLMock = jest.fn().mockReturnValue('blob:test-url');
    revokeObjectURLMock = jest.fn();

    Object.defineProperty(window, 'URL', {
      value: {
        createObjectURL: createObjectURLMock,
        revokeObjectURL: revokeObjectURLMock,
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates object URL from blob', () => {
    const { downloadBlob } = require('../downloadBlob');
    const blob = new Blob(['test']);
    downloadBlob(blob, 'test.pdf');
    expect(createObjectURLMock).toHaveBeenCalled();
  });

  test('sets filename on anchor', () => {
    const { downloadBlob } = require('../downloadBlob');
    const blob = new Blob(['test']);
    downloadBlob(blob, 'test.pdf');
    expect(setAttributeMock).toHaveBeenCalledWith('download', 'test.pdf');
  });

  test('clicks the link', () => {
    const { downloadBlob } = require('../downloadBlob');
    const blob = new Blob(['test']);
    downloadBlob(blob, 'file.xlsx');
    expect(clickMock).toHaveBeenCalled();
  });

  test('revokes object URL after download', () => {
    const { downloadBlob } = require('../downloadBlob');
    const blob = new Blob(['test']);
    downloadBlob(blob, 'test.pdf');
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url');
  });
});
