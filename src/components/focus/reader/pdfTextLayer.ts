type PdfJsTextLayerCtor = new (args: {
  textContentSource: unknown;
  container: HTMLDivElement;
  viewport: { scale: number };
}) => {
  render: () => Promise<void>;
};

export async function renderPdfTextLayer(
  pdfjs: { TextLayer: PdfJsTextLayerCtor },
  page: { getTextContent: () => Promise<unknown> },
  container: HTMLDivElement,
  viewport: { scale: number },
): Promise<void> {
  const textContent = await page.getTextContent();

  container.className = 'textLayer';
  container.replaceChildren();
  container.style.position = 'absolute';
  container.style.inset = '0';
  container.style.overflow = 'clip';
  container.style.opacity = '1';
  container.style.lineHeight = '1';
  container.style.textAlign = 'initial';
  container.style.caretColor = 'CanvasText';
  container.style.transformOrigin = '0 0';
  container.style.pointerEvents = 'auto';
  container.style.zIndex = '1';
  container.style.setProperty('forced-color-adjust', 'none');
  container.style.setProperty('text-size-adjust', 'none');
  container.style.setProperty('-webkit-text-size-adjust', 'none');
  container.style.setProperty('-moz-text-size-adjust', 'none');
  container.style.setProperty('--total-scale-factor', String(viewport.scale));
  container.style.setProperty('--min-font-size', '1');
  container.style.setProperty('--text-scale-factor', 'calc(var(--total-scale-factor) * var(--min-font-size))');
  container.style.setProperty('--min-font-size-inv', 'calc(1 / var(--min-font-size))');

  const textLayer = new pdfjs.TextLayer({
    textContentSource: textContent,
    container,
    viewport,
  });

  await textLayer.render();

  for (const node of Array.from(container.querySelectorAll('span, br'))) {
    if (!(node instanceof HTMLElement)) continue;
    node.style.color = 'transparent';
    node.style.position = 'absolute';
    node.style.whiteSpace = 'pre';
    node.style.cursor = 'text';
    node.style.transformOrigin = '0% 0%';
    node.style.zIndex = '1';
    node.style.fontSize = 'calc(var(--text-scale-factor) * var(--font-height))';
    node.style.transform = 'rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv))';
  }
}
